/* Pure conservative configuration mappings. Never executes source expressions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PPMReportImport=api;})(typeof globalThis==='undefined'?this:globalThis,()=>{
'use strict';
const LIMITS={fileBytes:15*1024*1024,sheets:20,rows:10000,records:2000,columns:80,cellChars:2000,pages:100,textChars:1000000};
const text=x=>String(x??'').trim(),norm=x=>text(x).toLowerCase().replace(/[^a-z0-9]/g,'');
const forbidden=/password|passwd|passcode|installer.?code|secret|credential|private.?key|access.?token/i;
function safeText(x){const s=text(x);if(s.length>LIMITS.cellChars)throw Error('A source cell exceeds the text limit.');return s;}
function checkedRows(rows){if(rows.length>LIMITS.rows)throw Error('Report exceeds row limit.');return rows.map(r=>{if(r.length>LIMITS.columns)throw Error('Report exceeds column limit.');return r.map(safeText);});}
function header(rows,required){
 for(let i=0;i<Math.min(rows.length,100);i++){const h=rows[i].map(norm);if(required.every(k=>h.includes(k))){const nonempty=h.filter(Boolean);if(new Set(nonempty).size!==nonempty.length)throw Error('Ambiguous duplicate column headers.');return {index:i,h};}}
 throw Error('Expected report headers were not found. No records were imported.');
}
function rowObject(h,r){return Object.fromEntries(h.map((k,i)=>[k,r[i]||'']).filter(([k])=>k&&!forbidden.test(k)));}
const comparable=x=>JSON.stringify(x,(k,v)=>['endpointAssetId','page'].includes(k)?undefined:v);
const meaningfulIdentity=s=>text(s)&&!/^(?:n\/?a|none|nil|unknown|not\s+applicable|tbd|-+)$/i.test(text(s));
const meaningfulSerial=s=>meaningfulIdentity(s)&&!/^0+$/.test(text(s));
const sourceFields=new Set(['type','site','name','controllertype','serialnumber','state','lastmodified','lastmodifiedby','entitytype','controller','id','manufacturer','doortype','insidearea','outsidearea','status','firmwareversion','extendedstatus','description','assetdescription','equipmentdescripton','equipmentdescription','physicallocation','location','reportingid','reportingnumber','inputzone','pointzone','assettype','make','model','ip','ipaddress','mac','macaddress','serial','contactidreportingcode','moduletype','modulenumber']);
function snapshot(o){return Object.fromEntries(Object.entries(o).filter(([k,v])=>v&&sourceFields.has(k)));}
const credentialValue=o=>Object.entries(o).some(([k,v])=>sourceFields.has(k)&&/(?:password|passwd|pwd|passcode|installer\s*(?:code|pin)|secret)\s*[:=]/i.test(v));
function candidate(kind,sourceKey,fields,provenance,extra={}){return {kind,sourceKey,fields,provenance,...extra};}
function parseIntegriti(sheets,fileName){
 const candidates=[],warnings=['Free-text notes and credential columns are excluded from saved import data.'];
 for(const sheet of sheets){const rows=checkedRows(sheet.rows),title=rows.slice(0,15).flat().join(' ');let kind;
  if(/LAN\s*Module\s*Listing/i.test(title))kind='module';else if(/Controller\s*Listing/i.test(title))kind='controller';else if(/Door\s*Listing/i.test(title))kind='door';else continue;
  const {index,h}=header(rows,kind==='controller'?['site','name','controllertype']:['controller','site','id','name']);
  for(let i=index+1;i<rows.length;i++){
   const r=rows[i];if(!r.some(Boolean)||r.map(norm).join('|')===h.join('|'))continue;
   const o=rowObject(h,r),name=o.name;if(!name||/^(page\s+\d|printed|report\s+generated|total\b)/i.test(name))continue;
   if(credentialValue(o)){warnings.push(`Skipped ${sheet.name} row ${i+1}: possible credential content.`);continue;}
   if(!o.site){warnings.push(`Skipped ${sheet.name} row ${i+1}: missing source site.`);continue;}
   const controller=kind==='controller'?name:o.controller,id=o.id||'';
   if(!controller||kind!=='controller'&&!id){warnings.push(`Skipped ${sheet.name} row ${i+1}: missing scoped identity.`);continue;}
   const sourceKey=JSON.stringify(['Integriti',o.site,controller,kind,id||name]);
   const fields={name,system:'Access Control',subtype:kind==='controller'?'Controller':kind==='door'?'Door':o.type||'Module',sourceSite:o.site,sourceController:controller,sourceEntityId:id,sourceEntityType:o.entitytype||o.type||'',serialNumber:meaningfulSerial(o.serialnumber)?o.serialnumber:'',firmwareVersion:o.firmwareversion||'',controllerType:o.controllertype||'',configurationStatus:o.state||o.status||'',configurationExtendedStatus:o.extendedstatus||'',configurationModifiedAt:o.lastmodified||'',configurationModifiedBy:o.lastmodifiedby||''};
   if(kind==='door')Object.assign(fields,{doorNumber:id,softwareClass:o.manufacturer||'',configuredDoorType:o.doortype||'',insideArea:o.insidearea||'',outsideArea:o.outsidearea||''});
   if(kind==='controller')Object.assign(fields,{headEnd:true,platform:'Integriti',appliesTo:[]});
   const numeric=id.match(/^[CTER](\d+)$/i);if(numeric)fields.sourceEntityNumber=numeric[1];
   candidates.push(candidate(kind,sourceKey,fields,{fileName,sheet:sheet.name,row:i+1,sourceSnapshot:snapshot(o)}, {isControlModule:kind==='module'&&/control\s*module/i.test(o.type||'')}));
  }
 }
 if(!candidates.length)throw Error('No supported Integriti controller, door or LAN-module rows found.');
 return {format:'Integriti configuration listing',candidates,warnings};
}
const assetAliases={equipmentdescripton:'name',equipmentdescription:'name',physicallocation:'location',description:'name',assetdescription:'name',name:'name',location:'location',reportingid:'reportingId',reportingnumber:'reportingId',inputzone:'reportingId',pointzone:'sourcePointZone',type:'subtype',assettype:'subtype',make:'make',manufacturer:'make',model:'model',ip:'ip',ipaddress:'ip',mac:'macAddress',macaddress:'macAddress',serial:'serialNumber',serialnumber:'serialNumber',contactidreportingcode:'contactIdReportingCode',moduletype:'moduleType',modulenumber:'moduleNumber'};
function parseMaintenance(sheets,fileName){
 const candidates=[],warnings=[];
 for(const sheet of sheets){if(!/^assetlist$/i.test(norm(sheet.name))){warnings.push(`Excluded sheet ${sheet.name}: assessment, summary, evidence and other sheets are not configuration imports.`);continue;}
  const rows=checkedRows(sheet.rows);let found;
  for(let i=0;i<Math.min(100,rows.length);i++){const h=rows[i].map(norm),mapped=h.map(k=>Object.hasOwn(assetAliases,k)?assetAliases[k]:null).filter(Boolean);if(mapped.includes('name')&&mapped.includes('subtype')&&mapped.length>=3){if(new Set(mapped).size!==mapped.length)throw Error('Ambiguous asset-list columns require manual mapping.');found={index:i,h};break;}}
  if(!found)throw Error('Asset list headers are not recognized safely.');
  for(let i=found.index+1;i<rows.length;i++){const o=rowObject(found.h,rows[i]),fields={system:'EACS & IDS'};if(credentialValue(o)){warnings.push(`Skipped ${sheet.name} row ${i+1}: possible credential content.`);continue;}for(const [key,v] of Object.entries(o))if(Object.hasOwn(assetAliases,key)&&v)fields[assetAliases[key]]=v;
   if(!fields.name||!fields.subtype){if(rows[i].some(Boolean)){const evidence=Object.entries(fields).filter(([k,v])=>!['system','location','subtype'].includes(k)&&meaningfulIdentity(v));const reason=!fields.name&&!evidence.length?(fields.subtype?'apparent category heading (type/location only; no equipment description)':'location-only template/separator row (no equipment description or identity)'):'incomplete potential asset: missing equipment description or asset type; manual review required';warnings.push(`Skipped ${sheet.name} row ${i+1}: ${reason}.`);}continue;}
   if(norm(fields.name)==='description'||/^(total|page\s+\d)/i.test(fields.name))continue;
   // Reporting identifiers are never treated as physical terminal/input addresses.
   const identity=(meaningfulIdentity(fields.reportingId)?fields.reportingId:'')||(meaningfulIdentity(fields.sourcePointZone)?fields.sourcePointZone:'')||(meaningfulSerial(fields.serialNumber)?fields.serialNumber:'');
   if(!identity){const reason='Potential asset has no usable reporting/location/serial identity; manual reconciliation required.';warnings.push(`Blocked ${sheet.name} row ${i+1}: ${reason}`);candidates.push(candidate('asset',JSON.stringify(['Unresolved asset row',fileName,sheet.name,i+1]),fields,{fileName,sheet:sheet.name,row:i+1},{blockedReason:reason}));continue;}
   candidates.push(candidate('asset',JSON.stringify(['PPM asset register',fields.subtype,identity]),fields,{fileName,sheet:sheet.name,row:i+1,sourceSnapshot:snapshot(o)}));
  }
 }
 if(!candidates.length)throw Error('No supported asset-register rows found. Other maintenance tabs require a separate mapping.');
 return {format:'PPM asset register only',candidates,warnings};
}
function parseSheets(sheets,fileName){
 if(!Array.isArray(sheets)||sheets.length>LIMITS.sheets)throw Error('Too many worksheets.');
 const title=sheets.flatMap(s=>s.rows.slice(0,15).flat()).join(' ');
 const parsed=/(?:LAN\s*Module|Controller|Door)\s*Listing/i.test(title)?parseIntegriti(sheets,fileName):parseMaintenance(sheets,fileName);
 if(parsed.candidates.length>LIMITS.records)throw Error('Maximum candidate count is 2,000. Split the report.');return parsed;
}
function buildPlan(parsed,state,siteId,headEndId=''){
 const assets=(state.assets||[]).filter(a=>Number(a.siteId)===Number(siteId)),counts=new Map(),items=[];
 for(const c of parsed.candidates)counts.set(c.sourceKey,(counts.get(c.sourceKey)||0)+1);
 for(const c of parsed.candidates){
  const item={...c,action:'add',reason:'New configuration record'};
  const matches=assets.filter(a=>a.reportImport?.sourceKey===c.sourceKey);
  if(matches.length){item.action='skip';item.reason='Previously imported identity retained; source differences are not automatically applied.';item.existingId=matches[0].id;item.differences=Object.keys(c.fields).filter(k=>comparable(c.fields[k])!==comparable(matches[0][k]));}
  const serial=c.fields.serialNumber;
  if(c.isControlModule&&meaningfulSerial(serial)){
   const inSource=parsed.candidates.filter(x=>x.kind==='controller'&&x.fields.sourceSite===c.fields.sourceSite&&x.fields.name===c.fields.sourceController&&x.fields.serialNumber===serial);
   const existing=assets.filter(a=>a.headEnd&&a.serialNumber===serial&&(a.sourceSite||c.fields.sourceSite)===c.fields.sourceSite&&a.name===c.fields.sourceController);
   if(inSource.length===1||existing.length===1){item.action='link';item.reason='Control-module serial and controller context identify an existing physical controller.';item.controllerSourceKey=inSource[0]?.sourceKey;item.existingId=existing[0]?.id;}
   else {item.action='blocked';item.reason='Import/reconcile the controller listing first; this control-module row must not create a second physical controller.';}
  }
  if(c.isControlModule&&!meaningfulSerial(serial)){item.action='blocked';item.reason='Control-module serial is absent or zero; physical-controller identity requires review.';}
  // Matching a manual record is a conflict, not permission to overwrite or auto-merge it.
  if(item.action==='add'&&assets.some(a=>!a.reportImport&&(a.name===c.fields.name||meaningfulSerial(serial)&&a.serialNumber===serial))){item.action='blocked';item.reason='Potential manual record match: explicit reconciliation needed; existing data is unchanged.';}
  if(counts.get(c.sourceKey)>1){item.action='blocked';item.reason='Duplicate scoped identity in this source; all matching source rows are blocked pending reconciliation.';}
  if(parsed.format==='Gallagher wiring configuration'&&item.differences?.length){item.action='blocked';item.reason='Conflicting wiring snapshot or local edits: review changed fields; existing record retained.';}
  if(c.blockedReason){item.action='blocked';item.reason=c.blockedReason;}
  items.push(item);
 }
 return {siteId:Number(siteId),headEndId:String(headEndId),format:parsed.format,warnings:parsed.warnings,items};
}
function applyPlan(state,plan,selected,now){
 const next=JSON.parse(JSON.stringify(state)),ids=new Set((next.assets||[]).map(a=>String(a.id))),created=new Map();next.assets=next.assets||[];let id=Date.now();
 for(const item of plan.items){if(item.action!=='add'||!selected.includes(item.sourceKey))continue;
  if(next.assets.some(a=>Number(a.siteId)===plan.siteId&&a.reportImport?.sourceKey===item.sourceKey))continue;
  while(ids.has(String(id)))id++;const target={...JSON.parse(JSON.stringify(item.fields)),id:id++,siteId:plan.siteId,headEndId:plan.headEndId,reportImport:{sourceKey:item.sourceKey,headEndScope:plan.headEndId,format:plan.format,importedAt:now,provenance:item.provenance}};ids.add(String(target.id));next.assets.push(target);created.set(item.sourceKey,target);
 }
 for(const target of created.values()){
  if(target.headEnd){target.headEndId='';continue;}
  if(target.sourceController){const controllers=next.assets.filter(a=>Number(a.siteId)===plan.siteId&&a.headEnd&&(target.sourceControllerKey?a.reportImport?.sourceKey===target.sourceControllerKey:a.sourceSite===target.sourceSite&&a.name===target.sourceController));if(controllers.length===1)target.headEndId=String(controllers[0].id);else target.reportImport.unresolvedController=true;}
  if(target.sourceParentKey){const parents=next.assets.filter(a=>Number(a.siteId)===plan.siteId&&a.reportImport?.sourceKey===target.sourceParentKey);if(parents.length===1)target.parentAssetId=String(parents[0].id);else target.reportImport.unresolvedParent=true;}
  for(const relation of target.wiringConnections||[]){if(!relation.endpointSourceKey)continue;const endpoints=next.assets.filter(a=>Number(a.siteId)===plan.siteId&&a.reportImport?.sourceKey===relation.endpointSourceKey);if(endpoints.length===1)relation.endpointAssetId=String(endpoints[0].id);else relation.unresolvedEndpoint=true;}
 }
 // Retain module evidence on imported controllers, without changing manual controller records.
 for(const item of plan.items.filter(x=>x.action==='link')){const target=created.get(item.controllerSourceKey);if(target){target.reportImport.relatedSources=target.reportImport.relatedSources||[];target.reportImport.relatedSources.push(item.provenance);}}
 return next;
}
return {LIMITS,parseSheets,parseIntegriti,parseMaintenance,buildPlan,applyPlan};
});
