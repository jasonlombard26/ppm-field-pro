(()=>{
if(window.__ppmBatteryPhotosV28)return;window.__ppmBatteryPhotosV28=true;
const BUCKET='ppm-photos';
const $=id=>document.getElementById(id);
const isMobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
const activeSiteId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
const client=()=>window.ppmSupabase;
const safe=s=>(s||'photo').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'photo';
const isBattery=a=>/batter|power/i.test(`${a?.system||''} ${a?.subtype||''}`);
const folderFor=(siteId,assetId)=>`sites/${siteId}/batteries/${assetId}`;

async function signedUrl(path){
 const c=client();if(!c)return '';
 const {data,error}=await c.storage.from(BUCKET).createSignedUrl(path,3600);
 if(error){console.warn('Battery photo signed URL failed',error);return '';}
 return data?.signedUrl||'';
}
function labelFromName(name){
 const parts=String(name||'').split('__');
 if(parts.length>2){try{return decodeURIComponent(parts[1]).replace(/-/g,' ')}catch(e){return parts[1].replace(/-/g,' ')}}
 return 'Battery photo';
}
async function discoverBatteryPhotos(siteId){
 const c=client();if(!c)return false;
 const assets=(db.assets||[]).filter(a=>Number(a.siteId)===Number(siteId)&&isBattery(a));
 db.photos=db.photos||[];let changed=false;
 for(const asset of assets){
  const folder=folderFor(siteId,asset.id);
  const {data,error}=await c.storage.from(BUCKET).list(folder,{limit:100,sortBy:{column:'created_at',order:'desc'}});
  if(error){console.warn('Battery photo list failed',error);continue;}
  for(const f of data||[]){
   if(!f?.name||!f.id||!/[.](jpe?g|png|webp|gif|heic|heif)$/i.test(f.name))continue;
   const path=`${folder}/${f.name}`;
   let p=db.photos.find(x=>x.cloudPath===path);
   if(!p){p={id:`cloud:${f.id||path}`,siteId:Number(siteId),assetRef:String(asset.id),label:labelFromName(f.name),comment:'',cloudPath:path,createdAt:f.created_at||f.updated_at||new Date().toISOString(),cloudShared:true};db.photos.push(p);changed=true;}
   if(!p.data){const u=await signedUrl(path);if(u){p.data=u;p.cloudSignedUrl=true;changed=true;}}
  }
 }
 return changed;
}

const oldSave=window.saveDevicePhotoV7;
window.saveDevicePhotoV7=async function(assetId){
 const asset=(db.assets||[]).find(a=>a.id===Number(assetId));
 if(!isBattery(asset))return typeof oldSave==='function'?oldSave(assetId):undefined;
 const file=$('n7PhotoFile')?.files?.[0];if(!file)return alert('Take or choose a photo first.');
 const c=client();const {data:sessionData}=c?await c.auth.getSession():{data:{session:null}};
 if(!c||!sessionData?.session)return alert('Sign in to upload shared site photos.');
 const label=$('n7PhotoType')?.value||'Battery';
 const comment=$('n7PhotoComment')?.value||'';
 const sid=asset.siteId||activeSiteId();
 const ext=(file.name.match(/[.][a-zA-Z0-9]+$/)||['.jpg'])[0].toLowerCase();
 const path=`${folderFor(sid,asset.id)}/${Date.now()}__${encodeURIComponent(safe(label))}__${safe(file.name.replace(/[.][^.]+$/,''))}${ext}`;
 const btn=document.querySelector('#modal .primary');if(btn){btn.disabled=true;btn.textContent='Uploading…';}
 const {error}=await c.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
 if(error){console.error(error);if(btn){btn.disabled=false;btn.textContent='Save Photo';}return alert('Battery photo could not upload. Please try again.');}
 const url=await signedUrl(path);
 db.photos=db.photos||[];db.photos.push({id:`cloud:${Date.now()}`,siteId:sid,assetRef:String(asset.id),label,comment,cloudPath:path,data:url||'',createdAt:new Date().toISOString(),cloudShared:true});
 if(typeof save==='function')save();if(typeof closeModal==='function')closeModal();
 if(typeof window.renderSiteDetailV7==='function')window.renderSiteDetailV7(sid,'batteries');
};

function decorate(){
 const sec=document.getElementById('sites');if(!sec)return;
 sec.querySelectorAll('button[onclick*="editDeviceV7("]').forEach(edit=>{
  const m=(edit.getAttribute('onclick')||'').match(/editDeviceV7\((\d+),\s*['"]batteries['"]\)/);if(!m)return;
  const assetId=m[1],card=edit.closest('.card');if(!card)return;
  if(isMobile()&&!card.querySelector(`button[data-battery-photo-add="${assetId}"]`)){
   const b=document.createElement('button');b.type='button';b.className='secondary';b.dataset.batteryPhotoAdd=assetId;b.textContent='📷 Photo';b.onclick=()=>window.addDevicePhotoV7?.(Number(assetId));edit.insertAdjacentElement('afterend',b);
  }
  card.querySelectorAll(`[data-battery-photo-strip="${assetId}"]`).forEach(x=>x.remove());
  const photos=(db.photos||[]).filter(p=>Number(p.siteId)===Number(activeSiteId())&&String(p.assetRef||'')===String(assetId)&&p.data);
  if(!photos.length)return;
  const wrap=document.createElement('div');wrap.dataset.batteryPhotoStrip=assetId;wrap.style.cssText='display:flex;gap:10px;overflow-x:auto;margin-top:10px;padding:2px 0 4px';
  photos.forEach(p=>{const d=document.createElement('div');d.style.cssText='position:relative;flex:0 0 auto';const img=document.createElement('img');img.dataset.ppmPhotoId=String(p.id);img.dataset.ppmAssetId=String(assetId);img.src=p.data;img.alt=p.label||'Battery photo';img.title=p.label||'Battery photo';img.draggable=false;img.style.cssText='width:84px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1;display:block;cursor:zoom-in';img.onclick=e=>{if(window.openPcPhotoViewerV25){e.preventDefault();e.stopPropagation();window.openPcPhotoViewerV25(img.currentSrc||img.src,img.title||img.alt||'Battery photo');return false;}};const menu=document.createElement('button');menu.type='button';menu.dataset.ppmPhotoMenu=String(p.id);menu.title='Photo options';menu.textContent='⋮';menu.style.cssText='position:absolute;top:3px;right:3px;width:30px;height:30px;border:0;border-radius:999px;background:rgba(15,23,42,.78);color:white;font-size:21px;line-height:26px;padding:0;text-align:center;z-index:2';d.append(img,menu);wrap.appendChild(d);});
  const content=card.firstElementChild?.firstElementChild||card.firstElementChild||card;content.appendChild(wrap);
 });
}
let q=false;function queue(){if(q)return;q=true;setTimeout(()=>{q=false;decorate();},40)}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function')window.renderSiteDetailV7=function(siteId,tab='info'){const r=oldRender.apply(this,arguments);if(tab==='batteries'&&client())discoverBatteryPhotos(siteId).then(()=>{decorate();}).catch(console.warn);queue();return r;};
window.refreshBatteryPhotosV28=async()=>{await discoverBatteryPhotos(activeSiteId());decorate();};
setTimeout(()=>{discoverBatteryPhotos(activeSiteId()).then(decorate).catch(()=>{});decorate();},150);
})();