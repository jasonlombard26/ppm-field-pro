(()=>{
if(window.__ppmSupabaseSync)return;window.__ppmSupabaseSync=true;

const CFG=window.PPM_SUPABASE;
if(!CFG?.url||!CFG?.publishableKey||!window.supabase){console.warn('PPM cloud sync unavailable: Supabase client/config missing.');return;}

const client=window.supabase.createClient(CFG.url,CFG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.ppmSupabase=client;
let session=null,suppress=false,pushTimer=null,offlineChosen=false;
const STORAGE_KEY='ppmV3Data';
const originalSetItem=Storage.prototype.setItem;

const cloneForCloud=()=>{
  const state=JSON.parse(JSON.stringify(db));
  // Phase 1: photos remain device-local until Supabase Storage is enabled.
  delete state.photos;
  return state;
};

const statusEl=()=>document.getElementById('ppmCloudStatus');
const setStatus=(text,kind='')=>{const el=statusEl();if(!el)return;el.textContent=text;el.dataset.kind=kind;el.title=kind==='error'?'Changes remain saved on this device and will retry when cloud sync is available.':'PPM Field Pro cloud sync';};

function installStatus(){
  if(statusEl())return;
  const header=document.querySelector('header');if(!header)return;
  const wrap=document.createElement('div');wrap.style='display:flex;align-items:center;gap:6px;margin-left:auto';
  wrap.innerHTML='<span id="ppmCloudStatus" style="font-size:12px;font-weight:700;padding:6px 9px;border-radius:999px;background:#e2e8f0;color:#0f172a">Cloud: checking</span><button id="ppmCloudAccount" class="secondary" style="display:none;padding:6px 8px;font-size:12px">Account</button>';
  header.appendChild(wrap);document.getElementById('ppmCloudAccount').onclick=showAccount;
}

const applyRemote=state=>{
  if(!state||typeof state!=='object')return;
  const localPhotos=Array.isArray(db.photos)?db.photos:[];
  suppress=true;
  Object.keys(db).forEach(k=>delete db[k]);
  Object.assign(db,state,{photos:localPhotos});
  originalSetItem.call(localStorage,STORAGE_KEY,JSON.stringify(db));
  suppress=false;
  if(typeof renderAll==='function')renderAll();
};

async function pushCloud(){
  if(!session?.user||suppress||offlineChosen)return;
  setStatus('Cloud: saving');
  const {error}=await client.from('ppm_app_state').upsert({user_id:session.user.id,state:cloneForCloud(),updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error){console.error('PPM cloud save failed',error);setStatus('Cloud: offline','error');return;}
  setStatus('Cloud: saved','ok');
}

function queuePush(){clearTimeout(pushTimer);pushTimer=setTimeout(pushCloud,750);}

Storage.prototype.setItem=function(key,value){
  const result=originalSetItem.call(this,key,value);
  if(this===localStorage&&key===STORAGE_KEY&&!suppress)queuePush();
  return result;
};

async function loadCloud(){
  if(!session?.user)return;
  setStatus('Cloud: loading');
  const {data,error}=await client.from('ppm_app_state').select('state,updated_at').eq('user_id',session.user.id).maybeSingle();
  if(error){console.error('PPM cloud load failed',error);setStatus('Cloud: setup needed','error');return;}
  if(data?.state){applyRemote(data.state);setStatus('Cloud: synced','ok');}
  else {await pushCloud();}
}

function authOverlay(message=''){
  let el=document.getElementById('ppmAuthOverlay');if(el)el.remove();
  el=document.createElement('div');el.id='ppmAuthOverlay';
  el.style='position:fixed;inset:0;background:rgba(15,23,42,.82);z-index:99999;display:grid;place-items:center;padding:18px';
  el.innerHTML=`<div style="width:min(430px,100%);background:white;color:#0f172a;border-radius:16px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.35)"><h2 style="margin:0 0 6px">PPM Field Pro</h2><p style="margin:0 0 16px;color:#64748b">Sign in to sync this device with the shared cloud database.</p><label style="font-size:12px;font-weight:700">Email</label><input id="ppmAuthEmail" type="email" autocomplete="email" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px"><label style="font-size:12px;font-weight:700">Password</label><input id="ppmAuthPassword" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px"><div id="ppmAuthMsg" style="min-height:20px;color:#b91c1c;font-size:13px;margin-bottom:8px">${message}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="ppmSignIn" style="border:0;border-radius:8px;padding:10px 14px;background:#0f172a;color:white;font-weight:700">Sign in</button><button id="ppmSignUp" style="border:1px solid #cbd5e1;border-radius:8px;padding:10px 14px;background:white;color:#0f172a;font-weight:700">Create account</button><button id="ppmOffline" style="border:0;background:transparent;padding:10px;color:#475569">Use offline only</button></div><p style="font-size:12px;color:#64748b;margin:14px 0 0">Offline changes stay on this device. Photos are device-local in this first cloud version.</p></div>`;
  document.body.appendChild(el);
  const msg=t=>document.getElementById('ppmAuthMsg').textContent=t||'';
  document.getElementById('ppmSignIn').onclick=async()=>{msg('Signing in…');const email=document.getElementById('ppmAuthEmail').value.trim(),password=document.getElementById('ppmAuthPassword').value;const {data,error}=await client.auth.signInWithPassword({email,password});if(error)return msg(error.message);session=data.session;offlineChosen=false;el.remove();document.getElementById('ppmCloudAccount').style.display='inline-block';await loadCloud();};
  document.getElementById('ppmSignUp').onclick=async()=>{msg('Creating account…');const email=document.getElementById('ppmAuthEmail').value.trim(),password=document.getElementById('ppmAuthPassword').value;if(password.length<6)return msg('Use a password of at least 6 characters.');const {data,error}=await client.auth.signUp({email,password});if(error)return msg(error.message);if(data.session){session=data.session;offlineChosen=false;el.remove();document.getElementById('ppmCloudAccount').style.display='inline-block';await loadCloud();}else msg('Account created. Check your email to confirm it, then sign in.');};
  document.getElementById('ppmOffline').onclick=()=>{offlineChosen=true;setStatus('Local only');el.remove();};
}

function showAccount(){
  if(!session?.user)return authOverlay();
  let el=document.getElementById('ppmAuthOverlay');if(el)el.remove();
  el=document.createElement('div');el.id='ppmAuthOverlay';el.style='position:fixed;inset:0;background:rgba(15,23,42,.7);z-index:99999;display:grid;place-items:center;padding:18px';
  el.innerHTML=`<div style="width:min(420px,100%);background:white;color:#0f172a;border-radius:16px;padding:22px"><h3 style="margin-top:0">Cloud account</h3><p style="overflow-wrap:anywhere">${session.user.email||''}</p><p style="color:#64748b;font-size:13px">Sites, equipment, PPM visits, faults and history sync to Supabase. Photos remain on this device until photo storage is enabled.</p><div style="display:flex;gap:8px"><button id="ppmAccountClose" style="padding:9px 12px">Close</button><button id="ppmSignOut" style="padding:9px 12px">Sign out</button></div></div>`;
  document.body.appendChild(el);document.getElementById('ppmAccountClose').onclick=()=>el.remove();document.getElementById('ppmSignOut').onclick=async()=>{await client.auth.signOut();session=null;el.remove();document.getElementById('ppmCloudAccount').style.display='none';setStatus('Local only');authOverlay();};
}

async function init(){
  installStatus();
  const {data}=await client.auth.getSession();session=data.session;
  client.auth.onAuthStateChange((_event,newSession)=>{session=newSession;if(session){offlineChosen=false;document.getElementById('ppmCloudAccount').style.display='inline-block';}else document.getElementById('ppmCloudAccount').style.display='none';});
  if(session){document.getElementById('ppmCloudAccount').style.display='inline-block';await loadCloud();}
  else {setStatus('Local only');authOverlay();}
  window.addEventListener('online',()=>{if(session){setStatus('Cloud: reconnecting');queuePush();}});
  window.addEventListener('offline',()=>setStatus('Cloud: offline','error'));
}

setTimeout(init,0);
})();
