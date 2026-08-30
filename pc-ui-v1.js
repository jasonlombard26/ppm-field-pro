(()=>{
if(window.__ppmPcUiV1)return;window.__ppmPcUiV1=true;
document.documentElement.classList.add('ppm-pc-ui');
const css=document.createElement('style');
css.textContent=`
html.ppm-pc-ui,html.ppm-pc-ui body{background:#f1f5f9!important;color:#0f172a!important;min-width:1050px}
html.ppm-pc-ui body{display:block!important;min-height:100vh!important}
html.ppm-pc-ui header{position:fixed!important;left:260px!important;right:0!important;top:0!important;height:64px!important;z-index:2000!important;background:#fff!important;color:#0f172a!important;border-bottom:1px solid #e2e8f0!important;box-sizing:border-box!important;padding:10px 18px!important;display:flex!important;align-items:center!important;gap:12px!important;box-shadow:0 1px 3px rgba(15,23,42,.05)!important}
html.ppm-pc-ui nav{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:260px!important;z-index:2100!important;background:#0f172a!important;padding:20px 14px!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:7px!important;overflow:auto!important;border:0!important}
html.ppm-pc-ui nav .pc-brand{display:block;padding:4px 8px 20px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.12)}
html.ppm-pc-ui nav .pc-brand strong{display:block;color:#fff;font-size:19px;letter-spacing:.1px}
html.ppm-pc-ui nav .pc-brand span{display:block;color:#94a3b8;font-size:12px;margin-top:4px}
html.ppm-pc-ui nav button{width:100%!important;text-align:left!important;border:0!important;border-radius:8px!important;padding:11px 12px!important;background:transparent!important;color:#cbd5e1!important;font-weight:650!important;box-shadow:none!important}
html.ppm-pc-ui nav button:hover{background:#1e293b!important;color:#fff!important}
html.ppm-pc-ui nav button.active{background:#2563eb!important;color:#fff!important}
html.ppm-pc-ui main{margin-left:260px!important;padding:88px 24px 32px!important;max-width:none!important;width:auto!important;box-sizing:border-box!important}
html.ppm-pc-ui .page{max-width:1500px!important;margin:0 auto!important}
html.ppm-pc-ui .card{border-radius:10px!important;box-shadow:0 1px 3px rgba(15,23,42,.06)!important;border:1px solid #e2e8f0!important}
html.ppm-pc-ui .formgrid{grid-template-columns:repeat(3,minmax(220px,1fr))!important}
html.ppm-pc-ui table{font-size:14px!important}
html.ppm-pc-ui th{position:sticky;top:64px;background:#f8fafc;z-index:2}
html.ppm-pc-ui input,html.ppm-pc-ui select,html.ppm-pc-ui textarea{font-size:14px!important}
html.ppm-pc-ui #siteListV6{display:grid!important;grid-template-columns:repeat(2,minmax(360px,1fr))!important;gap:10px!important}
html.ppm-pc-ui #siteListV6>button{margin:0!important;min-height:112px}
html.ppm-pc-ui #ppmCloudStatus{white-space:nowrap}
.pc-mode-pill{font-size:12px;font-weight:800;background:#dbeafe;color:#1d4ed8;border-radius:999px;padding:6px 9px;white-space:nowrap}
@media(max-width:1200px){html.ppm-pc-ui #siteListV6{grid-template-columns:1fr!important}html.ppm-pc-ui .formgrid{grid-template-columns:repeat(2,minmax(220px,1fr))!important}}
`;
document.head.appendChild(css);

function hideDevicePhotoButtons(){
 document.querySelectorAll('#sites .card button').forEach(b=>{
  const t=(b.textContent||'').trim().toLowerCase();
  if(t==='photo'||t==='photos'||t==='📷 photo'||t==='📷 photos')b.style.display='none';
 });
}
function setup(){
 const nav=document.querySelector('nav');
 if(nav&&!nav.querySelector('.pc-brand')){
   const brand=document.createElement('div');brand.className='pc-brand';brand.innerHTML='<strong>PPM Field Pro</strong><span>Desktop Management Console</span>';nav.prepend(brand);
 }
 const header=document.querySelector('header');
 if(header&&!header.querySelector('.pc-mode-pill')){
   const pill=document.createElement('span');pill.className='pc-mode-pill';pill.textContent='PC MODE';header.insertBefore(pill,header.firstChild);
 }
 const title=document.querySelector('header h1,header h2');if(title)title.textContent='PPM Field Pro — Desktop';
 hideDevicePhotoButtons();
 if(typeof window.showSitesList==='function'){
   const sitesBtn=document.querySelector('nav [data-p="sites"]');
   if(sitesBtn){sitesBtn.click();setTimeout(()=>window.showSitesList(),0);}
 }
}

new MutationObserver(()=>setTimeout(hideDevicePhotoButtons,0)).observe(document.documentElement,{childList:true,subtree:true});
const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function')window.renderSiteDetailV7=function(id,tab='info'){const r=oldRender(id,tab);setTimeout(()=>{const sec=document.getElementById('sites');if(sec){const cards=sec.querySelectorAll('.card');cards.forEach(c=>c.style.maxWidth='none');}hideDevicePhotoButtons();},0);return r;};
setTimeout(setup,0);
})();
