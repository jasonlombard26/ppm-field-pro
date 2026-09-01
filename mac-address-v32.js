(()=>{
if(window.__ppmMacAddressV32)return;window.__ppmMacAddressV32=true;
const $=id=>document.getElementById(id);
const activeId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||window.db?.sites?.[0]?.id;
const escMac=v=>typeof window.esc==='function'?window.esc(v??''):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function insertMacField(ipInputId,macInputId,value){
 const ip=$(ipInputId);if(!ip||$(macInputId))return;
 const wrap=ip.closest('div');if(!wrap)return;
 const field=document.createElement('div');
 field.dataset.ppmMacField='1';
 field.innerHTML=`<label>MAC Address</label><input id="${macInputId}" value="${escMac(value||'')}" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="00:11:22:33:44:55">`;
 wrap.insertAdjacentElement('afterend',field);
}

function findNewAsset(beforeIds,predicate){
 return (window.db?.assets||[]).slice().reverse().find(a=>!beforeIds.has(a.id)&&a.siteId===activeId()&&predicate(a));
}

function renderMacValues(){
 const root=$('sites');if(!root)return;
 for(const a of window.db?.assets||[]){
  if(a.siteId!==activeId()||!a.ip||!a.macAddress)continue;
  const marker=`IP: ${a.ip}`;
  root.querySelectorAll('.tiny').forEach(el=>{
   const text=el.textContent||'';
   if(text.includes(marker)&&!text.includes('MAC:'))el.textContent=`${text} · MAC: ${a.macAddress}`;
  });
 }
}

const oldDeviceForm=window.deviceFormV7;
if(typeof oldDeviceForm==='function'){
 window.deviceFormV7=function(key,id){
  const result=oldDeviceForm.call(this,key,id);
  if(key==='cctv'){
   const a=id?(window.db?.assets||[]).find(x=>x.id===Number(id)):null;
   setTimeout(()=>insertMacField('n7IP','n32Mac',a?.macAddress||a?.mac||''),0);
  }
  return result;
 };
}

const oldDeviceSave=window.saveDeviceV7;
if(typeof oldDeviceSave==='function'){
 window.saveDeviceV7=function(key,id){
  if(key!=='cctv')return oldDeviceSave.call(this,key,id);
  const mac=$('n32Mac')?.value?.trim()||'';
  const beforeIds=new Set((window.db?.assets||[]).map(a=>a.id));
  const result=oldDeviceSave.call(this,key,id);
  const target=id?(window.db?.assets||[]).find(a=>a.id===Number(id)):findNewAsset(beforeIds,a=>(a.system||'').toLowerCase().includes('cctv'));
  if(target){target.macAddress=mac;target.mac='';if(typeof window.save==='function')window.save();}
  setTimeout(renderMacValues,0);
  return result;
 };
}

const oldControllerForm=window.controllerFormV41;
if(typeof oldControllerForm==='function'){
 window.controllerFormV41=function(id){
  const result=oldControllerForm.call(this,id);
  const a=id?(window.db?.assets||[]).find(x=>x.id===Number(id)):null;
  setTimeout(()=>insertMacField('v41ControllerIp','v32ControllerMac',a?.macAddress||a?.mac||''),0);
  return result;
 };
}

const oldControllerSave=window.saveControllerV41;
if(typeof oldControllerSave==='function'){
 window.saveControllerV41=function(id){
  const mac=$('v32ControllerMac')?.value?.trim()||'';
  const beforeIds=new Set((window.db?.assets||[]).map(a=>a.id));
  const result=oldControllerSave.call(this,id);
  const target=id?(window.db?.assets||[]).find(a=>a.id===Number(id)):findNewAsset(beforeIds,a=>(a.system||'').toLowerCase().includes('access')&&/controller/i.test(`${a.subtype||''} ${a.name||''}`));
  if(target){target.macAddress=mac;target.mac='';if(typeof window.save==='function')window.save();}
  setTimeout(renderMacValues,0);
  return result;
 };
}

const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function'){
 window.renderSiteDetailV7=function(siteId,tab='info'){
  const result=oldRender.call(this,siteId,tab);
  setTimeout(renderMacValues,0);
  return result;
 };
}

new MutationObserver(()=>setTimeout(renderMacValues,0)).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(renderMacValues,100);
})();
