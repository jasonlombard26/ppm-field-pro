const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {parseHTML}=require('linkedom'),Core=require('../sync-core.js');
const root=path.resolve(__dirname,'..');
function harness(records=[],role='technician'){
 const {document}=parseHTML('<html><body><section id=sites data-mode=detail><div class=card></div></section><div id=modal></div></body></html>');
 const map=new Map([['ppmActiveSiteId','1']]),alerts=[],timers=[],uploads=[],removes=[];
 const h={document,db:{sites:[{id:1,name:'Test'}],assets:structuredClone(records),photos:[]},navigator:{userAgent:'Windows',onLine:false},console,crypto:require('node:crypto').webcrypto,Blob,fetch,URL,Date,Set,Map,Number,String,JSON,Promise,
  localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>{if(h.quota)throw new Error('quota');map.set(k,v);}},setTimeout:fn=>{timers.push(fn);return timers.length;},setInterval:()=>0,clearTimeout:()=>{},MutationObserver:class{observe(){}},CSS:{escape:x=>x},
  alert:x=>alerts.push(x),confirm:()=>true,prompt:()=>null,addEventListener:()=>{},
  ppmSiteAccess:()=>({editable:!h.frozen&&['admin','technician','offline'].includes(h.role),readable:!h.frozen,cloud:!h.frozen&&['admin','technician'].includes(h.role),admin:h.role==='admin',owner:'account-a',generation:h.generation}),
  modal:(title,html)=>{document.getElementById('modal').innerHTML=html;document.querySelectorAll('#modal input[type=checkbox]').forEach(e=>e.checked=e.hasAttribute('checked'));document.querySelectorAll('#modal select').forEach(e=>{Object.defineProperty(e,'value',{writable:true,value:e.querySelector('option[selected]')?.value??e.querySelector('option')?.value??''});});},closeModal:()=>{document.getElementById('modal').innerHTML='';},esc:x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  renderSiteDetailV7:()=>{document.getElementById('sites').innerHTML='<div class=card></div>';},deviceFormV7:()=>{},saveDeviceV7:()=>{},role,generation:1};
 h.window=h;h.FileReader=class{readAsDataURL(f){this.result=`data:${f.type};base64,${Buffer.from(f.body||'photo').toString('base64')}`;this.onload();}};
 h.save=()=>h.localStorage.setItem('ppmV3Data',JSON.stringify(h.db));
 h.ppmSupabase={auth:{getSession:async()=>({data:{session:{user:{id:'account-a'}}}})},storage:{from:()=>({upload:async(p,f)=>{uploads.push(p);await h.onUpload?.(p,f);return {error:h.uploadError||null};},createSignedUrl:async p=>({data:{signedUrl:'https://example.test/'+p}}),list:async()=>({data:h.listedFiles||[],error:null}),remove:async p=>{removes.push(p);return {data:[],error:null};}})}};
 const context=vm.createContext(h);
 for(const f of ['field-updates-v10.js','cloud-photos-v8.js','backups-v34.js','photo-actions-v15.js','asset-features-v39.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
 return {h,document,alerts,uploads,removes,map,clickInline:selector=>vm.runInContext(document.querySelector(selector).getAttribute('onclick'),context),set:(id,v)=>{const el=document.getElementById(id);if(el.tagName==='SELECT'&&!Object.hasOwn(el,'value'))Object.defineProperty(el,'value',{writable:true,value:v});else el.value=v;},flush:()=>{let count=0;while(timers.length&&count++<100)timers.shift()();assert.ok(count<100,'timer loop');}};
}
const record=(id,system,subtype)=>({id,siteId:1,system,subtype,name:`Asset ${id}`});
const inventory=[record(1,'CCTV','Camera'),record(2,'Access Control','Door'),record(3,'Access Control','Controller'),record(4,'Intrusion','Input'),{...record(5,'Intrusion','Intrusion Device'),recordType:'intrusionDevice'},record(6,'Power / Batteries','Battery'),record(7,'Intercom','Master'),record(8,'EACS & IDS','Keypad'),record(9,'Network','Switch'),record(10,'Custom','Unknown'),{...record(11,'Head End','Server'),recordType:'headEnd',headEnd:true,appliesTo:['access','intrusion']}];
for(const platform of ['mobile','desktop'])test(`${platform}: every category has photo entry and multiple persisted attachments`,async()=>{
 const x=harness(inventory);x.h.navigator.userAgent=platform==='mobile'?'Android':'Windows';
 x.h.renderSiteDetailV7(1,'info');x.flush();
 assert.equal(x.document.querySelectorAll('[data-ppm-assets] button[onclick^="ppmAssetGallery"]').length,inventory.length);
 for(const a of inventory){x.h.addDevicePhotoV7(a.id);Object.defineProperty(x.document.getElementById('n7PhotoFile'),'files',{value:[{type:'image/png',size:20},{type:'image/jpeg',size:30}]});await x.h.saveDevicePhotoV7(a.id);}
 assert.equal(x.h.db.photos.length,inventory.length*2);
 assert.equal(JSON.parse(x.map.get('ppmV3Data')).photos.length,inventory.length*2);
 assert.ok(x.h.db.photos.every(p=>p.pendingUpload&&p.siteId===1));
 for(const a of inventory)assert.equal(x.h.db.photos.filter(p=>p.assetRef===String(a.id)).length,2);
});
test('input edit retains old module, fields, leading zeroes and unrelated records',()=>{
 const old={...inventory[3],module:'Old expander X',notes:'keep',custom:{x:1}};const x=harness([old,inventory[0]]);
 x.h.ppmInputForm(4);assert.equal(x.document.getElementById('ppmModuleType').value,'');
 x.set('ppmModuleType','Manufacturer custom I/O');x.set('ppmModuleNumber','001/A');x.h.ppmSaveInput(4);
 const saved=JSON.parse(x.map.get('ppmV3Data'));assert.equal(saved.assets[0].module,'Old expander X');assert.equal(saved.assets[0].moduleNumber,'001/A');assert.deepEqual(saved.assets[0].custom,{x:1});assert.deepEqual(saved.assets[1],inventory[0]);
 assert.equal(Core.payloadFor(saved,saved.sites[0]).assets[0].moduleType,'Manufacturer custom I/O');
});
test('shared head end edits use one ID in both sections; other systems and files remain separate',()=>{
 const one={...inventory[10],name:'Combined',platform:'Integriti'},two={...inventory[10],id:12,name:'Combined',platform:'Gallagher'};
 const x=harness([one,two]);x.h.db.photos=[{id:'legacy',siteId:1,assetRef:'11',cloudPath:'sites/1/access-control/11/original.jpg'}];x.h.db.headEndBackupLinks=[{siteId:1,assetRef:'11',cloudPath:'sites/1/head-end/backups/old.zip'}];
 x.h.ppmHeadForm(11);x.set('ppmHeadName','Renamed once');x.h.ppmSaveHead(11);
 for(const tab of ['access','intrusion']){x.h.renderSiteDetailV7(1,tab);x.flush();assert.match(x.document.querySelector('[data-ppm-heads]').textContent,/Renamed once/);}
 assert.equal(x.h.db.assets.length,2);assert.equal(x.h.db.assets[1].name,'Combined');assert.equal(x.h.db.photos[0].cloudPath,'sites/1/access-control/11/original.jpg');assert.equal(x.h.db.headEndBackupLinks[0].assetRef,'11');
 const payload=Core.payloadFor(x.h.db,x.h.db.sites[0]);assert.equal(payload.assets.length,2);assert.equal(payload.headEndBackupLinks[0].cloudPath,'sites/1/head-end/backups/old.zip');
});
test('explicit legacy head-end adoption preserves ID, old folder and unknown properties',()=>{
 const x=harness([{...inventory[2],serialNumber:'existing',extra:'retain'}]);x.h.ppmHeadForm(3);x.h.ppmSaveHead(3);
 assert.equal(x.h.db.assets.length,1);assert.equal(x.h.db.assets[0].id,3);assert.equal(x.h.db.assets[0].photoSection,'access-control');assert.equal(x.h.db.assets[0].extra,'retain');
});
test('profiles apply per linked system, fall back safely, and switching preserves input data',()=>{
 const x=harness([{...inventory[10],platform:'Integriti'},{...inventory[10],id:12,platform:'Gallagher'}, {...inventory[3],headEndId:'11',area:'003',moduleNumber:'A-01'}, {...inventory[3],id:13,headEndId:'12'}]);
 assert.equal(x.h.ppmTerminology(x.h.db.assets[2]).input,'Zone Input');assert.equal(x.h.ppmTerminology(x.h.db.assets[3]).area,'Alarm Zone');
 const before=JSON.stringify(x.h.db.assets[2]);x.h.ppmHeadForm(11);x.set('ppmPlatform','Gallagher');x.h.ppmSaveHead(11);assert.equal(JSON.stringify(x.h.db.assets[2]),before);assert.equal(x.h.ppmTerminology(x.h.db.assets[2]).area,'Alarm Zone');
 x.h.db.assets[0].platform='Future Vendor';assert.equal(x.h.ppmTerminology(x.h.db.assets[2]).area,'Intrusion Area');
});
for(const role of ['viewer','outsider'])test(`${role}: all photo categories and new record mutations are denied`,async()=>{
 const x=harness(inventory,role),before=JSON.stringify(x.h.db);
 for(const a of inventory){x.h.addDevicePhotoV7(a.id);await x.h.saveDevicePhotoV7(a.id);x.h.ppmAssignSystem(a.id);}
 x.h.ppmInputForm(4);x.h.ppmSaveInput(4);x.h.ppmHeadForm(11);x.h.ppmSaveHead(11);await x.h.PPMAssetFeatures.uploadPending(1);
 assert.equal(JSON.stringify(x.h.db),before);assert.equal(x.uploads.length,0);
});
test('photo size/MIME and quota failures retain old records',async()=>{
 const x=harness(inventory);x.h.addDevicePhotoV7(1);Object.defineProperty(x.document.getElementById('n7PhotoFile'),'files',{value:[{type:'image/svg+xml',size:10}]});await x.h.saveDevicePhotoV7(1);assert.equal(x.h.db.photos.length,0);
 x.h.addDevicePhotoV7(1);Object.defineProperty(x.document.getElementById('n7PhotoFile'),'files',{value:[{type:'image/png',size:3*1024*1024}]});await x.h.saveDevicePhotoV7(1);assert.equal(x.h.db.photos.length,0);
 x.h.quota=true;x.h.ppmInputForm(4);x.set('ppmModuleNumber','new');x.h.ppmSaveInput(4);assert.equal(x.h.db.assets[3].moduleNumber,undefined);
});
test('pending upload failure is retained; successful retry keeps stable asset reference',async()=>{
 const x=harness(inventory);x.h.addDevicePhotoV7(1);Object.defineProperty(x.document.getElementById('n7PhotoFile'),'files',{value:[{type:'image/png',size:20}]});await x.h.saveDevicePhotoV7(1);
 x.h.navigator.onLine=true;x.h.uploadError={message:'offline'};await x.h.PPMAssetFeatures.uploadPending(1);assert.equal(x.h.db.photos[0].pendingUpload,true);
 x.h.uploadError=null;await x.h.PPMAssetFeatures.uploadPending(1);assert.equal(x.h.db.photos[0].pendingUpload,false);assert.equal(x.h.db.photos[0].assetRef,'1');assert.equal(x.h.db.photos[0].cloudPath,x.uploads[0]);
});
test('both actual loaders load features after photo/backups and retain guarded startup',()=>{
 for(const file of ['index.html','pc.html']){const source=fs.readFileSync(path.join(root,file),'utf8');assert.ok(source.indexOf('asset-features-v39.js')>source.indexOf('backups-v34.js'));assert.ok(!source.includes('pc-device-cleanup-v27.js'));assert.ok(!source.includes('battery-photo-dedupe-v30.js'));assert.match(source,/await window.ppmCacheReady/);}
});
for(const a of inventory)test(`${a.system}/${a.subtype}: local and cloud photo removal preserve other attachments`,async()=>{
 const x=harness(inventory);x.h.db.photos=[{id:'local',siteId:1,assetRef:String(a.id),data:'data:image/png;base64,YQ=='},{id:'cloud',siteId:1,assetRef:String(a.id),cloudPath:`sites/1/other/${a.id}/old.png`,data:'https://example.test/old.png'},{id:'keep',siteId:1,assetRef:String(a.id),data:'data:image/png;base64,Yg=='}];
 for(const id of ['local','cloud']){x.h.openPhotoActionsV15(id);x.document.querySelector('[data-a=delete]').click();x.document.querySelector('[data-a=confirm-delete]').click();await new Promise(resolve=>setImmediate(resolve));}
 assert.equal(x.h.db.photos.length,1);assert.equal(x.h.db.photos[0].id,'keep');assert.equal(x.removes.length,1);assert.equal(JSON.parse(x.map.get('ppmV3Data')).photos[0].id,'keep');
 assert.equal(Core.payloadFor(x.h.db,x.h.db.sites[0]).photos,undefined,'binary photo cache is not inserted into site CAS payload');
});
test('viewer cannot rename/remove photos or delete backup objects',async()=>{
 const x=harness(inventory,'viewer');x.h.db.photos=[{id:'p',siteId:1,assetRef:'1',data:'data:image/png;base64,YQ=='}];x.h.openPhotoActionsV15('p');x.document.querySelector('[data-a=delete]').click();await x.h.deleteBackupV34('old.zip');
 assert.equal(x.h.db.photos.length,1);assert.equal(x.removes.length,0);
});
test('backup association is one reference shared by both applicability views and serialized once',()=>{
 const x=harness(inventory);const path='sites/1/head-end/backups/unchanged.zip';assert.equal(x.h.ppmLinkBackupPath(1,path,'11'),true);assert.equal(x.h.ppmLinkBackupPath(1,path,'11'),true);
 assert.equal(x.h.db.headEndBackupLinks.length,1);assert.equal(Core.payloadFor(x.h.db,x.h.db.sites[0]).headEndBackupLinks.length,1);assert.equal(x.h.db.headEndBackupLinks[0].cloudPath,path);
 assert.equal(x.h.ppmLinkBackupPath(1,path,'999'),false);assert.equal(x.h.db.headEndBackupLinks[0].assetRef,'11');
});
test('CSV import stores separate module fields without interpreting identifiers',async()=>{
 const x=harness();x.h.importInputsV10();x.set('n10ImportSource','Generic');Object.defineProperty(x.document.getElementById('n10ImportFile'),'files',{value:[{name:'synthetic.csv',text:async()=> 'Input Name,Input Number,Module,Module Type,Module Number,Area\nDemo PIR,IN7,Legacy,Custom I/O,002,West'}]});
 await x.h.runInputsImportV10();assert.equal(x.h.db.assets[0].moduleType,'Custom I/O');assert.equal(x.h.db.assets[0].moduleNumber,'002');assert.equal(x.h.db.assets[0].module,'Legacy');assert.equal(x.h.db.assets[0].pointId,'IN7');
});
test('per-system labels appear in actual input forms and lists',()=>{
 const x=harness([{...inventory[10],platform:'Gallagher'}, {...inventory[3],headEndId:'11',area:'Secure',moduleType:'Custom',moduleNumber:'01'}]);
 x.h.ppmInputForm(4);assert.match(x.document.getElementById('modal').textContent,/Alarm Zone/);x.h.renderSiteDetailV7(1,'intrusion');x.flush();assert.match(x.document.querySelector('[data-v10-inputs]').textContent,/Alarm Zone/);assert.match(x.document.querySelector('[data-v10-inputs]').textContent,/Module number: 01/);
});
test('Contact ID reporting code preserves leading zeroes separately from terminal and module',async()=>{
 const x=harness([{...inventory[3],pointId:'IN7',moduleNumber:'02',reportingId:'legacy-99'}]);x.h.ppmInputForm(4);assert.equal(x.document.getElementById('ppmContactIdCode').value,'');x.set('ppmContactIdCode','001');x.h.ppmSaveInput(4);
 const saved=JSON.parse(x.map.get('ppmV3Data')).assets[0];assert.equal(saved.contactIdReportingCode,'001');assert.equal(saved.pointId,'IN7');assert.equal(saved.moduleNumber,'02');assert.equal(saved.reportingId,'legacy-99');
 const payload=Core.payloadFor(x.h.db,x.h.db.sites[0]);const restored=Core.replaceSite({sites:[],assets:[],photos:[]},1,payload);assert.equal(restored.assets[0].contactIdReportingCode,'001');
 const y=harness();y.h.importInputsV10();y.set('n10ImportSource','Generic');Object.defineProperty(y.document.getElementById('n10ImportFile'),'files',{value:[{name:'test.csv',text:async()=> 'Input Name,Input Number,Contact ID reporting code\nDemo PIR,IN7,001'}]});await y.h.runInputsImportV10();assert.equal(y.h.db.assets[0].contactIdReportingCode,'001');
});
test('unknown and prototype-named profiles fall back; unresolved system references survive edits',()=>{
 const x=harness([{...inventory[10],platform:'__proto__'}, {...inventory[3],headEndId:'missing-head'}]);
 assert.equal(x.h.ppmTerminology(x.h.db.assets[0]).area,'Intrusion Area');x.h.ppmInputForm(4);assert.match(x.document.getElementById('modal').textContent,/Unavailable system reference/);x.h.ppmSaveInput(4);assert.equal(x.h.db.assets[1].headEndId,'missing-head');
});
test('account change during file read discards callback without touching the new account cache',async()=>{
 const x=harness(inventory);let finish;x.h.FileReader=class{readAsDataURL(){finish=()=>{this.result='data:image/png;base64,YQ==';this.onload();};}};
 x.h.addDevicePhotoV7(1);Object.defineProperty(x.document.getElementById('n7PhotoFile'),'files',{value:[{type:'image/png',size:1}]});const saving=x.h.saveDevicePhotoV7(1);x.h.generation++;finish();await saving;assert.equal(x.h.db.photos.length,0);assert.equal(x.uploads.length,0);
});
test('account change during upload never acknowledges into the replacement cache',async()=>{
 const x=harness(inventory);x.h.db.photos=[{id:'pending',siteId:1,assetRef:'1',pendingUpload:true,data:'data:image/png;base64,YQ==',mimeType:'image/png',uploadPath:'sites/1/cctv/1/pending.png'}];x.h.navigator.onLine=true;x.h.onUpload=()=>{x.h.generation++;x.h.db.photos=[{id:'new-account'}];};await x.h.PPMAssetFeatures.uploadPending(1);assert.deepEqual(x.h.db.photos,[{id:'new-account'}]);
});
test('repeated upload after interrupted acknowledgement verifies same UUID object without overwrite',async()=>{
 const x=harness(inventory);x.h.db.photos=[{id:'pending',siteId:1,assetRef:'1',pendingUpload:true,data:'data:image/png;base64,YQ==',mimeType:'image/png',uploadPath:'sites/1/cctv/1/pending.png'}];x.h.navigator.onLine=true;x.h.uploadError={statusCode:409};x.h.listedFiles=[{name:'pending.png',metadata:{size:1}}];await x.h.PPMAssetFeatures.uploadPending(1);assert.equal(x.h.db.photos[0].pendingUpload,false);assert.equal(x.h.db.photos[0].cloudPath,'sites/1/cctv/1/pending.png');
});
test('queued upload refuses a mismatched site or asset path',async()=>{
 const x=harness(inventory);x.h.navigator.onLine=true;x.h.db.photos=[{id:'pending',siteId:1,assetRef:'1',pendingUpload:true,data:'data:image/png;base64,YQ==',uploadPath:'sites/2/cctv/1/p.png'}];await x.h.PPMAssetFeatures.uploadPending(1);assert.equal(x.uploads.length,0);assert.equal(x.h.db.photos[0].pendingUpload,true);
});
test('intrusion device saves its profile link and fields atomically under quota failure',()=>{
 const x=harness(inventory);x.h.intrusionDeviceFormV10(5);x.set('n10IntrusionInputNumber','IN8');x.set('ppmSystem','11');const before=JSON.stringify(x.h.db);x.h.quota=true;x.h.saveIntrusionDeviceV10(5);assert.equal(JSON.stringify(x.h.db),before);x.h.quota=false;x.h.saveIntrusionDeviceV10(5);assert.equal(x.h.db.assets[4].headEndId,'11');assert.equal(x.h.db.assets[4].inputNumber,'IN8');
});
test('actual Add form buttons create inputs and multiple distinct systems without sentinel confusion',()=>{
 const x=harness();x.h.ppmInputForm();x.set('ppmInputName','New input');x.set('ppmContactIdCode','001');x.clickInline('#modal button.primary');assert.equal(x.h.db.assets.length,1);assert.equal(x.h.db.assets[0].contactIdReportingCode,'001');
 for(let i=0;i<2;i++){x.h.ppmHeadForm();x.set('ppmHeadName','Same name');x.clickInline('#modal button.primary');}
 assert.equal(x.h.db.assets.length,3);assert.equal(new Set(x.h.db.assets.map(a=>a.id)).size,3);assert.equal(x.h.PPMAssetFeatures.heads().length,2);
});

test('photo confirmation cancels safely, escapes labels, and avoids native confirm',async()=>{
 const x=harness(inventory);x.h.confirm=()=>{throw Error('native confirm must not run');};x.h.db.photos=[{id:'p',siteId:1,assetRef:'1',label:'<img src=x onerror=bad()>',data:'data:image/png;base64,YQ=='}];
 x.h.openPhotoActionsV15('p');x.document.querySelector('[data-a=delete]').click();assert.ok(x.document.querySelector('[role=alertdialog][aria-modal=true]'));assert.equal(x.document.querySelector('#ppmDeleteDescription img'),null);assert.equal(x.h.db.photos.length,1);x.document.querySelector('[data-a=cancel]').click();assert.equal(x.document.querySelector('[role=alertdialog]'),null);assert.equal(x.h.db.photos.length,1);assert.equal(x.removes.length,0);
 x.h.openPhotoActionsV15('p');x.document.querySelector('[data-a=delete]').click();const e=new x.document.defaultView.Event('keydown',{bubbles:true});e.key='Escape';x.document.querySelector('[role=alertdialog]').dispatchEvent(e);assert.equal(x.h.db.photos.length,1);assert.equal(x.document.querySelector('[role=alertdialog]'),null);
});
for(const change of ['role','generation','upload','quota'])test('photo confirmed delete fails safely after '+change,async()=>{
 const x=harness(inventory);x.h.db.photos=[{id:'p',siteId:1,assetRef:'1',data:'data:image/png;base64,YQ=='}];x.h.save();const saved=x.map.get('ppmV3Data');x.h.openPhotoActionsV15('p');x.document.querySelector('[data-a=delete]').click();
 if(change==='role')x.h.role='viewer';if(change==='generation')x.h.generation++;if(change==='upload')x.h.ppmPhotosUploading=()=>true;if(change==='quota')x.h.quota=true;
 x.document.querySelector('[data-a=confirm-delete]').click();await new Promise(r=>setImmediate(r));assert.equal(x.h.db.photos.length,1);assert.equal(x.map.get('ppmV3Data'),saved);assert.equal(x.removes.length,0);assert.ok(x.document.getElementById('ppmDeleteError').textContent);
});
test('confirmed local delete updates gallery and persisted count without affecting other assets',async()=>{
 const x=harness(inventory);x.h.db.photos=[{id:'p',siteId:1,assetRef:'1',data:'data:image/png;base64,YQ=='},{id:'q',siteId:1,assetRef:'2',data:'data:image/png;base64,Yg=='}];x.h.renderSiteDetailV7(1,'info');x.flush();x.h.ppmAssetGallery(1);x.h.openPhotoActionsV15('p');x.document.querySelector('[data-a=delete]').click();x.document.querySelector('[data-a=confirm-delete]').click();await new Promise(r=>setImmediate(r));x.flush();assert.equal(x.h.db.photos.length,1);assert.equal(x.h.db.photos[0].id,'q');assert.match(x.document.getElementById('modal').textContent,/No photos yet/);assert.equal(JSON.parse(x.map.get('ppmV3Data')).photos.length,1);
});
test('repeated delete confirmation issues only one cloud removal and rechecks access after the await',async()=>{
 const x=harness(inventory);x.h.db.photos=[{id:'p',siteId:1,assetRef:'1',cloudPath:'sites/1/cctv/1/photo.jpg',data:'https://example.test/p'}];let finish,calls=0;x.h.ppmSupabase.storage.from=()=>({remove:()=>{calls++;return new Promise(r=>finish=r);},list:async()=>({data:[]})});x.h.openPhotoActionsV15('p');x.document.querySelector('[data-a=delete]').click();const button=x.document.querySelector('[data-a=confirm-delete]');button.click();button.click();assert.equal(calls,1);x.h.generation++;finish({error:null});await new Promise(r=>setImmediate(r));assert.equal(x.h.db.photos.length,1);assert.match(x.document.getElementById('ppmDeleteError').textContent,/access changed/);
});
