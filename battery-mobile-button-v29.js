(()=>{
if(window.__ppmBatteryMobileButtonV29)return;window.__ppmBatteryMobileButtonV29=true;
if(!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''))return;
function addButtons(){
 const sec=document.getElementById('sites');if(!sec)return;
 sec.querySelectorAll('button[onclick*="editDeviceV7("]').forEach(edit=>{
  const m=(edit.getAttribute('onclick')||'').match(/editDeviceV7\((\d+),\s*['"]batteries['"]\)/);if(!m)return;
  const assetId=m[1],card=edit.closest('.card');if(!card)return;
  if(card.querySelector(`button[data-battery-mobile-photo="${assetId}"]`))return;
  const btn=document.createElement('button');
  btn.type='button';btn.className='secondary';btn.dataset.batteryMobilePhoto=assetId;btn.textContent='📷 Photo';
  btn.onclick=()=>window.addDevicePhotoV7?.(Number(assetId));
  edit.insertAdjacentElement('afterend',btn);
 });
}
let queued=false;function queue(){if(queued)return;queued=true;setTimeout(()=>{queued=false;addButtons();},20)}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function')window.renderSiteDetailV7=function(){const r=oldRender.apply(this,arguments);queue();setTimeout(addButtons,150);return r;};
setTimeout(addButtons,50);setTimeout(addButtons,500);setTimeout(addButtons,1500);
})();