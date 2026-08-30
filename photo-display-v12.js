(()=>{
if(window.__ppmPhotoDisplayV12)return;window.__ppmPhotoDisplayV12=true;

const activeSiteId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
const escHtml=x=>typeof esc==='function'?esc(x??''):String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function photosFor(assetId){
 return (db.photos||[]).filter(p=>Number(p.siteId)===Number(activeSiteId())&&String(p.assetRef||'')===String(assetId)&&p.data);
}

function stripHtml(assetId){
 const photos=photosFor(assetId);
 if(!photos.length)return '';
 return `<div data-photo-strip-v12="${assetId}" style="display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding:2px 0 4px">${photos.map(p=>`<img data-ppm-photo-id="${escHtml(String(p.id))}" data-ppm-asset-id="${escHtml(String(assetId))}" src="${escHtml(p.data)}" alt="${escHtml(p.label||'Site photo')}" title="${escHtml(p.label||'Site photo')}" style="width:84px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #cbd5e1;flex:0 0 auto;cursor:zoom-in;-webkit-touch-callout:none;user-select:none">`).join('')}</div>`;
}

function decorate(){
 const sec=document.getElementById('sites');if(!sec)return;
 sec.querySelectorAll('button[onclick*="editDeviceV7("]').forEach(btn=>{
  const m=(btn.getAttribute('onclick')||'').match(/editDeviceV7\((\d+),\s*['"](cctv|access)['"]\)/);if(!m)return;
  const assetId=m[1],card=btn.closest('.card');if(!card)return;
  card.querySelectorAll(`[data-photo-strip-v12="${assetId}"]`).forEach(x=>x.remove());
  const html=stripHtml(assetId);if(!html)return;
  const content=card.firstElementChild?.firstElementChild||card.firstElementChild||card;
  content.insertAdjacentHTML('beforeend',html);
 });
}

let queued=false;
function queueDecorate(){if(queued)return;queued=true;setTimeout(()=>{queued=false;decorate();},30);}
new MutationObserver(queueDecorate).observe(document.documentElement,{childList:true,subtree:true});

const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function')window.renderSiteDetailV7=function(...args){const r=oldRender.apply(this,args);queueDecorate();setTimeout(decorate,400);setTimeout(decorate,1200);return r;};

window.refreshPhotoDisplayV12=decorate;
setTimeout(decorate,100);
})();
