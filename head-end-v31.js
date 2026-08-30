(()=>{
if(window.__ppmHeadEndV31)return;window.__ppmHeadEndV31=true;
let currentTab='info';
let applying=false;

function applySiteTabs(siteId){
  if(applying)return;
  applying=true;
  try{
    const section=document.getElementById('sites');
    if(!section||section.dataset.mode!=='detail')return;

    Array.from(section.querySelectorAll('button')).forEach(button=>{
      if(/^PPM(?: Visits)?$/i.test(button.textContent.trim()))button.remove();
    });

    let tabButton=section.querySelector('[data-ppm-head-end-tab]');
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
      tabBar.insertBefore(tabButton,batteriesButton);
    }

    tabButton.className=currentTab==='headend'?'primary':'secondary';
    if(currentTab!=='headend')return;

    Array.from(tabButton.parentElement.children).forEach(button=>{
      if(button!==tabButton&&button.tagName==='BUTTON'){
        button.classList.remove('primary');
        button.classList.add('secondary');
      }
    });

    const body=document.getElementById('siteTabBodyV6');
    const html='<div class="card"><h3 style="margin-top:0">Head End</h3><div class="notice">No Head End records have been added yet.</div></div>';
    if(body)body.innerHTML=html;
    else{
      const tabBar=tabButton.parentElement;
      let content=tabBar.nextElementSibling;
      if(!content){
        content=document.createElement('div');
        tabBar.insertAdjacentElement('afterend',content);
      }
      content.innerHTML=html;
    }
  }finally{
    applying=false;
  }
}

const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function'){
  window.renderSiteDetailV7=function(siteId,tab='info'){
    currentTab=tab==='ppm'?'info':tab;
    const result=oldRender.call(this,siteId,tab==='headend'||tab==='ppm'?'info':tab);
    setTimeout(()=>applySiteTabs(siteId),0);
    return result;
  };
  window.renderSiteDetailV6=(siteId,tab='info')=>window.renderSiteDetailV7(siteId,tab);
}

const refresh=()=>{
  const siteId=Number(localStorage.getItem('ppmActiveSiteId'))||window.db?.sites?.[0]?.id;
  if(siteId)applySiteTabs(siteId);
};
new MutationObserver(()=>setTimeout(refresh,0)).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(refresh,50);
setTimeout(refresh,250);
setTimeout(refresh,1000);
})();