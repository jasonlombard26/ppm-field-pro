(()=>{
if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''))return;
if(window.__ppmPcPhotoViewerV25)return;window.__ppmPcPhotoViewerV25=true;
let scale=1,currentSrc='',currentLabel='Site photo';
const clamp=v=>Math.max(.25,Math.min(6,v));
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ensure(){let el=document.getElementById('ppmPcViewerV25');if(el)return el;el=document.createElement('div');el.id='ppmPcViewerV25';el.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.96);display:none;align-items:center;justify-content:center;overflow:auto;padding:70px 24px 90px;box-sizing:border-box';el.innerHTML='<button type="button" id="ppmPcCloseV25" style="position:fixed;top:16px;right:18px;z-index:3;width:46px;height:46px;border:0;border-radius:999px;background:#ffffff22;color:white;font-size:30px;cursor:pointer">×</button><img id="ppmPcImgV25" alt="Site photo" style="max-width:95%;max-height:calc(100vh - 170px);width:auto;height:auto;object-fit:contain;transform-origin:center center"><div id="ppmPcControlsV25" style="position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:3;display:flex;gap:8px;align-items:center;background:#0f172ae8;padding:9px 10px;border-radius:12px;border:1px solid #ffffff33"><button type="button" data-z="out">−</button><span id="ppmPcZoomV25" style="color:white;font-weight:700;min-width:58px;text-align:center">100%</span><button type="button" data-z="in">+</button><button type="button" data-z="reset">Reset</button><button type="button" data-z="pop">Pop Out</button></div>';
 document.body.appendChild(el);
 el.querySelectorAll('#ppmPcControlsV25 button').forEach(b=>b.style.cssText='border:1px solid #ffffff33;background:#1e293b;color:white;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer');
 document.getElementById('ppmPcCloseV25').onclick=close;
 el.addEventListener('click',e=>{if(e.target===el)close();});
 document.getElementById('ppmPcControlsV25').addEventListener('click',e=>{const a=e.target?.dataset?.z;if(!a)return;if(a==='in')setScale(scale+.25);if(a==='out')setScale(scale-.25);if(a==='reset')setScale(1);if(a==='pop')popout();});
 const img=document.getElementById('ppmPcImgV25');
 img.addEventListener('wheel',e=>{e.preventDefault();setScale(scale+(e.deltaY<0?0.2:-0.2));},{passive:false});
 img.addEventListener('dblclick',()=>setScale(scale===1?2:1));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&el.style.display!=='none')close();});return el;}
function setScale(v){scale=clamp(v);const img=document.getElementById('ppmPcImgV25');if(img)img.style.transform=`scale(${scale})`;const z=document.getElementById('ppmPcZoomV25');if(z)z.textContent=`${Math.round(scale*100)}%`;}
function open(src,label){if(!src)return;currentSrc=src;currentLabel=label||'Site photo';const el=ensure(),img=document.getElementById('ppmPcImgV25');img.src=src;img.alt=currentLabel;el.style.display='flex';document.body.style.overflow='hidden';setScale(1);}
function close(){const el=document.getElementById('ppmPcViewerV25');if(el)el.style.display='none';document.body.style.overflow='';setScale(1);}
function popout(){if(!currentSrc)return;const w=window.open('','_blank','popup=yes,width=1200,height=850,resizable=yes,scrollbars=yes');if(!w)return alert('Pop-up blocked. Please allow pop-ups for PPM Field Pro.');w.document.write(`<!doctype html><html><head><title>${esc(currentLabel)}</title><style>html,body{margin:0;height:100%;background:#0b1220}body{display:flex;align-items:center;justify-content:center;overflow:auto}img{max-width:none;max-height:none;width:auto;height:auto}</style></head><body><img src="${esc(currentSrc)}" alt="${esc(currentLabel)}"></body></html>`);w.document.close();}
window.openPcPhotoViewerV25=open;
function bind(){document.querySelectorAll('img[data-ppm-photo-id],#sites img,#photoGrid img').forEach(img=>{if(img.id==='ppmPcImgV25'||img.id==='ppmPhotoViewerImg'||img.dataset.ppmPcV25Bound)return;img.dataset.ppmPcV25Bound='1';img.style.cursor='zoom-in';img.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();open(img.currentSrc||img.src,img.title||img.alt||'Site photo');},true);});}
new MutationObserver(()=>setTimeout(bind,0)).observe(document.documentElement,{childList:true,subtree:true});bind();setTimeout(bind,250);setTimeout(bind,1000);
})();
