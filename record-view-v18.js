(()=>{
if(window.__ppmRecordViewV18)return;window.__ppmRecordViewV18=true;
const escv=x=>typeof esc==='function'?esc(x??''):String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const assetById=id=>(window.db?.assets||[]).find(a=>String(a.id)===String(id));
const labels={doorNumber:'Door Number',name:'Name',location:'Location',readerIn:'Reader In',readerOut:'Reader Out',lockType:'Lock Type',rex:'REX',ebg:'EBG',controllerModule:'Controller / Module',other:'Other',cameraName:'Camera Name',cameraType:'Camera Type',model:'Model Number',ip:'IP Address',subnetMask:'Subnet Mask',gateway:'Gateway',userLogin:'User Login',password:'Password',batteryNumber:'Battery Number',batteryInstallationDate:'Battery Installation Date',batteryType:'Battery Type',batteryVoltage:'Battery Voltage',loadTestVoltage:'Voltage After Load Test',quantity:'Quantity',connectedPanel:'Connected Panel / Power Supply',chargerVoltage:'Charger Voltage',physicalCondition:'Physical Condition',replacementDueDate:'Replacement Due Date',notes:'Notes'};
function systemKey(a){const s=String(a?.system||'').toLowerCase();if(s.includes('access'))return'access';if(s.includes('cctv'))return'cctv';if(s.includes('batter')||s.includes('power'))return'batteries';return'other';}
function titleFor(a){return a?.name||a?.cameraName||a?.doorNumber||a?.batteryNumber||a?.pointId||'Record';}
function fieldsFor(a){const key=systemKey(a);const keys=key==='access'?['doorNumber','name','location','readerIn','readerOut','lockType','rex','ebg','controllerModule','other']:key==='cctv'?['cameraName','location','cameraType','model','ip','subnetMask','gateway','userLogin','password']:key==='batteries'?['batteryNumber','location','batteryInstallationDate','batteryType','batteryVoltage','loadTestVoltage','quantity','connectedPanel','chargerVoltage','physicalCondition','replacementDueDate','notes']:Object.keys(a||{}).filter(k=>!['id','siteId'].includes(k));return keys.map(k=>[labels[k]||k,a?.[k]??'']);}
function textFor(a){return `${titleFor(a)}\n\n`+fieldsFor(a).map(([k,v])=>`${k}: ${v||'—'}`).join('\n');}
function csvFor(a){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return 'Field,Value\n'+fieldsFor(a).map(([k,v])=>`${q(k)},${q(v)}`).join('\n');}
function saveBlob(name,type,data){const b=new Blob([data],{type}),u=URL.createObjectURL(b),x=document.createElement('a');x.href=u;x.download=name;document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
window.exportRecordV18=id=>{const a=assetById(id);if(a)saveBlob(`${titleFor(a).replace(/[^a-z0-9_-]+/gi,'-')||'record'}.csv`,'text/csv;charset=utf-8',csvFor(a));};
window.downloadRecordV18=id=>{const a=assetById(id);if(a)saveBlob(`${titleFor(a).replace(/[^a-z0-9_-]+/gi,'-')||'record'}.txt`,'text/plain;charset=utf-8',textFor(a));};
window.shareRecordV18=async id=>{const a=assetById(id);if(!a)return;const text=textFor(a);try{if(navigator.share)await navigator.share({title:titleFor(a),text});else if(navigator.clipboard){await navigator.clipboard.writeText(text);alert('Record copied to clipboard.');}else alert('Sharing is not supported on this device.');}catch(e){if(e?.name!=='AbortError')alert('Could not share this record.');}};
window.openRecordViewV18=id=>{const a=assetById(id);if(!a)return alert('Record not found.');const key=systemKey(a);const rows=fieldsFor(a).map(([k,v])=>`<div style="padding:9px 0;border-bottom:1px solid #e2e8f0"><div class="tiny muted">${escv(k)}</div><div style="font-weight:600;white-space:pre-wrap">${escv(v||'—')}</div></div>`).join('');const photos=(window.db?.photos||[]).filter(p=>String(p.assetRef)===String(a.id)&&p.data).map(p=>`<img src="${escv(p.data)}" alt="${escv(p.label||'Photo')}" style="width:110px;height:82px;object-fit:cover;border-radius:8px;margin:4px;cursor:zoom-in">`).join('');const body=`<div style="max-height:62vh;overflow:auto">${rows}${photos?`<div style="margin-top:12px"><div class="tiny muted" style="margin-bottom:4px">Photos</div>${photos}</div>`:''}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px"><button class=secondary onclick="exportRecordV18(${JSON.stringify(a.id)})">Export</button><button class=secondary onclick="shareRecordV18(${JSON.stringify(a.id)})">Share</button><button class=secondary onclick="downloadRecordV18(${JSON.stringify(a.id)})">Download</button><button class=primary onclick="closeModal();editDeviceV7(${JSON.stringify(a.id)},'${key}')">Edit</button></div>`;if(typeof modal==='function')modal(titleFor(a),body);};
function bind(){
 document.querySelectorAll('#sites button[onclick*="editDeviceV7("]').forEach(edit=>{
  const raw=String(edit.getAttribute('onclick')||'');
  const m=raw.match(/editDeviceV7\(([^,]+),\s*['\"]([^'\"]+)['\"]\)/);if(!m)return;
  const id=m[1].replace(/["']/g,'').trim();
  const card=edit.closest('.card');if(!card)return;
  const title=card.querySelector('b');if(!title)return;
  title.dataset.recordViewV18=id;
  title.style.cursor='pointer';title.style.textDecoration='underline';title.style.textUnderlineOffset='3px';title.title='Open record details';
  title.onclick=function(ev){ev.preventDefault();ev.stopPropagation();window.openRecordViewV18(id);return false;};
 });
}
const queue=()=>setTimeout(bind,0);
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
const oldRender=window.renderSiteDetailV7;
if(typeof oldRender==='function')window.renderSiteDetailV7=function(...args){const r=oldRender.apply(this,args);setTimeout(bind,20);setTimeout(bind,300);return r;};
bind();setTimeout(bind,200);setTimeout(bind,1000);
})();