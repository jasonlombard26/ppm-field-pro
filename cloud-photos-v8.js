(()=>{
if(window.__ppmCloudPhotosV8)return;window.__ppmCloudPhotosV8=true;
const BUCKET='ppm-photos';
const $=id=>document.getElementById(id);
const activeSiteId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
const safe=s=>(s||'photo').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'photo';
const sectionFor=a=>(a?.system||'').toLowerCase().includes('cctv')?'cctv':'access-control';
const folderFor=(siteId,section,assetId)=>`sites/${siteId}/${section}/${assetId}`;
const client=()=>window.ppmSupabase;
const cloudCache=new Map();

async function signedUrl(path){
  if(cloudCache.has(path))return cloudCache.get(path);
  const c=client();if(!c)return '';
  const {data,error}=await c.storage.from(BUCKET).createSignedUrl(path,3600);
  if(error){console.warn('Photo signed URL failed',error);return '';}
  const url=data?.signedUrl||'';if(url)cloudCache.set(path,url);return url;
}

function labelFromName(name){
  const parts=String(name||'').split('__');
  if(parts.length>2){try{return decodeURIComponent(parts[1]).replace(/-/g,' ')}catch(e){return parts[1].replace(/-/g,' ')}}
  return 'Site photo';
}

async function discoverAssetPhotos(asset){
  const c=client();if(!c||!asset)return false;
  const sid=asset.siteId||activeSiteId(),section=sectionFor(asset),folder=folderFor(sid,section,asset.id);
  const {data,error}=await c.storage.from(BUCKET).list(folder,{limit:100,sortBy:{column:'created_at',order:'desc'}});
  if(error){console.warn('Photo list failed',error);return false;}
  db.photos=db.photos||[];let changed=false;
  for(const f of data||[]){
    if(!f?.name||f.name.endsWith('.emptyFolderPlaceholder')||!f.id)continue;
    const path=`${folder}/${f.name}`;
    if(!/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name))continue;
    let p=db.photos.find(x=>x.cloudPath===path);
    if(!p){p={id:`cloud:${f.id||path}`,siteId:sid,assetRef:String(asset.id),label:labelFromName(f.name),comment:'',cloudPath:path,createdAt:f.created_at||f.updated_at||new Date().toISOString(),cloudShared:true};db.photos.push(p);changed=true;}
    if(!p.data){const url=await signedUrl(path);if(url){p.data=url;p.cloudSignedUrl=true;changed=true;}}
  }
  return changed;
}

async function discoverForTab(siteId,tab){
  if(!['cctv','access'].includes(tab)||!client())return;
  const assets=(db.assets||[]).filter(a=>a.siteId===Number(siteId)&&sectionFor(a)===(tab==='cctv'?'cctv':'access-control'));
  let changed=false;
  for(const a of assets){if(await discoverAssetPhotos(a))changed=true;}
  return changed;
}

const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function'){
  window.renderSiteDetailV7=function(siteId,tab='info'){
    const result=oldRender(siteId,tab);
    if(['cctv','access'].includes(tab)&&client()){
      discoverForTab(siteId,tab).then(changed=>{if(changed&&document.getElementById('sites')?.dataset?.mode==='detail')oldRender(siteId,tab);}).catch(console.warn);
    }
    return result;
  };
}

const oldSave=window.saveDevicePhotoV7;
window.saveDevicePhotoV7=async function(assetId){
  const file=$('n7PhotoFile')?.files?.[0];if(!file)return alert('Take or choose a photo first.');
  const c=client();
  const {data:sessionData}=c?await c.auth.getSession():{data:{session:null}};
  if(!c||!sessionData?.session){
    if(typeof oldSave==='function')return oldSave(assetId);
    return alert('Sign in to upload shared site photos.');
  }
  const asset=(db.assets||[]).find(a=>a.id===Number(assetId));if(!asset)return alert('Equipment record not found.');
  const label=$('n7PhotoType')?.value||'Device';
  const comment=$('n7PhotoComment')?.value||'';
  const section=sectionFor(asset),sid=asset.siteId||activeSiteId();
  const ext=(file.name.match(/\.[a-zA-Z0-9]+$/)||['.jpg'])[0].toLowerCase();
  const path=`${folderFor(sid,section,asset.id)}/${Date.now()}__${encodeURIComponent(safe(label))}__${safe(file.name.replace(/\.[^.]+$/,''))}${ext}`;
  const btn=document.querySelector('#modal .primary');if(btn){btn.disabled=true;btn.textContent='Uploading…';}
  const {error}=await c.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
  if(error){console.error(error);if(btn){btn.disabled=false;btn.textContent='Save Photo';}return alert('Photo could not upload to the shared site. It has not been lost; please try again when the connection is available.');}
  const url=await signedUrl(path);
  db.photos=db.photos||[];
  db.photos.push({id:`cloud:${Date.now()}`,siteId:sid,assetRef:String(asset.id),label,comment,cloudPath:path,data:url||'',createdAt:new Date().toISOString(),cloudShared:true});
  if(typeof save==='function')save();
  if(typeof closeModal==='function')closeModal();
  const tab=section==='cctv'?'cctv':'access';
  if(typeof window.renderSiteDetailV7==='function')window.renderSiteDetailV7(sid,tab);
};

window.refreshSharedPhotosV8=async()=>{
  const sid=activeSiteId();
  await discoverForTab(sid,'cctv');
  await discoverForTab(sid,'access');
  if(typeof window.renderSiteDetailV7==='function')window.renderSiteDetailV7(sid,'info');
};
})();
