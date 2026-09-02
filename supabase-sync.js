(()=>{
if(window.__ppmSupabaseSync)return;window.__ppmSupabaseSync=true;

const CFG=window.PPM_SUPABASE;
if(!CFG?.url||!CFG?.publishableKey||!window.supabase){console.warn('PPM cloud sync unavailable: Supabase client/config missing.');return;}

const client=window.supabase.createClient(CFG.url,CFG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.ppmSupabase=client;
let session=null,suppress=false,pushTimer=null,offlineChosen=false,sharedReady=false;
const STORAGE_KEY='ppmV3Data';
const originalSetItem=Storage.prototype.setItem;
const localPhotos=()=>Array.isArray(window.db?.photos)?window.db.photos:[];
const siteIdOf=x=>Number(x?.siteId);

const statusEl=()=>document.getElementById('ppmCloudStatus');
const setStatus=(text,kind='')=>{const el=statusEl();if(!el)return;el.textContent=text;el.dataset.kind=kind;el.title=kind==='error'?'Changes remain saved on this device and will retry when cloud sync is available.':'PPM Field Pro shared cloud sync';};

function installStatus(){
 if(statusEl())return;
 const header=document.querySelector('header');if(!header)return;
 const wrap=document.createElement('div');wrap.style='display:flex;align-items:center;gap:6px;margin-left:auto';
 wrap.innerHTML='<span id="ppmCloudStatus" style="font-size:12px;font-weight:700;padding:6px 9px;border-radius:999px;background:#e2e8f0;color:#0f172a">Cloud: checking</span><button id="ppmCloudAccount" class="secondary" style="display:none;padding:6px 8px;font-size:12px">Account</button>';
 header.appendChild(wrap);document.getElementById('ppmCloudAccount').onclick=showAccount;
}

function stateForSite(site){
 const payload={site:JSON.parse(JSON.stringify(site))};
 Object.entries(db).forEach(([key,value])=>{
  if(key==='sites'||key==='photos'||!Array.isArray(value))return;
  const scoped=value.filter(item=>siteIdOf(item)===Number(site.id));
  if(scoped.length||value.some(item=>item&&Object.prototype.hasOwnProperty.call(item,'siteId')))payload[key]=JSON.parse(JSON.stringify(scoped));
 });
 return payload;
}

function applySharedRows(rows){
 const photos=localPhotos();
 const remoteIds=new Set((rows||[]).map(r=>Number(r.id)));
 const existing=db&&typeof db==='object'?db:{};
 const next={};
 Object.entries(existing).forEach(([key,value])=>{
  if(key==='photos')return;
  if(Array.isArray(value)){
   if(key==='sites')next[key]=[];
   else next[key]=value.filter(item=>!remoteIds.has(siteIdOf(item)));
  }else next[key]=value;
 });
 next.sites=[];
 for(const row of rows||[]){
  const st=row.site_state||{};const site=st.site||{id:Number(row.id),name:row.name||''};
  site.id=Number(row.id);next.sites.push(site);
  Object.entries(st).forEach(([key,value])=>{
   if(key==='site'||!Array.isArray(value))return;
   next[key]=next[key]||[];
   next[key].push(...value.map(item=>({...item,siteId:Number(row.id)})));
  });
 }
 next.photos=photos;
 suppress=true;Object.keys(db).forEach(k=>delete db[k]);Object.assign(db,next);originalSetItem.call(localStorage,STORAGE_KEY,JSON.stringify(db));suppress=false;
 if(typeof renderAll==='function')renderAll();
 if(typeof showSitesList==='function'&&document.getElementById('sites')?.classList.contains('active'))showSitesList();
}

async function pushShared(){
 if(!session?.user||suppress||offlineChosen||!sharedReady)return;
 setStatus('Cloud: saving');
 for(const site of db.sites||[]){
  const {error}=await client.rpc('ppm_upsert_site_state',{p_site_id:Number(site.id),p_name:site.name||'',p_site_state:stateForSite(site)});
  if(error){console.error('PPM shared site save failed',site.id,error);setStatus('Cloud: setup needed','error');return;}
 }
 setStatus('Cloud: saved','ok');
}
function queuePush(){clearTimeout(pushTimer);pushTimer=setTimeout(pushShared,750);}

Storage.prototype.setItem=function(key,value){
 const result=originalSetItem.call(this,key,value);
 if(this===localStorage&&key===STORAGE_KEY&&!suppress)queuePush();
 return result;
};

async function migrateLegacyOrLocal(){
 const photos=localPhotos();
 let source=db;
 const {data:legacy,error:legacyError}=await client.from('ppm_app_state').select('state').eq('user_id',session.user.id).maybeSingle();
 if(!legacyError&&legacy?.state?.sites?.length)source=legacy.state;
 const usedLegacy=source!==db;
 if(usedLegacy){suppress=true;Object.keys(db).forEach(k=>delete db[k]);Object.assign(db,source,{photos});suppress=false;}
 sharedReady=true;
 await pushShared();
 if(usedLegacy)originalSetItem.call(localStorage,STORAGE_KEY,JSON.stringify(db));
}

async function loadCloud(){
 if(!session?.user)return;
 setStatus('Cloud: loading');
 const {data,error}=await client.from('ppm_sites').select('id,name,site_state,updated_at').order('name');
 if(error){console.error('PPM shared cloud load failed',error);sharedReady=false;setStatus('Cloud: setup needed','error');return;}
 if(data?.length){sharedReady=true;applySharedRows(data);setStatus('Cloud: synced','ok');return;}
 await migrateLegacyOrLocal();
 const {data:after,error:afterError}=await client.from('ppm_sites').select('id,name,site_state,updated_at').order('name');
 if(!afterError&&after?.length){applySharedRows(after);setStatus('Cloud: migrated','ok');}
}

async function shareActiveSite(){
 const siteId=Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
 const email=document.getElementById('ppmShareEmail')?.value.trim();
 const role=document.getElementById('ppmShareRole')?.value||'technician';
 const msg=document.getElementById('ppmShareMsg');
 if(!siteId||!email){if(msg)msg.textContent='Choose a site and enter the technician email.';return;}
 if(msg)msg.textContent='Sharing…';
 const {error}=await client.rpc('ppm_grant_site_access',{p_site_id:Number(siteId),p_email:email,p_role:role});
 if(error){if(msg)msg.textContent=error.message;return;}
 if(msg)msg.textContent='Site access granted.';
}
window.ppmShareActiveSite=shareActiveSite;

function authOverlay(message=''){
 let el=document.getElementById('ppmAuthOverlay');if(el)el.remove();
 el=document.createElement('div');el.id='ppmAuthOverlay';el.style='position:fixed;inset:0;background:rgba(15,23,42,.82);z-index:99999;display:grid;place-items:center;padding:18px';
 el.innerHTML=`<div style="width:min(430px,100%);background:white;color:#0f172a;border-radius:16px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.35)"><h2 style="margin:0 0 6px">PPM Field Pro</h2><p style="margin:0 0 16px;color:#64748b">Sign in to sync sites with the shared cloud database.</p><label style="font-size:12px;font-weight:700">Email</label><input id="ppmAuthEmail" type="email" autocomplete="email" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px"><label style="font-size:12px;font-weight:700">Password</label><input id="ppmAuthPassword" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px"><div id="ppmAuthMsg" style="min-height:20px;color:#b91c1c;font-size:13px;margin-bottom:8px">${message}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="ppmSignIn" style="border:0;border-radius:8px;padding:10px 14px;background:#0f172a;color:white;font-weight:700">Sign in</button><button id="ppmSignUp" style="border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;background:white;color:#0f172a;font-weight:700">Create account</button><button id="ppmOffline" style="border:0;background:transparent;padding:10px;color:#475569">Use offline only</button></div><p style="font-size:12px;color:#64748b;margin:14px 0 0">Offline changes stay on this device and sync when you reconnect.</p></div>`;
 document.body.appendChild(el);
 const msg=t=>document.getElementById('ppmAuthMsg').textContent=t||'';
 document.getElementById('ppmSignIn').onclick=async()=>{msg('Signing in…');const email=document.getElementById('ppmAuthEmail').value.trim(),password=document.getElementById('ppmAuthPassword').value;const {data,error}=await client.auth.signInWithPassword({email,password});if(error)return msg(error.message);session=data.session;offlineChosen=false;el.remove();document.getElementById('ppmCloudAccount').style.display='inline-block';await loadCloud();};
 document.getElementById('ppmSignUp').onclick=async()=>{msg('Creating account…');const email=document.getElementById('ppmAuthEmail').value.trim(),password=document.getElementById('ppmAuthPassword').value;if(password.length<6)return msg('Use a password of at least 6 characters.');const {data,error}=await client.auth.signUp({email,password});if(error)return msg(error.message);if(data.session){session=data.session;offlineChosen=false;el.remove();document.getElementById('ppmCloudAccount').style.display='inline-block';await loadCloud();}else msg('Account created. Check your email to confirm it, then sign in.');};
 document.getElementById('ppmOffline').onclick=()=>{offlineChosen=true;setStatus('Local only');el.remove();};
}

function showAccount(){
 if(!session?.user)return authOverlay();
 let el=document.getElementById('ppmAuthOverlay');if(el)el.remove();
 const activeSite=(db.sites||[]).find(s=>Number(s.id)===(Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id));
 el=document.createElement('div');el.id='ppmAuthOverlay';el.style='position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:99999;display:grid;place-items:center;padding:18px';
 el.innerHTML=`<div style="width:min(470px,100%);background:white;color:#0f172a;border-radius:16px;padding:22px"><h3 style="margin-top:0">Cloud account</h3><p style="overflow-wrap:anywhere">${session.user.email||''}</p><p style="color:#64748b;font-size:13px">Sites and their equipment, PPM records and history use the shared site database.</p><hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0"><h4 style="margin:0 0 8px">Share active site</h4><div style="font-size:12px;color:#64748b;margin-bottom:8px">${activeSite?.name||'No active site'}</div><input id="ppmShareEmail" type="email" placeholder="Technician email" style="width:100%;box-sizing:border-box;margin-bottom:8px;padding:9px"><select id="ppmShareRole" style="width:100%;margin-bottom:8px;padding:9px"><option value="technician">Technician</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select><button id="ppmShareBtn" style="padding:9px 12px">Grant site access</button><div id="ppmShareMsg" style="min-height:18px;font-size:12px;color:#475569;margin-top:7px"></div><div style="display:flex;gap:8px;margin-top:16px"><button id="ppmAccountClose" style="padding:9px 12px">Close</button><button id="ppmSignOut" style="padding:9px 12px">Sign out</button></div></div>`;
 document.body.appendChild(el);document.getElementById('ppmShareBtn').onclick=shareActiveSite;document.getElementById('ppmAccountClose').onclick=()=>el.remove();document.getElementById('ppmSignOut').onclick=async()=>{await client.auth.signOut();session=null;sharedReady=false;el.remove();document.getElementById('ppmCloudAccount').style.display='none';setStatus('Local only');authOverlay();};
}

async function init(){
 installStatus();const {data}=await client.auth.getSession();session=data.session;
 client.auth.onAuthStateChange((_event,newSession)=>{session=newSession;if(session){offlineChosen=false;document.getElementById('ppmCloudAccount').style.display='inline-block';}else{sharedReady=false;document.getElementById('ppmCloudAccount').style.display='none';}});
 if(session){document.getElementById('ppmCloudAccount').style.display='inline-block';await loadCloud();}else{setStatus('Local only');authOverlay();}
 window.addEventListener('online',()=>{if(session){setStatus('Cloud: reconnecting');loadCloud().then(queuePush);}});window.addEventListener('offline',()=>setStatus('Cloud: offline','error'));
}
setTimeout(init,0);
})();
