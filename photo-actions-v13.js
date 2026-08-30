(()=>{
if(window.__ppmPhotoActionsV13)return;window.__ppmPhotoActionsV13=true;
const BUCKET='ppm-photos';
const $=id=>document.getElementById(id);
let timer=null,longPressed=false,currentPhoto=null;
const client=()=>window.ppmSupabase;
const safe=s=>(s||'photo').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'photo';
const findPhoto=id=>(db.photos||[]).find(p=>String(p.id)===String(id));
const refresh=()=>{if(typeof save==='function')save();if(typeof window.refreshPhotoDisplayV12==='function')window.refreshPhotoDisplayV12();setTimeout(decorateAllPhotos,50);};

function htmlEsc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function closeMenu(){const el=$('ppmPhotoActionMenu');if(el)el.remove();currentPhoto=null;}
function openMenu(photo){
 closeMenu();currentPhoto=photo;
 const wrap=document.createElement('div');wrap.id='ppmPhotoActionMenu';
 wrap.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box';
 wrap.innerHTML=`<div style="background:white;color:#0f172a;border-radius:16px;padding:12px;width:min(420px,100%);box-shadow:0 20px 40px rgba(0,0,0,.28)"><div style="font-weight:700;padding:8px 10px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${htmlEsc(photo.label||'Site photo')}</div><button type="button" data-action="rename" style="width:100%;min-height:48px;padding:13px;border:0;border-top:1px solid #e2e8f0;background:white;text-align:left;font-size:17px">Rename</button><button type="button" data-action="share" style="width:100%;min-height:48px;padding:13px;border:0;border-top:1px solid #e2e8f0;background:white;text-align:left;font-size:17px">Share</button><button type="button" data-action="delete" style="width:100%;min-height:52px;padding:13px;border:0;border-top:1px solid #e2e8f0;background:#fff7f7;text-align:left;font-size:18px;font-weight:800;color:#b91c1c">🗑 Delete Photo</button><button type="button" data-action="cancel" style="width:100%;min-height:48px;padding:13px;border:0;border-top:1px solid #e2e8f0;background:white;text-align:center;font-size:16px;font-weight:700">Cancel</button></div>`;
 document.body.appendChild(wrap);
 wrap.addEventListener('click',e=>{const a=e.target?.dataset?.action;if(!a){if(e.target===wrap)closeMenu();return;}if(a==='cancel')return closeMenu();if(a==='rename')return renamePhoto(photo);if(a==='share')return sharePhoto(photo);if(a==='delete')return deletePhoto(photo);});
}
window.openPhotoActionsV13=id=>{const p=findPhoto(id);if(p)openMenu(p);};

async function renamePhoto(photo){const name=prompt('Rename photo',photo.label||'Site photo');if(name===null)return;const trimmed=name.trim();if(!trimmed)return alert('Enter a photo name.');
 if(photo.cloudPath&&client()){
  const oldPath=photo.cloudPath,slash=oldPath.lastIndexOf('/'),folder=oldPath.slice(0,slash),file=oldPath.slice(slash+1),ext=(file.match(/\.[a-zA-Z0-9]+$/)||['.jpg'])[0],newPath=`${folder}/${Date.now()}__${encodeURIComponent(safe(trimmed))}__renamed${ext}`;
  const {error}=await client().storage.from(BUCKET).move(oldPath,newPath);if(error){console.error(error);return alert('The shared photo could not be renamed.');}
  photo.cloudPath=newPath;const {data}=await client().storage.from(BUCKET).createSignedUrl(newPath,3600);if(data?.signedUrl)photo.data=data.signedUrl;
 }
 photo.label=trimmed;refresh();closeMenu();}

async function deletePhoto(photo){if(!confirm(`Delete “${photo.label||'this photo'}”? This cannot be undone.`))return;
 if(photo.cloudPath&&client()){
  const {error}=await client().storage.from(BUCKET).remove([photo.cloudPath]);if(error){console.error(error);return alert('The shared photo could not be deleted.');}
 }
 db.photos=(db.photos||[]).filter(p=>String(p.id)!==String(photo.id));refresh();closeMenu();}

async function sharePhoto(photo){try{
 let blob=null,file=null;const name=safe(photo.label||'site-photo')+'.jpg';
 if(photo.data){const r=await fetch(photo.data);blob=await r.blob();file=new File([blob],name,{type:blob.type||'image/jpeg'});}
 if(navigator.share){const payload={title:photo.label||'Site photo',text:photo.label||'Site photo'};if(file&&navigator.canShare?.({files:[file]}))payload.files=[file];else if(/^https?:/i.test(photo.data||''))payload.url=photo.data;await navigator.share(payload);closeMenu();return;}
 if(/^https?:/i.test(photo.data||'')){window.open(photo.data,'_blank');closeMenu();return;}
 alert('Sharing is not supported on this device.');
 }catch(err){if(err?.name!=='AbortError'){console.error(err);alert('The photo could not be shared.');}}
}

function matchPhotoForImg(img){
 const id=img.dataset?.ppmPhotoId;if(id){const p=findPhoto(id);if(p)return p;}
 const src=img.getAttribute('src')||img.src||'';
 if(!src)return null;
 return (db.photos||[]).find(p=>p.data&&(p.data===src||String(img.src||'')===String(p.data)))||null;
}
function decorateAllPhotos(){
 const root=document.getElementById('sites');if(!root)return;
 root.querySelectorAll('img').forEach(img=>{
  if(img.id==='ppmPhotoViewerImg')return;
  const p=matchPhotoForImg(img);if(!p)return;
  img.dataset.ppmPhotoId=String(p.id);img.draggable=false;img.style.webkitTouchCallout='none';img.style.userSelect='none';
  const parent=img.parentElement;if(!parent)return;
  if(parent.querySelector(`button[data-ppm-photo-menu="${CSS.escape(String(p.id))}"]`))return;
  const btn=document.createElement('button');btn.type='button';btn.dataset.ppmPhotoMenu=String(p.id);btn.textContent='⋮ Options';
  btn.style.cssText='display:inline-flex;align-items:center;justify-content:center;min-height:36px;margin:5px 4px 4px 0;padding:6px 10px;border:1px solid #94a3b8;border-radius:8px;background:#fff;color:#0f172a;font-size:13px;font-weight:700;cursor:pointer';
  img.insertAdjacentElement('afterend',btn);
 });
}

function startPress(img){const p=matchPhotoForImg(img);if(!p)return;longPressed=false;clearTimeout(timer);timer=setTimeout(()=>{longPressed=true;openMenu(p);if(navigator.vibrate)navigator.vibrate(30);},600);}
function cancelPress(){clearTimeout(timer);timer=null;}

document.addEventListener('pointerdown',e=>{const img=e.target?.closest?.('#sites img');if(img)startPress(img);},true);
document.addEventListener('pointerup',cancelPress,true);document.addEventListener('pointercancel',cancelPress,true);
document.addEventListener('contextmenu',e=>{const img=e.target?.closest?.('#sites img');if(!img)return;const p=matchPhotoForImg(img);if(!p)return;e.preventDefault();openMenu(p);},true);
document.addEventListener('click',e=>{
 const menuBtn=e.target?.closest?.('button[data-ppm-photo-menu]');if(menuBtn){e.preventDefault();e.stopImmediatePropagation();const p=findPhoto(menuBtn.dataset.ppmPhotoMenu);if(p)openMenu(p);return;}
 if(!longPressed)return;const img=e.target?.closest?.('#sites img');if(img){e.preventDefault();e.stopImmediatePropagation();longPressed=false;}
},true);
new MutationObserver(()=>setTimeout(decorateAllPhotos,20)).observe(document.documentElement,{childList:true,subtree:true});
window.refreshPhotoActionsV13=decorateAllPhotos;
setTimeout(decorateAllPhotos,100);setTimeout(decorateAllPhotos,800);setTimeout(decorateAllPhotos,1800);
})();
