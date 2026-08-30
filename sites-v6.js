(()=>{
if(window.__ppmSitesV6)return;window.__ppmSitesV6=true;
const $=id=>document.getElementById(id);
const activeId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
const active=()=>db.sites.find(s=>s.id===activeId())||db.sites[0];
const fmt=d=>d?new Date(d+'T00:00:00').toLocaleDateString('en-AU'):'—';
const latestVisit=sid=>db.visits.filter(v=>v.siteId===sid&&v.date).slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
const lastPpm=sid=>db.visits.filter(v=>v.siteId===sid&&v.date).slice().sort((a,b)=>b.date.localeCompare(a.date))[0]?.date||'';
const contacts=s=>{
  const out=[];
  if(s.contact1Name||s.contact1Phone)out.push({name:s.contact1Name||'',phone:s.contact1Phone||''});
  if(s.contact2Name||s.contact2Phone)out.push({name:s.contact2Name||'',phone:s.contact2Phone||''});
  if(!out.length){
    if(s.mainContact)out.push({name:s.mainContact,phone:s.mainContactPhone||''});
    if(s.siteContact&&s.siteContact!==s.mainContact)out.push({name:s.siteContact,phone:s.siteContactPhone||''});
  }
  return out;
};
const val=v=>esc(v||'—');
const infoRow=(label,value)=>`<div style="padding:10px 0;border-bottom:1px solid #e2e8f0"><div class="tiny muted">${label}</div><div style="font-weight:650;margin-top:2px">${value}</div></div>`;
const systemAssets=(sid,key)=>{
  const all=db.assets.filter(a=>a.siteId===sid);
  const text=a=>`${a.system||''} ${a.subtype||''} ${a.name||''} ${a.pointId||''}`.toLowerCase();
  if(key==='cctv')return all.filter(a=>(a.system||'').toLowerCase().includes('cctv'));
  if(key==='intercom')return all.filter(a=>(a.system||'').toLowerCase().includes('intercom'));
  if(key==='batteries')return all.filter(a=>/batter|psu|power supply/.test(text(a)));
  const ei=all.filter(a=>/eacs|ids|access|intrusion|alarm/.test((a.system||'').toLowerCase()));
  const intr=/intrusion|alarm|pir|reed|detector|sensor|duress|hold.?up|input|zone|siren|strobe/;
  const acc=/access|door|reader|controller|lock|rex|exit|terminal|keypad/;
  if(key==='intrusion')return ei.filter(a=>intr.test(text(a)));
  if(key==='access')return ei.filter(a=>acc.test(text(a))||!intr.test(text(a)));
  return [];
};
const assetCards=(sid,key)=>{
  const rows=systemAssets(sid,key);
  if(!rows.length)return '<div class="notice">No equipment has been assigned to this tab yet.</div>';
  return `<div class="muted tiny" style="margin-bottom:8px">${rows.length} item${rows.length===1?'':'s'}</div>`+rows.slice(0,500).map(a=>`<div class=card style="margin:0 0 8px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><b>${val(a.name||a.pointId||a.subtype)}</b><div class="tiny muted">${val(a.subtype)}${a.location||a.level||a.area?' · '+val(a.location||a.level||a.area):''}</div></div><button class=secondary onclick="assetHistory(${a.id})">History</button></div>${a.ip||a.model||a.controller?`<div class="tiny" style="margin-top:7px">${val([a.ip,a.model,a.controller].filter(Boolean).join(' · '))}</div>`:''}</div>`).join('');
};
window.showSitesList=()=>{
  const s=$('sites'); if(!s)return;
  s.dataset.mode='list';
  s.innerHTML=`<div class=card><div style="display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap"><div><h2 style="margin-bottom:4px">Sites</h2><div class="muted">Select a site to view its information and systems.</div></div><button class=primary onclick="siteFormV6()">+ Add Site</button></div><div style="margin-top:14px"><input id=siteSearchV6 placeholder="Search sites…" oninput="renderSiteListV6()"></div><div id=siteListV6 style="margin-top:12px"></div></div>`;
  renderSiteListV6();
};
window.renderSiteListV6=()=>{
  const el=$('siteListV6');if(!el)return;
  const q=($('siteSearchV6')?.value||'').trim().toLowerCase();
  const rows=db.sites.filter(s=>!q||`${s.name||''} ${s.address||''} ${contacts(s).map(c=>c.name+' '+c.phone).join(' ')}`.toLowerCase().includes(q));
  el.innerHTML=rows.length?rows.map(s=>{
    const v=latestVisit(s.id), cs=contacts(s);
    return `<button onclick="openSiteV6(${s.id})" style="display:block;width:100%;text-align:left;background:white;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:9px;color:#0f172a"><div style="display:flex;justify-content:space-between;gap:10px"><div><div style="font-weight:800;font-size:16px">${val(s.name)}</div><div class="muted" style="margin-top:3px">${val(s.address||'Address not entered')}</div></div><span style="font-size:20px">›</span></div><div class="tiny muted" style="margin-top:8px">${cs.length?val(cs.map(c=>c.name+(c.phone?' · '+c.phone:'')).join(' | ')):'No contacts entered'}${v?.date?' · Last PPM '+fmt(v.date):''}</div></button>`;
  }).join(''):'<div class=notice>No sites match your search.</div>';
};
window.openSiteV6=id=>{setActiveSite(id);setTimeout(()=>renderSiteDetailV6(id,'headend'),0)};
window.renderSiteDetailV6=(id,tab='info')=>{
  const s=db.sites.find(x=>x.id===Number(id));if(!s)return showSitesList();
  const sec=$('sites');if(!sec)return;
  sec.dataset.mode='detail';
  const v=latestVisit(s.id), cs=contacts(s);
  const tabs=[['info','Site Information'],['headend','Head End'],['access','Access Control'],['intrusion','Intrusion'],['cctv','CCTV'],['intercom','Intercom'],['batteries','Batteries']];
  let body='';
  if(tab==='info'){
    body=`<div class=card><div style="display:flex;justify-content:space-between;gap:10px;align-items:start;flex-wrap:wrap"><h3 style="margin:0">Site Information</h3><button class=secondary onclick="editSiteV6(${s.id})">Edit</button></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 22px;margin-top:8px">${infoRow('Site name',val(s.name))}${infoRow('Address',val(s.address))}${infoRow('Monitoring centre',val(s.monitoringCentre))}${infoRow('Monitoring account number',val(s.monitoringAccountNumber))}${infoRow('Last PPM',fmt(lastPpm(s.id)))}${infoRow('Last other work onsite',fmt(s.lastOtherWorkDate))}${infoRow('Last technician onsite',val(v?.tech||s.lastTechnician))}${infoRow('PPM frequency',s.ppmFrequencyMonths?val(s.ppmFrequencyMonths+' months'):'—')}</div></div><div class=card><h3>Site Contacts</h3>${cs.length?cs.map((c,i)=>infoRow('Contact '+(i+1),`<span>${val(c.name)}</span>${c.phone?`<br><a href="tel:${esc(c.phone)}">${val(c.phone)}</a>`:''}`)).join(''):'<div class=notice>No contacts entered.</div>'}</div>`;
  }else body=`<div class=card><h3 style="margin-top:0">${tabs.find(t=>t[0]===tab)[1]}</h3>${assetCards(s.id,tab)}</div>`;
  sec.innerHTML=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><button class=secondary onclick="showSitesList()">← Sites</button><div><h2 style="margin:0">${val(s.name)}</h2><div class="tiny muted">${val(s.address||'')}</div></div></div><div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:8px;margin-bottom:6px">${tabs.map(t=>`<button class="${t[0]===tab?'primary':'secondary'}" style="white-space:nowrap" onclick="renderSiteDetailV6(${s.id},'${t[0]}')">${t[1]}</button>`).join('')}</div><div id=siteTabBodyV6>${body}</div>`;
};
window.siteFormV6=()=>modal('Add Site',`<div class=formgrid><div><label>Site name</label><input id=s6Name></div><div><label>Address</label><input id=s6Addr></div><div><label>Contact 1 name</label><input id=s6C1></div><div><label>Contact 1 phone</label><input id=s6P1 type=tel></div><div><label>Contact 2 name</label><input id=s6C2></div><div><label>Contact 2 phone</label><input id=s6P2 type=tel></div><div><label>Monitoring centre</label><input id=s6Mon></div><div><label>Monitoring account number</label><input id=s6Acct></div><div><label>PPM frequency (months)</label><select id=s6Freq><option>1</option><option>3</option><option selected>6</option><option>12</option></select></div></div><br><button class=primary onclick="addSiteV6()">Save Site</button>`);
window.addSiteV6=()=>{const n=s6Name.value.trim();if(!n)return alert('Enter a site name.');const id=Date.now();db.sites.push({id,name:n,address:s6Addr.value,contact1Name:s6C1.value,contact1Phone:s6P1.value,contact2Name:s6C2.value,contact2Phone:s6P2.value,monitoringCentre:s6Mon.value,monitoringAccountNumber:s6Acct.value,ppmFrequencyMonths:Number(s6Freq.value)});save();closeModal();showSitesList()};
window.editSiteV6=id=>{const s=db.sites.find(x=>x.id===Number(id));if(!s)return;const c=contacts(s);modal('Edit Site',`<div class=formgrid><div><label>Site name</label><input id=e6Name value="${esc(s.name||'')}"></div><div><label>Address</label><input id=e6Addr value="${esc(s.address||'')}"></div><div><label>Contact 1 name</label><input id=e6C1 value="${esc(c[0]?.name||'')}"></div><div><label>Contact 1 phone</label><input id=e6P1 type=tel value="${esc(c[0]?.phone||'')}"></div><div><label>Contact 2 name</label><input id=e6C2 value="${esc(c[1]?.name||'')}"></div><div><label>Contact 2 phone</label><input id=e6P2 type=tel value="${esc(c[1]?.phone||'')}"></div><div><label>Monitoring centre</label><input id=e6Mon value="${esc(s.monitoringCentre||'')}"></div><div><label>Monitoring account number</label><input id=e6Acct value="${esc(s.monitoringAccountNumber||'')}"></div><div><label>Last other work onsite</label><input id=e6Other type=date value="${esc(s.lastOtherWorkDate||'')}"></div><div><label>Last technician (manual fallback)</label><input id=e6Tech value="${esc(s.lastTechnician||'')}"></div></div><br><button class=primary onclick="saveSiteV6(${s.id})">Save Changes</button>`)};
window.saveSiteV6=id=>{const s=db.sites.find(x=>x.id===Number(id));if(!s)return;s.name=e6Name.value.trim()||s.name;s.address=e6Addr.value;s.contact1Name=e6C1.value;s.contact1Phone=e6P1.value;s.contact2Name=e6C2.value;s.contact2Phone=e6P2.value;s.monitoringCentre=e6Mon.value;s.monitoringAccountNumber=e6Acct.value;s.lastOtherWorkDate=e6Other.value;s.lastTechnician=e6Tech.value;save();closeModal();renderSiteDetailV6(s.id,'info')};
const oldRenderSites=window.renderSites;
window.renderSites=()=>{if(typeof oldRenderSites==='function')oldRenderSites();const p=$('sitePicker');if(p)p.innerHTML=db.sites.map(s=>`<option value="${s.id}" ${s.id===activeId()?'selected':''}>${esc(s.name)}</option>`).join('');if($('sites')?.classList.contains('active')){if($('sites').dataset.mode==='detail')renderSiteDetailV6(activeId(),'headend');else showSitesList();}};
const sitesBtn=document.querySelector('nav [data-p="sites"]');if(sitesBtn)sitesBtn.addEventListener('click',()=>setTimeout(showSitesList,0));
if($('sites')?.classList.contains('active'))showSitesList();
})();