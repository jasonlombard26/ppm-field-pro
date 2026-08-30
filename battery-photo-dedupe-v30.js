(()=>{
if(window.__ppmBatteryPhotoDedupeV30)return;window.__ppmBatteryPhotoDedupeV30=true;
const mobileUA=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
const coarseTouch=Number(navigator.maxTouchPoints||0)>0&&window.matchMedia?.('(pointer: coarse)').matches;
const narrowScreen=window.matchMedia?.('(max-width: 1100px)').matches;
const isMobile=mobileUA||(coarseTouch&&narrowScreen);
function isPhotoButton(b){
 const t=String(b?.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
 const oc=String(b?.getAttribute?.('onclick')||'').toLowerCase();
 const ds=Object.keys(b?.dataset||{}).join(' ').toLowerCase();
 return t.includes('photo')||oc.includes('photo')||ds.includes('photo');
}
function batteryCards(){
 const sec=document.getElementById('sites');if(!sec)return [];
 const out=[];
 sec.querySelectorAll('button').forEach(edit=>{
  const oc=String(edit.getAttribute('onclick')||'');
  if(!/editDeviceV7\(\s*\d+\s*,\s*['"]batteries['"]\s*\)/i.test(oc))return;
  const card=edit.closest('.card');if(card&&!out.includes(card))out.push(card);
 });
 return out;
}
function clean(){
 batteryCards().forEach(card=>{
  const buttons=Array.from(card.querySelectorAll('button')).filter(isPhotoButton);
  if(!isMobile){buttons.forEach(b=>b.remove());return;}
  if(buttons.length>1)buttons.slice(1).forEach(b=>b.remove());
 });
}
let busy=false;function queue(){if(busy)return;busy=true;setTimeout(()=>{busy=false;clean();},0)}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
setInterval(clean,250);
setTimeout(clean,0);setTimeout(clean,50);setTimeout(clean,150);setTimeout(clean,500);setTimeout(clean,1500);
window.cleanBatteryPhotoButtonsV30=clean;
})();
