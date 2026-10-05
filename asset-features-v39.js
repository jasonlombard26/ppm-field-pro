/* Site assets keep their existing IDs, photos and JSON fields. No destructive migration. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sid=()=>Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
const asset=id=>(db.assets||[]).find(a=>String(a.id)===String(id)&&Number(a.siteId)===sid());
const access=id=>window.ppmSiteAccess?.(id)||{editable:false,cloud:false};
const allowed=id=>{if(access(id).editable)return true;alert('This site is read-only or needs Account review.');return false;};
const copy=x=>JSON.parse(JSON.stringify(x));
const uid=()=>{let id=Date.now();while((db.assets||[]).some(a=>Number(a.id)===id))id++;return id;};
const heads=()=> (db.assets||[]).filter(a=>Number(a.siteId)===sid()&&(a.headEnd===true||a.recordType==='headEnd'));
const isInput=a=>String(a.subtype||'').toLowerCase()==='input'||!!a.importSource;
// Vendor profiles deliberately use verified labels only. Unknown keys fall back to Generic.
const generic={input:'Input',inputNumber:'Input number',moduleType:'Module type',moduleNumber:'Module number',area:'Intrusion Area'};
const profiles={Generic:{...generic},Integriti:{...generic,input:'Zone Input',inputNumber:'Zone input number',area:'Area'},Gallagher:{...generic,area:'Alarm Zone'}};
function labels(a){const h=(a?.headEnd||a?.recordType==='headEnd')? a:asset(a?.headEndId);return Object.hasOwn(profiles,h?.platform)?profiles[h.platform]:profiles.Generic;}
window.ppmTerminology=labels;
function commit(change){
 const next=copy(db);change(next);
 // Persist through the existing sync hook BEFORE changing the live copy.
 localStorage.setItem('ppmV3Data',JSON.stringify(next));
 Object.assign(db,next);
}
function persist(change){try{commit(change);return true;}catch(e){console.error(e);alert('Changes could not be saved locally. Free storage and reload; do not clear browser data.');return false;}}
const field=(id,label,value='')=>`<label for="${id}">${esc(label)}</label><input id="${id}" value="${esc(value)}">`;
const value=id=>$(id)?.value?.trim()||'';
const arg=id=>esc(JSON.stringify(id===0?0:String(id)));
function systemSelect(a,id='ppmSystem'){
 const missing=a?.headEndId&&!heads().some(h=>String(h.id)===String(a.headEndId));
 return `<label for="${id}">Head-end system</label><select id="${id}"><option value="">Unassigned</option>${missing?`<option value="${esc(a.headEndId)}" selected>Unavailable system reference (${esc(a.headEndId)})</option>`:''}${heads().map(h=>`<option value="${esc(h.id)}" ${String(a?.headEndId)===String(h.id)?'selected':''}>${esc(h.name)} (${esc(h.platform||'Generic')})</option>`).join('')}</select>`;
}
function bindSystemLabels(fields){
 const selector=$('ppmSystem');if(!selector)return;
 selector.onchange=()=>{const l=labels({headEndId:selector.value});for(const [id,key] of Object.entries(fields)){const el=$(id),label=document.querySelector(`label[for="${id}"]`)||el?.previousElementSibling;if(label?.tagName==='LABEL')label.textContent=l[key];}};
}
let current={siteId:null,tab:'info'},renderToken=0;
function refresh(){if(current.siteId===sid())window.renderSiteDetailV7(current.siteId,current.tab);}
window.ppmInputForm=id=>{
 const a=id?asset(id):{siteId:sid()};if(!a||!allowed(a.siteId))return;
 const l=labels(a);
 modal(id?'Edit Input':'Add Input',field('ppmInputName','Name',a.name)+field('ppmInputNumber',l.inputNumber,a.pointId)+field('ppmModuleType',l.moduleType,a.moduleType)+field('ppmModuleNumber',l.moduleNumber,a.moduleNumber)+field('ppmContactIdCode','Contact ID reporting code',a.contactIdReportingCode)+
   (a.module?`<p>Legacy module (retained): ${esc(a.module)}</p>`:'')+field('ppmInputArea',l.area,a.area)+systemSelect(a)+`<button class=primary onclick="ppmSaveInput(${arg(id||0)})">Save Input</button>`);
 bindSystemLabels({ppmInputNumber:'inputNumber',ppmInputArea:'area',ppmModuleType:'moduleType',ppmModuleNumber:'moduleNumber'});
};
window.ppmSaveInput=id=>{
 const a=id?asset(id):{id:uid(),siteId:sid(),system:'Intrusion',subtype:'Input'};if(!a||!allowed(a.siteId))return;
 const changes={name:value('ppmInputName'),pointId:value('ppmInputNumber'),moduleType:value('ppmModuleType'),moduleNumber:value('ppmModuleNumber'),contactIdReportingCode:value('ppmContactIdCode'),area:value('ppmInputArea'),headEndId:value('ppmSystem')};
 if(!persist(next=>{if(id)Object.assign(next.assets.find(x=>x.id===a.id),changes);else next.assets.push({...a,...changes});}))return;
 closeModal();refresh();
};
window.ppmHeadForm=id=>{
 const a=id?asset(id):{siteId:sid(),platform:'Generic',appliesTo:['access','intrusion']};if(!a||!allowed(a.siteId))return;
 modal(id?'Edit Shared Head End':'Add Head-end System',field('ppmHeadName','System name',a.name)+field('ppmHeadType','System type / model',a.headEndType||a.model)+field('ppmHeadLocation','Location',a.location)+
 `<label>Platform / terminology</label><select id=ppmPlatform>${Object.keys(profiles).map(p=>`<option ${p===(a.platform||'Generic')?'selected':''}>${p}</option>`).join('')}${a.platform&&!Object.hasOwn(profiles,a.platform)?`<option selected>${esc(a.platform)}</option>`:''}</select><p class=tiny>Terminology only; does not configure hardware.</p>`+
 ['access','intrusion'].map(k=>`<label><input id="ppmApply_${k}" type=checkbox ${(a.appliesTo||(/access/i.test(a.system||'')?['access']:/intrusion|alarm/i.test(a.system||'')?['intrusion']:[])).includes(k)?'checked':''}> ${k==='access'?'Access Control':'Intrusion'}</label>`).join('')+
 `<label>Notes</label><textarea id=ppmHeadNotes>${esc(a.notes)}</textarea><button class=primary onclick="ppmSaveHead(${arg(id||0)})">Save System</button>`);
};
window.ppmSaveHead=id=>{
 const a=id?asset(id):{id:uid(),siteId:sid(),recordType:'headEnd',system:'Head End'};if(!a||!allowed(a.siteId))return;
 const name=value('ppmHeadName');if(!name)return alert('Enter a system name.');
 const changes={headEnd:true,name,headEndType:value('ppmHeadType'),location:value('ppmHeadLocation'),platform:value('ppmPlatform'),notes:value('ppmHeadNotes'),appliesTo:['access','intrusion'].filter(k=>$('ppmApply_'+k).checked)};
 // Freeze the historical photo folder when an existing asset becomes a head end.
 if(!a.photoSection)changes.photoSection=window.ppmPhotoSection(a);
 if(!persist(next=>{if(id)Object.assign(next.assets.find(x=>x.id===a.id),changes);else next.assets.push({...a,...changes});}))return;
 closeModal();refresh();
};
window.ppmUseExistingHead=()=>{
 if(!allowed(sid()))return;
 modal('Use Existing Asset as Head End',`<p>Select the actual system record. Its ID, details and files will be retained. Distinct or potentially duplicate records are not merged.</p><select id=ppmExistingHead>${(db.assets||[]).filter(a=>Number(a.siteId)===sid()).map(a=>`<option value="${esc(a.id)}">${esc(a.name||a.pointId||a.subtype)} — ${esc(a.system)} (#${arg(a.id)})</option>`).join('')}</select><button class=primary onclick="ppmHeadForm(document.getElementById('ppmExistingHead').value)">Review System</button>`);
};
window.ppmAssignSystem=id=>{const a=asset(id);if(!a||!allowed(a.siteId))return;modal('Assign Head-end System',systemSelect(a)+`<button class=primary onclick="ppmSaveSystemLink(${arg(a.id)})">Save</button>`);};
window.ppmSaveSystemLink=id=>{const a=asset(id);if(!a||!allowed(a.siteId))return;const headEndId=value('ppmSystem');if(headEndId&&!heads().some(h=>String(h.id)===headEndId))return; if(persist(next=>Object.assign(next.assets.find(x=>x.id===a.id),{headEndId}))){closeModal();refresh();}};
window.ppmBackupSystemSelect=()=>systemSelect({},'ppmBackupHead');
window.ppmLinkBackupPath=(siteId,path,headId)=>{
 if(!allowed(siteId)||Number(siteId)!==sid())return false;
 if(headId&&!heads().some(h=>String(h.id)===String(headId)))return false;
 return persist(next=>{
  next.headEndBackupLinks=(next.headEndBackupLinks||[]).filter(x=>!(Number(x.siteId)===Number(siteId)&&x.cloudPath===path));
  if(headId)next.headEndBackupLinks.push({siteId:Number(siteId),assetRef:String(headId),cloudPath:path});
 });
};
window.ppmLinkBackupV39=encodedName=>{
 if(!allowed(sid()))return;
 const name=decodeURIComponent(encodedName),path=`sites/${sid()}/head-end/backups/${name}`;
 const linked=(db.headEndBackupLinks||[]).find(x=>Number(x.siteId)===sid()&&x.cloudPath===path);
 modal('Assign Existing Backup',`<p>${esc(name)}</p>${systemSelect({headEndId:linked?.assetRef})}<button id=ppmLinkBackupSave class=primary>Save</button>`);
 const siteId=sid();$('ppmLinkBackupSave').onclick=()=>{if(window.ppmLinkBackupPath(siteId,path,value('ppmSystem'))){closeModal();refresh();}};
};
window.ppmHeadBackups=id=>{const a=asset(id);if(!a)return;window.renderSiteDetailV7(a.siteId,'headend');setTimeout(()=>window.ppmRenderBackupsV34(a.siteId,a.id),0);};

// Existing intrusion device forms keep their data model and receive per-system terminology.
const oldIntrusionForm=window.intrusionDeviceFormV10;
window.intrusionDeviceFormV10=id=>{
 const a=id?asset(id):{};if(!a||!allowed(a.siteId||sid()))return;
 oldIntrusionForm(id);const input=$('n10IntrusionArea');if(input)input.insertAdjacentHTML('afterend',systemSelect(a));
 bindSystemLabels({n10IntrusionInputNumber:'inputNumber',n10IntrusionArea:'area'});
};
window.saveIntrusionDeviceV10=id=>{
 const a=id?asset(id):{id:uid(),siteId:sid()};if(!a||!allowed(a.siteId))return;
 const inputNumber=value('n10IntrusionInputNumber'),deviceType=value('n10IntrusionDeviceType');
 const changes={system:'Intrusion',subtype:'Intrusion Device',recordType:'intrusionDevice',inputNumber,pointId:inputNumber,deviceType,name:deviceType||`Intrusion Device ${inputNumber}`.trim(),location:value('n10IntrusionLocation'),area:value('n10IntrusionArea'),headEndId:value('ppmSystem')};
 if(persist(next=>{if(id)Object.assign(next.assets.find(x=>x.id===a.id),changes);else next.assets.push({...a,...changes});})){closeModal();refresh();}
};

const MAX_FILE=2*1024*1024,MAX_QUEUE=3*1024*1024;
const types=['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'];
const readFile=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
window.addDevicePhotoV7=id=>{const a=asset(id);if(!a||!allowed(a.siteId))return;modal('Add Asset Photos',`<p>${esc(a.name||a.pointId||a.subtype)}</p><label>Label</label><input id=n7PhotoType value="Device"><label>Comment</label><textarea id=n7PhotoComment></textarea><label>Choose photos (up to 2 MB each)</label><input id=n7PhotoFile type=file accept="${types.join(',')}" multiple><p class=tiny>Photos are saved on this device first. Use Refresh / upload pending photos when connected. Pending photos are included in local recovery exports.</p><button id=ppmPhotoSave class=primary onclick="saveDevicePhotoV7(${arg(a.id)})">Save Photos</button>`);};
window.saveDevicePhotoV7=async id=>{
 const a=asset(id);if(!a||!allowed(a.siteId))return;
 const files=Array.from($('n7PhotoFile')?.files||[]),label=value('n7PhotoType')||'Device',comment=value('n7PhotoComment');
 if(!files.length)return alert('Choose at least one photo.');
 if(files.some(f=>!types.includes(f.type)||f.size>MAX_FILE))return alert('Use JPEG, PNG, WebP, GIF, HEIC or HEIF photos no larger than 2 MB each.');
 const before=access(a.siteId),button=$('ppmPhotoSave');if(button)button.disabled=true;
 try{
  const items=await Promise.all(files.map(async f=>{const token=crypto.randomUUID(),ext=types.indexOf(f.type);return {id:token,siteId:a.siteId,assetRef:String(a.id),label,comment,data:await readFile(f),mimeType:f.type,createdAt:new Date().toISOString(),pendingUpload:true,uploadPath:`sites/${a.siteId}/${window.ppmPhotoSection(a)}/${a.id}/${token}__${encodeURIComponent(label.replace(/[^a-zA-Z0-9 -]/g,'').slice(0,60)||'Device')}__photo.${['jpg','png','webp','gif','heic','heif'][ext]}`};}));
  const now=access(a.siteId);if(!now.editable||now.owner!==before.owner||now.generation!==before.generation||!asset(id))return;
  const size=(db.photos||[]).filter(p=>p.pendingUpload).concat(items).reduce((sum,p)=>sum+(p.data?.length||0),0);
  if(size>MAX_QUEUE)return alert('Pending photos exceed the 3 MB local queue. Upload pending photos first or choose smaller images.');
  if(!persist(next=>{next.photos=(next.photos||[]).concat(items);}))return;
  closeModal();refresh();await uploadPending(a.siteId);
 }catch(e){console.error(e);alert('Photos could not be read or uploaded. Saved pending photos remain on this device.');}finally{if(button)button.disabled=false;}
};
let uploading=false;
window.ppmPhotosUploading=()=>uploading;
async function uploadPending(siteId){
 if(uploading||!access(siteId).cloud||navigator.onLine===false)return;uploading=true;
 let changed=false;
 try{for(const p of (db.photos||[]).filter(p=>Number(p.siteId)===Number(siteId)&&p.pendingUpload)){
  const before=access(siteId);if(!before.cloud)break;
  if(!String(p.data||'').startsWith('data:image/')||!String(p.uploadPath||'').startsWith(`sites/${siteId}/`)||String(p.uploadPath).split('/')[3]!==String(p.assetRef))continue;
  const file=await (await fetch(p.data)).blob();
  const ready=access(siteId);if(!ready.cloud||ready.owner!==before.owner||ready.generation!==before.generation)break;
  if(file.size>MAX_FILE||!types.includes(file.type))continue;
  const bucket=window.ppmSupabase.storage.from('ppm-photos');
  const {error}=await bucket.upload(p.uploadPath,file,{upsert:false,contentType:p.mimeType});
  if(error){
   // A crash may occur after Storage accepted this UUID path but before cache acknowledgement.
   // Verify the existing object before acknowledging; never overwrite it.
   if(String(error.statusCode)!=='409'&&error.error!=='Duplicate'){console.warn('Pending photo upload failed',error);continue;}
   const slash=p.uploadPath.lastIndexOf('/'),name=p.uploadPath.slice(slash+1);
   const found=await bucket.list(p.uploadPath.slice(0,slash),{search:name,limit:100});
   if(found.error||!found.data?.some(f=>f.name===name&&Number(f.metadata?.size)===file.size))continue;
  }
  const now=access(siteId);if(!now.cloud||now.owner!==before.owner||now.generation!==before.generation)break;
  // The durable path is retained even if a signed URL is temporarily unavailable.
  const {data}=await window.ppmSupabase.storage.from('ppm-photos').createSignedUrl(p.uploadPath,3600);
  const after=access(siteId);if(!after.editable||after.owner!==before.owner||after.generation!==before.generation)break;
  if(!persist(next=>{const target=next.photos.find(x=>x.id===p.id);if(target)Object.assign(target,{cloudPath:p.uploadPath,cloudShared:true,pendingUpload:false,data:data?.signedUrl||p.data});}))break;
  changed=true;
 }}finally{uploading=false;if(changed&&sid()===Number(siteId))refresh();}
}
window.addEventListener('online',()=>uploadPending(sid()).catch(error=>console.warn('Pending photos retained after reconnect',error)));
window.ppmRefreshAssetPhotos=async()=>{
 const siteId=sid();try{await uploadPending(siteId);
 for(const a of (db.assets||[]).filter(a=>Number(a.siteId)===siteId)){
  if(sid()!==siteId)break;
  await window.ppmDiscoverAssetPhotos(a);
  // Earlier photo modules put unspecified categories in access-control. Keep those discoverable.
  if(window.ppmPhotoSection(a)!=='access-control'&&!/cctv|intrusion|alarm/i.test(a.system||''))await window.ppmDiscoverAssetPhotos({...a,photoSection:'access-control'});
 }
 }catch(e){console.warn(e);alert('Photo refresh could not finish. Pending photos remain saved locally.');}
 if(sid()===siteId)refresh();
};
function headCards(tab){
 const list=heads().filter(a=>tab==='headend'||a.appliesTo?.includes(tab));
 return `<div class=card data-ppm-heads><h3>Shared Head-end Systems</h3>${access(sid()).editable?'<button class=primary onclick="ppmHeadForm()">+ Add System</button> <button class=secondary onclick="ppmUseExistingHead()">Use Existing Asset</button>':''}${list.map(a=>`<div class=card><b>${esc(a.name)}</b><p>${esc(a.headEndType||a.model)} · ${esc(a.location)} · ${esc(a.platform||'Generic')}</p><p>${esc((a.appliesTo||[]).map(k=>k==='access'?'Access Control':'Intrusion').join(' / '))}</p><p>${esc(a.notes)}</p>${access(a.siteId).editable?`<button class=secondary onclick="ppmHeadForm(${arg(a.id)})">Edit System</button>`:''} <button class=secondary onclick="ppmAssetGallery(${arg(a.id)})">Photos</button> <button class=secondary onclick="ppmHeadBackups(${arg(a.id)})">Backups</button></div>`).join('')||'<p>No shared systems assigned.</p>'}</div>`;
}
window.ppmAssetGallery=id=>{
 const a=asset(id);if(!a)return;
 const photos=(db.photos||[]).filter(p=>Number(p.siteId)===Number(a.siteId)&&String(p.assetRef)===String(id));
 modal('Asset Photos',`<div data-ppm-gallery="${esc(a.id)}"><h3>${esc(a.name||a.pointId||a.subtype)}</h3>${photos.map(p=>`<div><img src="${esc(p.data||'')}" alt="${esc(p.label)}" style="max-width:100%;max-height:260px"><p>${esc(p.label)} ${p.pendingUpload?'(pending upload)':''}</p><button class=secondary data-photo-action="${esc(p.id)}">Options</button></div>`).join('')||'<p>No photos yet.</p>'}${access(a.siteId).editable?`<button class=primary onclick="addDevicePhotoV7(${arg(a.id)})">Add Photos</button>`:''}</div>`);
 document.querySelectorAll('[data-photo-action]').forEach(b=>b.onclick=()=>window.openPhotoActionsV15(b.dataset.photoAction));
};
function decorate(siteId,tab,token){
 if(token!==renderToken||sid()!==Number(siteId))return;
 const root=$('sites');if(!root||root.dataset.mode!=='detail')return;
 if(['headend','access','intrusion'].includes(tab)){
  if(tab==='headend')Array.from(root.children).find(el=>el.classList.contains('card')&&el.querySelector('h3')?.textContent==='Head End')?.remove();
  root.querySelector('[data-ppm-heads]')?.remove();
  const host=document.createElement('div');host.innerHTML=headCards(tab);root.appendChild(host.firstElementChild);
 }
 const assets=(db.assets||[]).filter(a=>Number(a.siteId)===Number(siteId));
 const rows=assets.filter(a=>tab==='info'||tab==='headend'&&heads().includes(a)||tab==='access'&&(/access|eacs/i.test(a.system||'')||a.appliesTo?.includes('access'))||tab==='intrusion'&&(/intrusion|alarm|ids/i.test(a.system||'')||isInput(a)||a.appliesTo?.includes('intrusion'))||tab==='cctv'&&/cctv/i.test(a.system||'')||tab==='batteries'&&/batter|power/i.test(`${a.system} ${a.subtype}`));
 root.querySelector('[data-ppm-assets]')?.remove();
 const host=document.createElement('div');host.className='card';host.dataset.ppmAssets='1';
 host.innerHTML=`<h3>${tab==='info'?'All Site Assets':'Asset Photos'}</h3><button class=secondary onclick="ppmRefreshAssetPhotos()">Refresh / upload pending photos</button><p class=tiny>All categories, including legacy and unclassified equipment, are available under Site Information.</p>${rows.map(a=>`<div style="padding:8px 0;border-bottom:1px solid #ddd"><b>${esc(a.name||a.pointId||a.subtype||'Asset')}</b> · ${esc(a.system)} · ${esc(a.subtype)} <button class=secondary onclick="ppmAssetGallery(${arg(a.id)})">Photos (${(db.photos||[]).filter(p=>Number(p.siteId)===Number(a.siteId)&&String(p.assetRef)===String(a.id)).length})</button>${access(a.siteId).editable?` <button class=secondary onclick="ppmAssignSystem(${arg(a.id)})">Assign System</button>${isInput(a)?` <button class=secondary onclick="ppmInputForm(${arg(a.id)})">Edit ${esc(labels(a).input)}</button>`:''}`:''}${isInput(a)?`<p>${esc(labels(a).moduleType)}: ${esc(a.moduleType||'—')} · ${esc(labels(a).moduleNumber)}: ${esc(a.moduleNumber||'—')}</p>`:''}</div>`).join('')}`;
 root.appendChild(host);
}
const oldRender=window.renderSiteDetailV7;
window.ppmRefreshAssetView=(siteId,tab)=>{if(Number(siteId)===sid()&&current.siteId===sid()&&current.tab===tab)refresh();};
window.renderSiteDetailV7=function(siteId,tab='info'){
 current={siteId:Number(siteId),tab};const token=++renderToken;
 const result=oldRender.apply(this,arguments);setTimeout(()=>decorate(siteId,tab,token),0);return result;
};
window.PPMAssetFeatures={refresh,profiles,labels,heads,isInput,commit,uploadPending,limits:{MAX_FILE,MAX_QUEUE}};
})();
