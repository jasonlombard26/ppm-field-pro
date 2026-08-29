(()=>{
if(window.__ppmSiteTabsV8)return;window.__ppmSiteTabsV8=true;
const addLatestTabs=(id)=>{const sec=document.getElementById('sites');if(!sec||sec.children.length<2)return;const bar=sec.children[1];if(!bar||bar.querySelector('[data-v8="ppm"]'))return;const mk=(key,label)=>{const b=document.createElement('button');b.className='secondary';b.style.whiteSpace='nowrap';b.dataset.v8=key;b.textContent=label;b.onclick=()=>window.renderSiteDetailV7(Number(id),key);return b;};bar.appendChild(mk('ppm','PPM Visits'));bar.appendChild(mk('integriti','Integriti Inputs'));};
const currentV6=window.renderSiteDetailV6;
window.renderSiteDetailV6=(id,tab='info')=>{if(tab!=='info'&&window.renderSiteDetailV7)return window.renderSiteDetailV7(id,tab);const r=currentV6?.(id,'info');setTimeout(()=>addLatestTabs(id),0);return r;};
window.openSiteV6=id=>{setActiveSite(id);setTimeout(()=>{window.renderSiteDetailV6(id,'info');addLatestTabs(id);},0);};
})();