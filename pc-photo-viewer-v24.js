(()=>{
if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''))return;
if(window.__ppmPcPhotoViewerV24)return;window.__ppmPcPhotoViewerV24=true;
let scale=1;
const clamp=v=>Math.max(.25,Math.min(6,v));
function viewer(){return document.getElementById('ppmPhotoViewer');}
function image(){return document.getElementById('ppmPhotoViewerImg');}
function applyScale(){const img=image();if(!img)return;img.style.transform=`scale(${scale})`;img.style.transformOrigin='center center';img.style.transition='transform .12s ease';}
function setScale(v){scale=clamp(v);applyScale();const out=document.getElementById('ppmPcZoomLabel');if(out)out.textContent=`${Math.round(scale*100)}%`;}
function ensureControls(){
  const el=viewer();if(!el||document.getElementById('ppmPcPhotoControls'))return;
  const bar=document.createElement('div');
  bar.id='ppmPcPhotoControls';
  bar.style.cssText='position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:3;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;background:rgba(15,23,42,.9);padding:9px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.2);box-shadow:0 8px 30px rgba(0,0,0,.35)';
  const btn=(txt,title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=txt;b.title=title;b.style.cssText='border:1px solid rgba(255,255,255,.22);background:#1e293b;color:white;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;min-width:44px';b.onclick=fn;return b;};
  bar.appendChild(btn('−','Zoom out',()=>setScale(scale-.25)));
  const lab=document.createElement('span');lab.id='ppmPcZoomLabel';lab.textContent='100%';lab.style.cssText='color:white;font-weight:700;min-width:58px;text-align:center';bar.appendChild(lab);
  bar.appendChild(btn('+','Zoom in',()=>setScale(scale+.25)));
  bar.appendChild(btn('Reset','Reset zoom',()=>setScale(1)));
  bar.appendChild(btn('Pop Out','Open photo in a separate window',()=>{
    const img=image();if(!img?.src)return;
    const w=window.open('','_blank','popup=yes,width=1200,height=850,resizable=yes,scrollbars=yes');
    if(!w){alert('Pop-up blocked. Please allow pop-ups for PPM Field Pro Desktop.');return;}
    const safe=String(img.src).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const label=(document.getElementById('ppmPhotoViewerLabel')?.textContent||'Site photo').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    w.document.write(`<!doctype html><html><head><title>${label}</title><style>html,body{margin:0;background:#0b1220;color:white;font-family:Segoe UI,Arial,sans-serif;height:100%}body{display:flex;flex-direction:column}.top{padding:10px 14px;background:#111827;font-weight:700}.wrap{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}img{max-width:none;max-height:none;width:auto;height:auto;object-fit:contain;box-shadow:0 10px 40px rgba(0,0,0,.35)}</style></head><body><div class="top">${label}</div><div class="wrap"><img src="${safe}" alt="${label}"></div></body></html>`);
    w.document.close();
  }));
  el.appendChild(bar);
  const img=image();if(img&&!img.dataset.ppmPcZoomBound){
    img.dataset.ppmPcZoomBound='1';
    img.style.cursor='zoom-in';
    img.addEventListener('dblclick',e=>{e.preventDefault();setScale(scale===1?2:1);});
    img.addEventListener('wheel',e=>{if(viewer()?.style.display==='none')return;e.preventDefault();setScale(scale+(e.deltaY<0?0.2:-0.2));},{passive:false});
  }
}
const oldOpen=window.openPhotoViewerV9;
if(typeof oldOpen==='function')window.openPhotoViewerV9=(src,label='')=>{oldOpen(src,label);ensureControls();setScale(1);};
const oldClose=window.closePhotoViewerV9;
if(typeof oldClose==='function')window.closePhotoViewerV9=()=>{setScale(1);oldClose();};
document.addEventListener('click',e=>{
  const img=e.target?.closest?.('img[data-ppm-photo-id], #sites img, #photoGrid img');
  if(!img||img.id==='ppmPhotoViewerImg'||!img.src)return;
  if(typeof window.openPhotoViewerV9==='function'){
    e.preventDefault();e.stopPropagation();
    window.openPhotoViewerV9(img.src,img.title||img.alt||'Site photo');
  }
},true);
new MutationObserver(()=>ensureControls()).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(ensureControls,0);
})();
