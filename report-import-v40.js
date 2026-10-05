(()=>{
'use strict';
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const siteId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
const access=id=>window.ppmSiteAccess?.(id)||{};
let activeWorker=null,preview=null,operation=0;
function fingerprint(id){const s=db.sites.find(s=>Number(s.id)===Number(id));return JSON.stringify(window.PPMSyncCore.payloadFor(db,s));}
window.ppmReportImportForm=()=>{
 const id=siteId();if(!access(id).editable)return alert('This site is read-only or needs Account review.');
 preview=null;operation++;activeWorker?.terminate();activeWorker=null;
 modal('Review Customer Configuration Report',`<p>Target site: <b>${esc(db.sites.find(s=>Number(s.id)===id)?.name)}</b></p><p>Imports configuration only. Existing manual data, photos, visit results and signoffs are retained.</p><p>Supported: Integriti controller / door / LAN-module .xls or .xlsx listings and PPM Asset List tables. Gallagher Wiring PDFs support configuration and proven relationships; unresolved endpoints remain flagged. Other PDFs provide text review only.</p><label>Report file</label><input id=ppmReportFile type=file accept=".xls,.xlsx,.pdf"><p class=tiny>Maximum 15 MiB. File contents are processed locally, with no report upload.</p><label>Assign unmatched assets to a head-end system (optional)</label><select id=ppmReportSystem><option value="">Use explicit source controller context</option>${window.PPMAssetFeatures.heads().map(h=>`<option value="${esc(h.id)}">${esc(h.name)} (${esc(h.platform||'Generic')})</option>`).join('')}</select><button id=ppmParseReport class=primary>Preview report</button><p id=ppmReportProgress></p>`);
 $('ppmParseReport').onclick=()=>parse(id);
};
async function parse(id){
 const file=$('ppmReportFile')?.files?.[0];if(!file)return alert('Choose a report.');if(file.size>PPMReportImport.LIMITS.fileBytes)return alert('Maximum report size is 15 MiB.');
 const token=++operation,wasVisible=$('modal')?.classList.contains('show');
 const identity=access(id),headEndId=$('ppmReportSystem').value,baseline=fingerprint(id);if(!identity.editable)return;
 $('ppmParseReport').disabled=true;$('ppmReportProgress').textContent='Reading local report…';
 try{
  const buffer=await file.arrayBuffer();if(token!==operation||!access(id).editable||access(id).generation!==identity.generation||siteId()!==id)return;
  const result=await new Promise((resolve,reject)=>{
   const worker=new Worker('./report-parser-worker.js?v=3');activeWorker=worker;
   const timeout=setTimeout(()=>{worker.terminate();reject(Error('Parser exceeded the 20-second limit. Try a smaller report.'));},20000);
   worker.onmessage=e=>{if(e.data?.kind!=='ppm-report-result')return;clearTimeout(timeout);worker.terminate();activeWorker=null;e.data.ok?resolve(e.data):reject(Error(e.data.error));};
   worker.onerror=()=>{clearTimeout(timeout);worker.terminate();activeWorker=null;reject(Error('The local report parser could not load. Check that all vendor files are available.'));};
   worker.postMessage({buffer,fileName:file.name},[buffer]);
  });
  if(token!==operation||wasVisible&&!$('modal')?.classList.contains('show')||!access(id).editable||access(id).generation!==identity.generation||access(id).owner!==identity.owner||siteId()!==id)return;
  if(result.pdfReview&&!result.parsed){modal('PDF Text Review — No Import',`<p>${esc(result.message)}</p>${result.pdfReview.pages.map(p=>`<details><summary>Page ${p.page}</summary><pre style="white-space:pre-wrap">${esc(p.items.map(i=>i.text).join(' '))}</pre></details>`).join('')}`);return;}
  const plan=PPMReportImport.buildPlan(result.parsed,db,id,headEndId);preview={plan,baseline,identity};renderPreview(file.name);
 }catch(error){if(token===operation)alert(error.message);}finally{if(token===operation&&$('ppmParseReport'))$('ppmParseReport').disabled=false;}
}
function renderPreview(fileName){
 const {plan}=preview,counts={};plan.items.forEach(x=>counts[x.action]=(counts[x.action]||0)+1);
 modal('Confirm Configuration Import',`<p><b>${esc(fileName)}</b> · ${esc(plan.format)}</p><p>Target: ${esc(db.sites.find(s=>Number(s.id)===plan.siteId)?.name)}</p><p>${esc(Object.entries(counts).map(([k,v])=>`${v} ${k}`).join(' · '))}</p><p>No existing record will be overwritten. Blocked identities require separate reconciliation. Only selected new records are created. Select their controllers/modules too, or unavailable parent links will remain flagged as unresolved.</p>${plan.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}<div style="max-height:45vh;overflow:auto">${plan.items.map((x,i)=>`<details><summary>${x.action==='add'?`<input type=checkbox data-import-index="${i}" checked>`:''}${esc(x.fields.name)} — ${esc(x.action)}</summary><p>${esc(x.reason)}</p>${x.differences?.length?`<p>Changed source fields requiring reconciliation: ${esc(x.differences.join(", "))}</p>`:""}<pre style="white-space:pre-wrap">${esc(JSON.stringify(x.fields,null,2))}</pre><p>Source: ${esc(x.provenance.page?`page ${x.provenance.page}, ${x.provenance.section}`:`${x.provenance.sheet} row ${x.provenance.row}`)}</p></details>`).join('')}</div><label><input id=ppmConfirmSourceSite type=checkbox> I checked the source site and controller context and confirm these selected records belong to the target site.</label><button id=ppmApplyReport class=primary>Apply selected new records</button>`);
 $('ppmApplyReport').onclick=apply;
}
function apply(){
 if(!preview)return;const {plan,baseline,identity}=preview,now=access(plan.siteId);
 if(siteId()!==plan.siteId||!now.editable||now.owner!==identity.owner||now.generation!==identity.generation)return alert('Site access changed. Open the report again.');
 if(fingerprint(plan.siteId)!==baseline)return alert('Site data changed while this preview was open. Reopen the report to review the current data.');
 if(!$('ppmConfirmSourceSite').checked)return alert('Confirm the source site/controller context before applying.');
 const selected=Array.from(document.querySelectorAll('[data-import-index]')).filter(el=>el.checked).map(el=>plan.items[Number(el.dataset.importIndex)].sourceKey);if(!selected.length)return alert('Select at least one new record.');
 try{const next=PPMReportImport.applyPlan(db,plan,selected,new Date().toISOString());window.PPMAssetFeatures.commit(draft=>Object.assign(draft,next));preview=null;closeModal();window.renderSiteDetailV7(plan.siteId,'info');}catch(error){console.error(error);alert('Import could not be saved locally. Existing data was retained. Free storage and retry; do not clear browser data.');}
}
function decorate(){const root=$('sites');if(!root||root.dataset.mode!=='detail'||$('ppmOpenReportImport'))return;const button=document.createElement('button');button.id='ppmOpenReportImport';button.className='secondary';button.textContent='Import configuration report';button.disabled=!access(siteId()).editable;button.onclick=window.ppmReportImportForm;root.appendChild(button);}
const old=window.renderSiteDetailV7;window.renderSiteDetailV7=function(...args){const r=old.apply(this,args);setTimeout(decorate,0);return r;};
})();
