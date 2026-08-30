(()=>{
if(window.__ppmLockDropdownV11)return;window.__ppmLockDropdownV11=true;
const $=id=>document.getElementById(id);
const escV=x=>typeof esc==='function'?esc(x??''):String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activeId=()=>Number(localStorage.getItem('ppmActiveSiteId'))||db.sites?.[0]?.id;
const oldForm=window.deviceFormV7;
const oldSave=window.saveDeviceV7;

function lockControls(a){
 const opts=['Electronic Strike','Mag Lock','Mortice','Drop Bolt','Trigger'];
 const current=a.lockType||'';
 const selected=opts.includes(current)?current:(current?'Other':'Electronic Strike');
 return `<div><label>Lock Type</label><select id=n11LockType onchange="toggleLockOtherV11()">${opts.map(x=>`<option ${selected===x?'selected':''}>${x}</option>`).join('')}<option ${selected==='Other'?'selected':''}>Other</option></select></div><div id=n11LockOtherWrap style="${selected==='Other'?'':'display:none'}"><label>Other Lock Type</label><input id=n11LockOther value="${escV(selected==='Other'?current:'')}"></div>`;
}
window.toggleLockOtherV11=()=>{const w=$('n11LockOtherWrap');if(w)w.style.display=$('n11LockType')?.value==='Other'?'':'none';};

window.deviceFormV7=(key,id)=>{
 if(key!=='access')return oldForm?.(key,id);
 const a=id?db.assets.find(x=>x.id===Number(id))||{}:{};const edit=!!id;
 const yesNo=(id,val)=>`<select id="${id}"><option value="No" ${String(val||'No')==='No'?'selected':''}>No</option><option value="Yes" ${String(val)==='Yes'?'selected':''}>Yes</option></select>`;
 const fields=`<div class=formgrid><div><label>Door number</label><input id=n7Door value="${escV(a.doorNumber||a.pointId||'')}"></div><div><label>Door / device name</label><input id=n7Name value="${escV(a.name||'')}"></div><div><label>Location</label><input id=n7Loc value="${escV(a.location||'')}"></div><div><label>Reader In</label><input id=n10ReaderIn value="${escV(a.readerIn||a.readerType||'')}"></div><div><label>Reader Out</label><input id=n10ReaderOut value="${escV(a.readerOut||'')}"></div>${lockControls(a)}<div><label>REX</label>${yesNo('n10Rex',a.rex)}</div><div><label>EBG</label>${yesNo('n10Ebg',a.ebg)}</div><div><label>Controller / Module</label><input id=n10Controller value="${escV(a.controllerModule||'')}"></div></div><label>Other</label><textarea id=n10Other rows=3>${escV(a.other||'')}</textarea>`;
 modal(`${edit?'Edit':'Add'} Access Control Device`,fields+`<br><button class=primary onclick="saveDeviceV7('access',${id||0})">Save</button>`);
};

window.saveDeviceV7=(key,id)=>{
 if(key!=='access')return oldSave?.(key,id);
 let a=id?db.assets.find(x=>x.id===Number(id)):null;if(!a){a={id:Date.now(),siteId:activeId()};db.assets.push(a);}a.siteId=activeId();
 const lockType=$('n11LockType').value==='Other'?$('n11LockOther').value.trim():$('n11LockType').value;
 Object.assign(a,{system:'Access Control',subtype:'Door',doorNumber:$('n7Door').value,pointId:$('n7Door').value,name:$('n7Name').value,location:$('n7Loc').value,readerIn:$('n10ReaderIn').value,readerOut:$('n10ReaderOut').value,lockType,rex:$('n10Rex').value,ebg:$('n10Ebg').value,controllerModule:$('n10Controller').value,other:$('n10Other').value,readerNumber:'',readerType:''});
 save();closeModal();window.renderSiteDetailV7(activeId(),'access');
};
})();