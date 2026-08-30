(()=>{
if(window.__ppmPhotoActionsV13)return;window.__ppmPhotoActionsV13=true;
const BUCKET='ppm-photos';
const $=id=>document.getElementById(id);
let timer=null,longPressed=false,currentPhoto=null;
const client=()=>window.ppmSupabase;
const safe=s=>(s||'photo').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'photo';
const findPhoto=id=>(db.photos||[]).find(p=>String(p.id)===String(id));
const refresh=()=>{if(typeof save==='function')save();if(typeof window.refreshPhotoDisplayV12==='function')window.refreshPhotoDisplayV12();};

function closeMenu(){const el=$('ppmPhotoActionMenu');if(el)el.remove();currentPhoto=null;}
function openMenu(photo){closeMenu();currentPhoto=photo;const wrap=document.createElement('div');wrap.id='ppmPhotoActionMenu';wrap.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;padding:16px;box-sizing:border-box';wrap.innerHTML=`<div style="background:white;color:#0f172a;border-radius:16px;padding:12px;width:min(420px,100%);box-shadow:0 20px 40px rgba(0,0,0,.28)"><div style="font-weight:700;padding:8px 10px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${String(photo.label||'Site photo').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div><button type="button" data-action="rename" style="width:100%;padding:13px;border:0;border-top:1px solid #e2e8f0;background:white;text-align:left;font-size:16px">Rename</button><button type="button" data-action="share" style="width:100%;padding:13px;border:0;border-top:1px solid #e2e8f0;background:white;text-align:left;font-size:16px">Share</button><button type="button" data-action="delete" style="width:100%;padding:13px;border:0;border-top:1px solid #e2e8f0;background:white;text-align:left;font-size:16px;color:#b91c1c">Delete</button><button type="button" data-action="cancel" style="width:100%;padding:13px;border:0;border-top:1px solid #e2e8f0;background:white;text-align:center;font-size:16px;font-weight:700">Cancel</button></div>`;document.body.appendChild(wrap);wrap.addEventListener('click',e=>{const a=e.target?.dataset?.action;if(!a){if(e.target===wrap)closeMenu();return;}if(a==='cancel')return closeMenu();if(a==='rename')return renamePhoto(photo);if(a==='share')return sharePhoto(photo);if(a==='delete')return deletePhoto(photo);});}

async function renamePhoto(photo){const name=prompt('Rename photo',photo.label||'Site photo');if(name===null)return;const trimmed=name.trim();if(!trimmed)return alert('Enter a photo name.');
 if(photo.cloudPath&&client()){
  const oldPath=photo.cloudPath,slash=oldPath.lastIndexOf('/'),folder=oldPath.slice(0,slash),file=oldPath.slice(slash+1),ext=(file.match(/\.[a-zA-Z0-9]+$/)||['.jpg'])[0],newPath=`${folder}/${Date.now()}__${encodeURIComponent(safe(trimmed))}__renamed${ext}`;
  const {error}=await client().storage.from(BUCKET).move(oldPath,newPath);if(error){console.error(error);return alert('The shared photo could not be renamed.');}
  photo.cloudPath=newPath;const {data}=await client().storage.from(BUCKET).createSignedUrl(newPath,3600);if(data?.signedUrl)photo.data=data.signedUrl;
 }
 photo.label=trimmed;refresh();closeMenu();}

async function deletePhoto(photo){if(!confirm(`Delete “${photo.label||'this photo'}”?`))return;
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

function startPress(img,e){const p=findPhoto(img.dataset.ppmPhotoId);if(!p)return;longPressed=false;clearTimeout(timer);timer=setTimeout(()=>{longPressed=true;openMenu(p);if(navigator.vibrate)navigator.vibrate(30);},600);}
function cancelPress(){clearTimeout(timer);timer=null;}

document.addEventListener('pointerdown',e=>{const img=e.target?.closest?.('img[data-ppm-photo-id]');if(img)startPress(img,e);},true);
document.addEventListener('pointerup',cancelPress,true);document.addEventListener('pointercancel',cancelPress,true);document.addEventListener('pointermove',e=>{if(timer&&e.pointerType==='touch'&&Math.abs(e.movementX||0)+Math.abs(e.movementY||0)>8)cancelPress();},true);
document.addEventListener('contextmenu',e=>{const img=e.target?.closest?.('img[data-ppm-photo-id]');if(!img)return;e.preventDefault();const p=findPhoto(img.dataset.ppmPhotoId);if(p)openMenu(p);},true);
document.addEventListener('click',e=>{if(!longPressed)return;const img=e.target?.closest?.('img[data-ppm-photo-id]');if(img){e.preventDefault();e.stopImmediatePropagation();longPressed=false;}},true);
})();
