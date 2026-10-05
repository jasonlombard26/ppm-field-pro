(()=>{
if(window.__ppmSiteTabsV8)return;window.__ppmSiteTabsV8=true;
function restoreTabs(id,tab){
 const sec=document.getElementById('sites');if(!sec||sec.dataset.mode!=='detail')return;
 const bar=sec.children[1];if(!bar)return;
 for(const [key,label] of [['intercom','Intercom'],['ppm','PPM Visits']]){
  let button=Array.from(bar.querySelectorAll('button')).find(b=>b.textContent.trim()===label);
  if(!button){button=document.createElement('button');button.textContent=label;bar.appendChild(button);}
  button.dataset.v8=key;button.className=tab===key?'primary':'secondary';button.style.whiteSpace='nowrap';
  button.onclick=()=>window.renderSiteDetailV7(Number(id),key);
 }
 if(tab==='ppm')Array.from(bar.querySelectorAll('button')).forEach(b=>{if(b.dataset.v8!=='ppm')b.className='secondary';});
}
const currentV7=window.renderSiteDetailV7,currentV6=window.renderSiteDetailV6;
window.renderSiteDetailV7=function(id,tab='info'){
 const result=currentV7?.(id,tab==='ppm'?'info':tab);
 if(tab==='ppm'){
  // Reuse the existing site-scoped visit renderer and actions, not another visit model.
  window.renderVisits?.();
  const sec=document.getElementById('sites'),source=document.getElementById('visits');
  if(sec?.dataset.mode==='detail'&&source){
   while(sec.children.length>2)sec.lastElementChild.remove();
   const content=source.cloneNode(true);content.removeAttribute('id');content.removeAttribute('class');content.dataset.ppmVisits='1';
   content.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
   sec.appendChild(content);
  }
 }
 restoreTabs(id,tab);return result;
};
window.renderSiteDetailV6=function(id,tab='info'){
 if(tab!=='info')return window.renderSiteDetailV7(id,tab);
 const result=currentV6?.(id,'info');restoreTabs(id,'info');return result;
};
window.openSiteV6=id=>{setActiveSite(id);setTimeout(()=>window.renderSiteDetailV7(id,'info'),0);};
})();
