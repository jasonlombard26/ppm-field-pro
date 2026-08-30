(()=>{
if(!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''))return;
if(window.__ppmPhotoViewerV9)return;window.__ppmPhotoViewerV9=true;

function ensureViewer(){
  let el=document.getElementById('ppmPhotoViewer');
  if(el)return el;
  el=document.createElement('div');
  el.id='ppmPhotoViewer';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  el.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.96);display:none;align-items:center;justify-content:center;padding:0;touch-action:manipulation;';
  el.innerHTML=`
    <button id="ppmPhotoViewerClose" aria-label="Close photo" style="position:absolute;top:max(12px,env(safe-area-inset-top));right:14px;z-index:2;border:0;border-radius:999px;width:46px;height:46px;background:rgba(255,255,255,.16);color:white;font-size:30px;line-height:1;cursor:pointer">×</button>
    <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:64px 14px 24px;box-sizing:border-box">
      <img id="ppmPhotoViewerImg" alt="PPM photo" style="max-width:100%;max-height:calc(100vh - 120px);width:auto;height:auto;object-fit:contain;user-select:none;-webkit-user-drag:none;border-radius:4px">
      <div id="ppmPhotoViewerLabel" style="color:white;font-size:14px;font-weight:700;margin-top:12px;text-align:center;max-width:900px"></div>
    </div>`;
  document.body.appendChild(el);
  const close=()=>window.closePhotoViewerV9();
  document.getElementById('ppmPhotoViewerClose').onclick=close;
  el.addEventListener('click',e=>{if(e.target===el)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el.style.display!=='none')close();});
  return el;
}

window.openPhotoViewerV9=(src,label='')=>{
  if(!src)return;
  const el=ensureViewer(),img=document.getElementById('ppmPhotoViewerImg'),txt=document.getElementById('ppmPhotoViewerLabel');
  img.src=src;txt.textContent=label||'';el.style.display='flex';document.body.style.overflow='hidden';
};
window.closePhotoViewerV9=()=>{
  const el=document.getElementById('ppmPhotoViewer');if(!el)return;
  el.style.display='none';document.body.style.overflow='';
};

document.addEventListener('click',e=>{
  const img=e.target?.closest?.('#sites img, #photoGrid img');
  if(!img||img.id==='ppmPhotoViewerImg'||!img.src)return;
  e.preventDefault();e.stopPropagation();
  img.style.cursor='zoom-in';
  window.openPhotoViewerV9(img.src,img.title||img.alt||'Site photo');
},true);

const markImages=()=>document.querySelectorAll('#sites img,#photoGrid img').forEach(img=>{if(img.id!=='ppmPhotoViewerImg'){img.style.cursor='zoom-in';img.title=img.title||'Tap to view full screen';}});
new MutationObserver(markImages).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(markImages,0);
})();
