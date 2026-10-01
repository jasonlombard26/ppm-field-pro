(()=>{
'use strict';
if(window.__ppmSupabaseSync)return;
window.__ppmSupabaseSync=true;
const CFG=window.PPM_SUPABASE,Core=window.PPMSyncCore;
const STORAGE_KEY='ppmV3Data',META_KEY='ppmSyncJournalV1',CACHE_PREFIX='ppmAccountCacheV1:',UNASSIGNED_PREFIX='ppmUnassignedRecoveryV1:';
const originalSetItem=Storage.prototype.setItem;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const copy=value=>JSON.parse(JSON.stringify(value));
const emptyState=()=>({sites:[],assets:[],visits:[],faults:[],legacy:[],photos:[]});
let session=null,journal=null,sharedReady=false,offlineChosen=false,suppress=false,pushTimer=null;
let legacyChecked=false,legacyRecovery=null,legacyCheckError=false,cacheFrozen=true;
let running=null,rerun=false,generation=0,sessionReady=false,identityEstablished=false;
const $=id=>document.getElementById(id);
const setStatus=(text,kind='')=>{const el=$('ppmCloudStatus');if(el){el.textContent=text;el.dataset.kind=kind;el.title='Open Account to review pending changes or export a recovery copy.';}};
function reveal(){ $('ppmSyncStartupGuard')?.remove(); }
function overlay(html){
  $('ppmAuthOverlay')?.remove();
  const el=document.createElement('div');el.id='ppmAuthOverlay';
  el.style.cssText='position:fixed;inset:0;background:#0f172a;z-index:999999;display:grid;place-items:center;padding:18px;overflow:auto';
  el.innerHTML=`<div style="width:min(600px,100%);box-sizing:border-box;background:white;color:#0f172a;border-radius:16px;padding:22px;max-height:95vh;overflow:auto">${html}</div>`;
  document.body.appendChild(el);reveal();return el;
}
function fatal(message){
  sharedReady=false;sessionReady=false;cacheFrozen=true;
  const canExport=journal&&(!journal.meta.ownerId||journal.meta.ownerId===session?.user?.id);
  overlay(`<h2>Local data needs attention</h2><p>${escapeHtml(message)}</p><p>Do not clear browser data. Reload after resolving the problem.</p>${canExport?'<button id="ppmFatalExport">Export local recovery copy</button>':''}`);
  if($('ppmFatalExport'))$('ppmFatalExport').onclick=()=>exportRecovery();
}
if(!CFG?.url||!CFG?.publishableKey||!window.supabase||!Core){fatal('The cloud sync components could not load. Local data has not been changed.');return;}
const client=window.supabase.createClient(CFG.url,CFG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.ppmSupabase=client;
function persistJournal(){originalSetItem.call(localStorage,META_KEY,JSON.stringify(journal.meta));}
function replaceState(next){
  // Persist before mutating memory. A quota failure must leave the visible working copy intact.
  Core.writeCache(localStorage,next,journal.meta,(key,value)=>originalSetItem.call(localStorage,key,value));
  suppress=true;
  try{
    Object.keys(db).forEach(key=>delete db[key]);Object.assign(db,next);
    if(typeof renderAll==='function')renderAll();
    if(typeof showSitesList==='function'&&$('sites')?.classList.contains('active'))showSitesList();
  }finally{suppress=false;}
}
function installStatus(){
  if($('ppmCloudStatus'))return;
  const header=document.querySelector('header');if(!header)return;
  const wrap=document.createElement('div');wrap.style.cssText='display:flex;align-items:center;gap:6px;margin-left:auto';
  wrap.innerHTML='<span id="ppmCloudStatus" style="font-size:12px;font-weight:700;padding:6px 9px;border-radius:999px;background:#e2e8f0;color:#0f172a">Cloud: checking</span><button id="ppmCloudAccount" class="secondary" style="padding:6px 8px;font-size:12px">Account</button>';
  header.appendChild(wrap);$('ppmCloudAccount').onclick=showAccount;
}
function classify(error){
  if(error?.code==='40001')return 'conflict';
  if(error?.code==='42501')return 'permission';
  if(['42703','42P01','42883','PGRST202','55000'].includes(error?.code))return 'upgrade';
  return 'network';
}
function reportStatus(){
  if(!session){setStatus('Local only');return;}
  const issues=journal.issues(db),blocked=issues.filter(item=>item.problem!=='pending');
  if(legacyRecovery?.sites?.length&&!(db.sites||[]).length&&!issues.length){setStatus('Cloud: legacy recovery available','error');return;}
  if(legacyCheckError&&!(db.sites||[]).length&&!issues.length){setStatus('Cloud: legacy recovery check unavailable','error');return;}
  if(blocked.length)setStatus(`Cloud: review ${blocked.length} site${blocked.length===1?'':'s'}`,'error');
  else if(issues.length)setStatus(`Cloud: ${issues.length} pending`,'error');
  else setStatus('Cloud: synced','ok');
}
function queuePush(){clearTimeout(pushTimer);pushTimer=setTimeout(()=>sync(),750);}
Storage.prototype.setItem=function(key,value){
  if(this===localStorage&&key===STORAGE_KEY&&cacheFrozen&&!suppress)throw new Error('Local cache is locked until account recovery or reload');
  const result=originalSetItem.call(this,key,value);
  if(this===localStorage&&key===STORAGE_KEY&&!suppress){
    if(sessionReady&&sharedReady&&session?.user){
      journal.observeNew(JSON.parse(value));
      try{persistJournal();queuePush();}catch(error){fatal('Browser storage is full. Your last local save is retained, but sync is paused.');}
    }
  }
  return result;
};
async function reconcile(epoch){
  const userId=session.user.id;
  const [{data:rows,error},{data:members,error:memberError}]=await Promise.all([
    client.from('ppm_sites').select('id,name,site_state,revision,updated_at').order('name'),
    client.from('ppm_site_members').select('site_id,role').eq('user_id',userId)
  ]);
  if(epoch!==generation)return false;
  if(error||memberError){
    sharedReady=false;
    setStatus(classify(error||memberError)==='upgrade'?'Cloud: database upgrade required':'Cloud: unavailable; local changes retained','error');
    return false;
  }
  if(!legacyChecked){
    const {data:legacy,error:legacyError}=await client.from('ppm_app_state').select('state').eq('user_id',userId).maybeSingle();
    if(epoch!==generation)return false;
    legacyChecked=!legacyError;legacyCheckError=!!legacyError;
    if(!legacyError&&Array.isArray(legacy?.state?.sites)&&legacy.state.sites.length)legacyRecovery=copy(legacy.state);
  }
  const next=journal.reconcile(db,rows||[],members||[]);
  replaceState(next);sharedReady=true;reportStatus();return true;
}
async function sync(){
  if(!session?.user||!sessionReady||offlineChosen)return;
  if(running){rerun=true;return running;}
  const epoch=generation;
  running=(async()=>{
    try{
      // Read roles and revisions first; reconciliation never replaces dirty local data.
      if(!await reconcile(epoch))return;
      for(const pending of journal.pending(db)){
        if(epoch!==generation||!sessionReady)break;
        setStatus('Cloud: saving');
        const {data,error}=await client.rpc('ppm_save_site_state',{
          p_site_id:Number(pending.id),p_name:pending.payload.site.name||'',
          p_site_state:pending.payload,p_expected_revision:pending.expectedRevision
        });
        if(epoch!==generation)break;
        if(error){
          journal.fail(pending.id,classify(error));
          persistJournal();
          // A denied/conflicting site must not stop unrelated editable sites.
          continue;
        }
        journal.acknowledge(pending.id,pending.payload,data);persistJournal();
      }
      if(epoch===generation)reportStatus();
    }catch(error){
      if(epoch===generation)fatal('Sync paused because local storage or the cloud schema needs attention. Reload after checking available storage and the database migration.');
      console.warn('PPM sync paused:',error?.name||'Error');
    }
  })().finally(()=>{running=null;if(rerun){rerun=false;queuePush();}});
  return running;
}
function exportRecovery(legacy=false,unassignedKey=null){
  const payload=unassignedKey?{format:'ppm-unassigned-recovery-v1',state:JSON.parse(localStorage.getItem(unassignedKey))}:legacy?{format:'ppm-legacy-recovery-v1',state:legacyRecovery}:{format:'ppm-recovery-v1',state:db,sync:journal.meta};
  const blob=new Blob([JSON.stringify({...payload,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=legacy?'ppm-legacy-recovery.json':'ppm-local-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function parkAccount(){
  if(!journal.meta.ownerId)return;
  // Archive first. If storage is full, do not remove the active cache or claim success.
  originalSetItem.call(localStorage,CACHE_PREFIX+journal.meta.ownerId,JSON.stringify({state:db,meta:journal.meta}));
  const previous=journal;journal=new Core.Journal();
  try{replaceState(emptyState());}catch(error){journal=previous;throw error;}
  localStorage.removeItem('ppmActiveSiteId');
}
function unassignedKeys(){return Array.from({length:localStorage.length},(_v,index)=>localStorage.key(index)).filter(key=>key?.startsWith(UNASSIGNED_PREFIX));}
function activateAccount(userId){
  if(journal.meta.ownerId&&journal.meta.ownerId!==userId)parkAccount();
  if(!journal.meta.ownerId){
    const archived=localStorage.getItem(CACHE_PREFIX+userId);
    if(archived){
      // Never silently discard pre-login offline work when restoring an account.
      if((db.sites||[]).length){
        const raw=JSON.stringify(db);
        const existing=unassignedKeys().some(key=>localStorage.getItem(key)===raw);
        if(!existing)originalSetItem.call(localStorage,UNASSIGNED_PREFIX+crypto.randomUUID(),raw);
      }
      const restored=JSON.parse(archived);
      if(restored.meta?.ownerId!==userId)throw new Error('Account cache owner mismatch');
      journal=new Core.Journal(restored.meta);replaceState(restored.state);
    }else{journal.meta.ownerId=userId;persistJournal();}
  }
}
async function useSession(newSession){
  identityEstablished=true;cacheFrozen=true;
  generation++;sharedReady=false;sessionReady=false;clearTimeout(pushTimer);
  if(!newSession?.user){
    session=null;
    try{parkAccount();}catch(error){fatal('The account cache could not be archived. It is still saved locally. Close this tab on a shared device.');return;}
    authOverlay();setStatus('Signed out; account cache locked');return;
  }
  session=newSession;offlineChosen=false;
  try{activateAccount(session.user.id);}catch(error){fatal(error.message);return;}
  sessionReady=true;cacheFrozen=false;$('ppmAuthOverlay')?.remove();reveal();await sync();
}
function authOverlay(message=''){
  const el=overlay(`<h2>PPM Field Pro</h2><p>Sign in to open your account cache and shared sites.</p><label>Email <input id="ppmAuthEmail" type="email" autocomplete="email" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px"></label><label>Password <input id="ppmAuthPassword" type="password" autocomplete="current-password" style="width:100%;box-sizing:border-box;margin:5px 0 12px;padding:11px"></label><p id="ppmAuthMsg" style="color:#b91c1c">${escapeHtml(message)}</p><button id="ppmSignIn">Sign in</button> <button id="ppmSignUp">Create account</button> <button id="ppmOffline">Use offline only</button><p style="font-size:12px;color:#64748b">Signed-out account caches remain on this device for recovery. They are not encrypted. Offline-only mode opens only unassigned local work.</p>`);
  const authenticate=async signUp=>{
    $('ppmAuthMsg').textContent=signUp?'Creating account…':'Signing in…';
    const email=$('ppmAuthEmail').value.trim(),password=$('ppmAuthPassword').value;
    const {data,error}=await client.auth[signUp?'signUp':'signInWithPassword']({email,password});
    if(error){$('ppmAuthMsg').textContent=error.message;return;}
    if(!data.session){$('ppmAuthMsg').textContent='Check your email to confirm your account, then sign in.';return;}
    // Auth callback owns transitions, including OAuth/session recovery.
  };
  $('ppmSignIn').onclick=()=>authenticate(false);$('ppmSignUp').onclick=()=>authenticate(true);
  $('ppmOffline').onclick=()=>{cacheFrozen=false;offlineChosen=true;el.remove();setStatus('Local only; sign in before sharing');};
}
async function shareActiveSite(){
  const siteId=Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
  const email=$('ppmShareEmail')?.value.trim(),role=$('ppmShareRole')?.value||'technician',msg=$('ppmShareMsg');
  if(!siteId||!email){msg.textContent='Choose a site and enter the account email.';return;}
  if(journal.meta.sites[String(siteId)]?.role!=='admin'){msg.textContent='Only a site admin can grant access.';return;}
  msg.textContent='Sharing…';
  const {error}=await client.rpc('ppm_grant_site_access',{p_site_id:Number(siteId),p_email:email,p_role:role});
  msg.textContent=error?error.message:'Site access granted.';
}
window.ppmShareActiveSite=shareActiveSite;
const explanations={
  conflict:'The cloud has another version, or this device has no verified baseline. Your local copy is retained.',
  'read-only':'You have viewer access. Local edits cannot be uploaded.',
  unavailable:'This site is no longer returned by the server. Access may have been removed or the site deleted. It will not be recreated.',
  unconfirmed:'Existing local work has no account/version history. Review it before creating a shared site.',
  'local-deletion':'Site deletion is not synced automatically. Restore the cloud copy or contact a site admin.',
  permission:'The server denied this save. Retry after checking membership.',
  upgrade:'The server requires the reviewed database migration.',
  network:'The last save failed. Your local copy is retained; retry when connected.',
  pending:'Local changes are waiting to upload.'
};
function showAccount(){
  if(cacheFrozen)return;
  if(!session?.user)return authOverlay();
  const issues=journal.issues(db);
  const rows=issues.map(({id,problem})=>{
    const entry=journal.meta.sites[id],name=(db.sites||[]).find(site=>String(site.id)===id)?.name||entry.base?.site?.name||id;
    return `<div style="border-top:1px solid #cbd5e1;padding:12px 0"><b>${escapeHtml(name)}</b><p>${escapeHtml(explanations[problem]||problem)}</p>${entry.remote?`<button data-cloud="${id}">Use cloud copy</button> `:''}${problem==='conflict'&&['admin','technician'].includes(entry.role)?`<button data-local="${id}">Replace cloud with local copy</button>`:''}${problem==='unconfirmed'?`<button data-create="${id}">Create shared site from local copy</button>`:''}</div>`;
  }).join('');
  const unassignedNotice=unassignedKeys().map((key,index)=>`<p>Offline recovery copy ${index+1}: <button data-unassigned="${escapeHtml(key)}">Export preserved offline work</button></p>`).join('');
  const legacyNotice=legacyRecovery?.sites?.length?'<hr><h4>Legacy account data is available</h4><p>Your older account backup is preserved in the legacy table. Export it for review. On an empty device you can restore a local copy, then explicitly approve each new shared site.</p><button id="ppmExportLegacy">Export legacy copy</button> <button id="ppmRestoreLegacy">Restore legacy copy for review</button>':'';
  const el=overlay(`<h3>Cloud account</h3><p>${escapeHtml(session.user.email||'')}</p><button id="ppmExportRecovery">Export local recovery copy</button> <button id="ppmRetrySync">Retry sync</button>${rows||'<p>No pending shared-site changes.</p>'}${legacyNotice}${unassignedNotice}<hr><h4>Share active site</h4><input id="ppmShareEmail" type="email" placeholder="Existing account email"><select id="ppmShareRole"><option value="technician">Technician</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select><button id="ppmShareBtn">Grant access</button><p id="ppmShareMsg"></p><p style="font-size:12px;color:#64748b">Signing out hides this account’s cache and preserves unsynced work for its next sign-in. Cache and recovery exports are plaintext. Use a trusted device; sign-out is not secure erasure.</p><button id="ppmAccountClose">Close</button> <button id="ppmSignOut">Sign out</button>`);
  $('ppmExportRecovery').onclick=()=>exportRecovery();
  for(const button of el.querySelectorAll('[data-unassigned]'))button.onclick=()=>exportRecovery(false,button.dataset.unassigned);
  if($('ppmExportLegacy'))$('ppmExportLegacy').onclick=()=>exportRecovery(true);
  if($('ppmRestoreLegacy'))$('ppmRestoreLegacy').onclick=async()=>{
    if(running)return alert('Sync is still running. Wait for it to finish, then review again.');
    if((db.sites||[]).length||Object.keys(journal.meta.sites).length)return alert('Restore requires an empty device with no tracked or recovery sites. Export the legacy copy and current recovery copy for manual review.');
    if(!confirm('Restore the legacy account backup into this device for review? No shared sites will be uploaded until you explicitly approve them.'))return;
    try{const next=journal.reconcile(copy(legacyRecovery),[],[]);replaceState(next);legacyRecovery=null;reportStatus();showAccount();}catch(error){fatal('Legacy data could not be restored. The original legacy row has not been changed.');}
  };
  $('ppmRetrySync').onclick=async()=>{el.remove();await sync();showAccount();};
  $('ppmShareBtn').onclick=shareActiveSite;$('ppmAccountClose').onclick=()=>el.remove();
  for(const button of el.querySelectorAll('[data-cloud]'))button.onclick=()=>{
    if(running)return alert('Sync is still running. Wait for it to finish, then review again.');
    if(!confirm('Discard this site’s local edits and use the cloud copy? Export a recovery copy first if you need to keep them.'))return;
    try{const next=journal.chooseCloud(db,button.dataset.cloud);replaceState(next);showAccount();reportStatus();}catch(error){fatal(error.message);}
  };
  for(const button of el.querySelectorAll('[data-local]'))button.onclick=async()=>{
    if(running)return alert('Sync is still running. Wait for it to finish, then review again.');
    if(!confirm('Replace the last reviewed cloud version of this entire site with your local copy? Other people’s changes in that version will be replaced. Export a recovery copy before continuing.'))return;
    journal.chooseLocal(button.dataset.local);persistJournal();el.remove();await sync();showAccount();
  };
  for(const button of el.querySelectorAll('[data-create]'))button.onclick=async()=>{
    if(running)return alert('Sync is still running. Wait for it to finish, then review again.');
    if(!confirm('Upload this complete local site to the signed-in account as a new shared site? Confirm this account is authorised to hold its data. Existing cloud IDs will be rejected.'))return;
    journal.approveCreation(button.dataset.create);persistJournal();el.remove();await sync();showAccount();
  };
  $('ppmSignOut').onclick=async()=>{
    clearTimeout(pushTimer);generation++;sessionReady=false;cacheFrozen=true;
    try{parkAccount();}catch(error){sessionReady=true;fatal('Not signed out: storage could not preserve your account cache. Free space or export your work first.');return;}
    const {error}=await client.auth.signOut();
    if(error){await useSession(session);showAccount();alert('Sign-out failed. Please reconnect and try again.');return;}
    // Reload clears rendered records, open previews and in-memory signed-URL caches.
    location.reload();
  };
}
async function init(){
  installStatus();overlay('<h2>Opening local cache…</h2>');
  try{
    Core.recoverStorage(localStorage,(key,value)=>originalSetItem.call(localStorage,key,value));
    journal=new Core.Journal(JSON.parse(localStorage.getItem(META_KEY)||'{}'));
    const persistedState=localStorage.getItem(STORAGE_KEY);
    if(persistedState){suppress=true;Object.keys(db).forEach(key=>delete db[key]);Object.assign(db,JSON.parse(persistedState));suppress=false;}
    let authEvents=0;
    client.auth.onAuthStateChange((event,newSession)=>{
      const eventNumber=++authEvents;
      if(identityEstablished&&newSession?.user?.id===session?.user?.id){session=newSession;return;}
      if(identityEstablished){
        // Reload on every identity boundary to dispose of old photo requests,
        // signed-URL caches, record dialogs and other feature-module closures.
        generation++;sessionReady=false;cacheFrozen=true;clearTimeout(pushTimer);session=newSession;
        overlay('<h2>Closing the account cache…</h2>');
        setTimeout(()=>{
          try{parkAccount();location.reload();}
          catch(error){fatal('The account cache could not be preserved. Do not clear browser data; close this tab on a shared device.');}
        },0);
        return;
      }
      // Never await additional Auth calls inside the Supabase callback.
      setTimeout(()=>{if(eventNumber===authEvents&&!identityEstablished)useSession(newSession);},0);
    });
    const {data,error}=await client.auth.getSession();if(error)throw error;
    if(!authEvents)await useSession(data.session);
  }catch(error){fatal('The saved account cache could not be opened. Do not clear browser data.');}
  window.addEventListener('online',()=>sync());
  window.addEventListener('offline',()=>setStatus('Cloud: offline; local changes retained','error'));
}
// A single writer prevents two tabs from overwriting each other's offline cache.
// The lock is held until this page closes; no timers or network lease is involved.
if(window.__ppmOwnsCacheLock){
  init();
}else if(navigator.locks?.request){
  navigator.locks.request('ppm-local-cache-writer',{ifAvailable:true},async lock=>{
    if(!lock){overlay('<h2>PPM Field Pro is open in another tab</h2><p>Close the other PPM tab, then reload this one to protect offline changes.</p>');return;}
    await init();await new Promise(()=>{});
  }).catch(()=>fatal('The browser could not lock the local cache. Close other PPM tabs and reload.'));
}else fatal('This browser needs Web Locks support to protect the offline cache. Use a current supported browser.');
})();
