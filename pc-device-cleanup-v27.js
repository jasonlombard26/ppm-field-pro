(()=>{
if(window.__ppmPcDeviceCleanupV27)return;window.__ppmPcDeviceCleanupV27=true;
const isDesktop=!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
if(!isDesktop)return;
function clean(){
 document.querySelectorAll('button[onclick*="addDevicePhotoV7("]').forEach(btn=>btn.remove());
}
new MutationObserver(clean).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(clean,0);setTimeout(clean,250);setTimeout(clean,1000);
window.cleanPcDevicePhotoButtonsV27=clean;
})();
