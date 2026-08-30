(()=>{
if(window.__ppmHeadEndV31)return;window.__ppmHeadEndV31=true;

function applyHeadEndTab(siteId,selectedTab){
  const section=document.getElementById('sites');
  if(!section||section.dataset.mode!=='detail')return;

  const existing=section.querySelector('[data-ppm-head-end-tab]');
  let tabButton=existing;
  if(!tabButton){
    const batteriesButton=Array.from(section.querySelectorAll('button')).find(button=>button.textContent.trim()==='Batteries');
    const tabBar=batteriesButton?.parentElement;
    if(!tabBar)return;
    tabButton=document.createElement('button');
    tabButton.type='button';
    tabButton.dataset.ppmHeadEndTab='1';
    tabButton.textContent='Head End';
    tabButton.style.whiteSpace='nowrap';
    tabButton.onclick=()=>window.renderSiteDetailV7(Number(siteId),'headend');
    tabBar.appendChild(tabButton);
  }

  tabButton.className=selectedTab==='headend'?'primary':'secondary';
  if(selectedTab!=='headend')return;

  Array.from(tabButton.parentElement.children).forEach(button=>{
    if(button!==tabButton&&button.tagName==='BUTTON'){
      button.classList.remove('primary');
      button.classList.add('secondary');
    }
  });

  const body=document.getElementById('siteTabBodyV6');
  if(body)body.innerHTML='<div class="card"><h3 style="margin-top:0">Head End</h3><div class="notice">No Head End records have been added yet.</div></div>';
}

const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function'){
  window.renderSiteDetailV7=function(siteId,tab='info'){
    const result=oldRender.call(this,siteId,tab==='headend'?'info':tab);
    setTimeout(()=>applyHeadEndTab(siteId,tab),0);
    return result;
  };
  window.renderSiteDetailV6=(siteId,tab='info')=>window.renderSiteDetailV7(siteId,tab);
}

setTimeout(()=>{
  const siteId=Number(localStorage.getItem('ppmActiveSiteId'))||window.db?.sites?.[0]?.id;
  if(siteId)applyHeadEndTab(siteId,'info');
},250);
})();