(()=>{
if(window.__ppmBatteryPhotoDedupeV30)return;window.__ppmBatteryPhotoDedupeV30=true;
const mobileUA=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
const coarseTouch=Number(navigator.maxTouchPoints||0)>0&&window.matchMedia?.('(pointer: coarse)').matches;
const narrowScreen=window.matchMedia?.('(max-width: 1100px)').matches;
const isMobile=mobileUA||(coarseTouch&&narrowScreen);
function isPhotoButton(b){const t=(b.textContent||'').trim().toLowerCase();return t==='photo'||t==='📷 photo'||t==='photos'||t==='📷 photos';}
function clean(){
 const sec=document.getElementById('sites');if(!sec)return;
 sec.querySelectorAll('button[onclick*="editDeviceV7("]').forEach(edit=>{
  const m=(edit.getAttribute('onclick')||'').match(/editDeviceV7\((\d+),\s*['"]batteries['"]\)/);if(!m)return;
  const card=edit.closest('.card');if(!card)return;
  const buttons=Array.from(card.querySelectorAll('button')).filter(b=>isPhotoButton(b));
  if(!isMobile){buttons.forEach(b=>b.remove());return;}
  buttons.slice(1).forEach(b=>b.remove());
 });
}
let busy=false;function queue(){if(busy)return;busy=true;setTimeout(()=>{busy=false;clean();},0)}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
setInterval(clean,500);
setTimeout(clean,0);setTimeout(clean,100);setTimeout(clean,500);setTimeout(clean,1500);
window.cleanBatteryPhotoButtonsV30=clean;
})();
