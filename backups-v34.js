(()=>{
if(window.__ppmBackupsV34)return;window.__ppmBackupsV34=true;
const BUCKET='ppm-backups';
const $=id=>document.getElementById(id);
const activeId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||window.db?.sites?.[0]?.id;
const safe=s=>String(s||'backup').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'backup';
const esc=v=>typeof window.esc==='function'?window.esc(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const folder=sid=>`sites/${sid}/head-end/backups`;

async function signed(path){
 const c=window.ppmSupabase;if(!c)return '';
 const {data,error}=await c.storage.from(BUCKET).createSignedUrl(path,900);
 if(error){console.warn('Backup signed URL failed',error);return '';}
 return data?.signedUrl||'';
}

async function listBackups(siteId){
 const c=window.ppmSupabase;if(!c)return {files:[],error:'Sign in to view shared backups.'};
 const {data:sessionData}=await c.auth.getSession();if(!sessionData?.session)return {files:[],error:'Sign in to view shared backups.'};
 const {data,error}=await c.storage.from(BUCKET).list(folder(siteId),{limit:200,sortBy:{column:'created_at',order:'desc'}});
 if(error)return {files:[],error:error.message};
 return {files:(data||[]).filter(f=>f?.name&&!f.name.endsWith('.emptyFolderPlaceholder')),error:''};
}

async function renderBackups(siteId){
 const body=$('siteTabBodyV6')||$('sites');if(!body)return;
 let host=$('ppmBackupsV34');
 if(!host){host=document.createElement('div');host.id='ppmBackupsV34';host.className='card';host.style.marginTop='12px';body.appendChild(host);}
 host.innerHTML='<h3 style="margin-top:0">Backups</h3><div class="tiny muted">Loading shared site backups…</div>';
 const {files,error}=await listBackups(siteId);
 const rows=files.length?files.map(f=>`<div style="padding:10px 0;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>${esc(f.name.replace(/^\d+__/,'').replace(/__/g,' '))}</b><div class="tiny muted">${f.created_at?new Date(f.created_at).toLocaleString('en-AU'):''}${Number.isFinite(f.metadata?.size)?` · ${Math.max(1,Math.round(f.metadata.size/1024))} KB`:''}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class=secondary onclick="openBackupV34('${encodeURIComponent(f.name)}')">Open</button><button class=secondary onclick="deleteBackupV34('${encodeURIComponent(f.name)}')">Delete</button></div></div>`).join(''):'<div class=notice>No backup files uploaded for this site yet.</div>';
 host.innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><h3 style="margin:0">Backups</h3><div class="tiny muted">Private customer system backup files shared with authorised site users.</div></div><button class=primary onclick="uploadBackupFormV34()">+ Upload Backup</button></div>${error?`<div class=notice style="margin-top:10px">${esc(error)}</div>`:`<div style="margin-top:12px">${rows}</div>`}`;
}

window.uploadBackupFormV34=()=>{
 const sid=activeId();
 if(!sid)return alert('Select a site first.');
 if(typeof modal!=='function')return alert('Upload form unavailable.');
 modal('Upload Site Backup',`<p class=muted>Store a customer security-system backup against this site.</p><label>System / Type</label><select id=v34BackupType><option>Access Control</option><option>Intrusion</option><option>CCTV / NVR</option><option>Other</option></select><label>Description</label><input id=v34BackupLabel placeholder="e.g. Integriti database backup"><label>Backup file</label><input id=v34BackupFile type=file><br><br><button id=v34BackupSave class=primary onclick="saveBackupV34()">Upload Backup</button>`);
};

window.saveBackupV34=async()=>{
 const file=$('v34BackupFile')?.files?.[0];if(!file)return alert('Choose a backup file first.');
 const c=window.ppmSupabase;if(!c)return alert('Sign in before uploading a shared backup.');
 const {data:sessionData}=await c.auth.getSession();if(!sessionData?.session)return alert('Sign in before uploading a shared backup.');
 const sid=activeId(),type=$('v34BackupType')?.value||'Other',label=$('v34BackupLabel')?.value.trim()||file.name;
 const ext=(file.name.match(/\.[a-zA-Z0-9._-]+$/)||[''])[0];
 const path=`${folder(sid)}/${Date.now()}__${safe(type)}__${safe(label)}${ext&&!safe(label).toLowerCase().endsWith(ext.toLowerCase())?ext:''}`;
 const btn=$('v34BackupSave');if(btn){btn.disabled=true;btn.textContent='Uploading…';}
 const {error}=await c.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
 if(error){if(btn){btn.disabled=false;btn.textContent='Upload Backup';}console.error(error);return alert(`Backup upload failed: ${error.message}`);}
 if(typeof closeModal==='function')closeModal();await renderBackups(sid);
};

window.openBackupV34=async encodedName=>{
 const name=decodeURIComponent(encodedName),path=`${folder(activeId())}/${name}`,url=await signed(path);
 if(!url)return alert('Backup could not be opened. Check your site access and connection.');
 window.open(url,'_blank','noopener');
};

window.deleteBackupV34=async encodedName=>{
 const name=decodeURIComponent(encodedName);if(!confirm(`Delete backup ${name.replace(/^\d+__/,'')}?`))return;
 const c=window.ppmSupabase;if(!c)return;
 const {error}=await c.storage.from(BUCKET).remove([`${folder(activeId())}/${name}`]);
 if(error)return alert(`Backup could not be deleted: ${error.message}`);
 await renderBackups(activeId());
};

const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function')window.renderSiteDetailV7=function(siteId,tab='info'){
 const result=oldRender.call(this,siteId,tab);
 if(tab==='headend')setTimeout(()=>renderBackups(Number(siteId)),0);
 return result;
};
setTimeout(()=>{const sec=$('sites');if(sec?.dataset?.mode==='detail'){}},0);
})();
