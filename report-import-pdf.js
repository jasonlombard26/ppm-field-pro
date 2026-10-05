/* Coordinate-aware, conservative Gallagher Wiring Report configuration mapping. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PPMWiringImport=api;})(globalThis,()=>{
'use strict';
const clean=s=>String(s??'').trim().replace(/\s+/g,' '),key=(...a)=>JSON.stringify(['Gallagher wiring',...a]);
const secret=s=>/(?:password|passwd|pwd|passcode|installer\s*(?:code|pin)|secret)\s*[:=]/i.test(s);
function join(items){return items.slice().sort((a,b)=>Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x).map(i=>clean(i.text)).filter(Boolean).join(' ');}
function value(items,label,x,minX){const a=items.find(i=>clean(i.text)===label&&i.x<x);if(!a)return '';return join(items.filter(i=>i.x>=minX&&Math.abs(i.y-a.y)<8));}
function parseWiring(pages,fileName){
 if(!pages.some(p=>p.items.some(i=>clean(i.text)==='Wiring Report')))return null;
 const candidates=[],warnings=[],entities=[];let current;
 for(const page of pages){const items=page.items.filter(i=>clean(i.text)&&i.y>65).map(i=>({...i,text:clean(i.text)}));
  if(items.some(i=>i.text==='Site Name'&&i.x<220)){
   const anchors=items.filter(i=>i.x>140&&i.x<220&&['Site Name','Type','Name','Description'].includes(i.text)).sort((a,b)=>b.y-a.y),meta={};
   anchors.forEach((a,n)=>{const top=n?(anchors[n-1].y+a.y)/2:a.y+10,bottom=n+1<anchors.length?(anchors[n+1].y+a.y)/2:a.y-10;meta[a.text]=join(items.filter(i=>i.x>280&&i.y<top&&i.y>bottom));});
   const type=meta.Type||'',kind=/^Controller\b/i.test(type)?'controller':/^HBUS I\/O$/i.test(type)?'module':type==='Door'?'door':type==='Elevator Car'?'lift':null;
   current={meta,kind,pages:[],startPage:page.page};entities.push(current);
  }
  if(current)current.pages.push({page:page.page,items});else warnings.push(`Page ${page.page}: no preceding entity context; excluded.`);
 }
 for(const entity of entities){const {meta,kind}=entity,first=entity.pages[0].items;
  if(!kind||!meta.Name||!meta['Site Name']){warnings.push(`Page ${entity.startPage}: unsupported or incomplete entity header; excluded.`);continue;}
  const controller=kind==='controller'?meta.Name:value(first,'Controller',220,230);
  if(!controller){warnings.push(`Page ${entity.startPage}: missing controller context; excluded.`);continue;}
  const sourceKey=key(meta['Site Name'],controller,kind,meta.Name),controllerKey=key(meta['Site Name'],controller,'controller',controller);
  const fields={name:meta.Name,system:'Access Control',subtype:{controller:'Controller',module:'Module',door:'Door',lift:'Lift'}[kind],sourceSite:meta['Site Name'],sourceController:controller,sourceControllerKey:controllerKey,sourceEntityType:meta.Type};
  if(kind==='controller')Object.assign(fields,{headEnd:true,platform:'Gallagher',appliesTo:[],controllerType:meta.Type,macAddress:value(first,'MAC Address',220,230),ip:value(first,'IP Address',220,230),pluginModule:value(first,'Plug-in Module',220,230)});
  if(kind==='module')Object.assign(fields,{moduleType:value(first,'Hardware Variant',220,230)||meta.Type,serialNumber:value(first,'Serial Number',220,230)});
  if(kind==='door')Object.assign(fields,{configuredLockType:value(first,'Lock Type',220,230),entryZone:value(first,'Entry Zone',220,230)});
  const provenance={fileName,page:entity.startPage,section:kind,sourceType:'PDF wiring configuration'};
  const candidate={kind,sourceKey,fields,provenance};entity.candidate=candidate;
  const schemas=new Map();let activeBus='';
  for(const page of entity.pages){const items=page.items;
   // Controller discovery lists prove a bus/name association, not an address or hardware subtype.
   if(kind==='controller')for(const i of items.slice().sort((a,b)=>b.y-a.y)){
    const bus=i.text.match(/^The following HBUS Devices have been detected on (.+)$/);if(bus){activeBus=bus[1];continue;}
    if(['Inputs','Outputs','Readers'].includes(i.text))activeBus='';
    if(activeBus&&Math.abs(i.x-108)<3){fields.detectedDevices=fields.detectedDevices||[];fields.detectedDevices.push({name:i.text,bus:activeBus,page:page.page});}
   }
   const sections=items.filter(i=>i.x>230&&['Inputs','Outputs','Readers','Devices'].includes(i.text)).sort((a,b)=>b.y-a.y);
   for(let n=0;n<sections.length;n++){
    const section=sections[n].text,top=sections[n].y,bottom=sections[n+1]?.y||65;
    let region=items.filter(i=>i.y<top-2&&i.y>bottom+2);
    // Lift floors are a separate four-column table beneath its reader list.
    const floorHeader=region.find(i=>i.text==='Floor'&&i.x<100&&region.some(j=>j.text==='Access Zone'&&Math.abs(j.y-i.y)<2));
    if(floorHeader){const heads=region.filter(i=>Math.abs(i.y-floorHeader.y)<2&&['Floor','Access Zone','Output','Input'].includes(i.text)).sort((a,b)=>a.x-b.x);if(heads.length!==4)warnings.push(`Page ${page.page}: incomplete lift floor columns.`);else fields.floors=table(region.filter(i=>i.y<floorHeader.y-3),heads,page.page,'Floors',warnings).map(r=>({floor:r.Floor,accessZone:r['Access Zone'],outputName:r.Output,inputName:r.Input,page:page.page}));region=region.filter(i=>i.y>floorHeader.y+2);}
    const isConnection=(kind==='door'&&section==='Devices')||(kind==='lift'&&['Inputs','Outputs'].includes(section));
    if(isConnection){const expected=[kind==='lift'?'Floor':'Function','Connected To','Device Address','PCB Label'];const header=region.find(i=>i.text===expected[0]&&i.x<120);if(!header){warnings.push(`Page ${page.page} ${section}: missing connection columns; no relationships guessed.`);continue;}const heads=region.filter(i=>Math.abs(i.y-header.y)<2&&expected.includes(i.text)).sort((a,b)=>a.x-b.x);if(heads.length!==4){warnings.push(`Page ${page.page} ${section}: missing connection columns; no relationships guessed.`);continue;}
     const rows=table(region.filter(i=>i.y<header.y-3),heads,page.page,section,warnings);fields.wiringConnections=fields.wiringConnections||[];
     for(const row of rows){const address=row['Device Address'].replace(/\s+/g,'');if(!row['Connected To']||!address||!row['PCB Label']){warnings.push(`Page ${page.page} ${section}: incomplete connection row retained for review.`);}fields.wiringConnections.push({function:row.Function||section,floor:row.Floor||'',connectedTo:row['Connected To'],deviceAddress:address,pcbLabel:row['PCB Label'],page:page.page,unresolvedEndpoint:true});}continue;
    }
    if(kind==='lift'&&section==='Readers'){fields.readerAssociations=region.filter(i=>i.x<110&&/^\d+$/.test(i.text)).map(i=>({number:i.text,name:join(region.filter(j=>j.x>230&&Math.abs(j.y-i.y)<8)),page:page.page}));continue;}
    if(!['controller','module'].includes(kind)||!['Inputs','Outputs','Readers'].includes(section))continue;
    const header=region.find(i=>i.text==='PCB Label'&&i.x<220);let heads;
    if(header){heads=region.filter(i=>Math.abs(i.y-header.y)<2&&['PCB Label','Name'].includes(i.text)).sort((a,b)=>a.x-b.x);if(heads.length!==2){schemas.delete(section);warnings.push(`Page ${page.page} ${section}: missing PCB Label/Name columns.`);continue;}schemas.set(section,heads);region=region.filter(i=>i.y<header.y-3);}
    else{heads=schemas.get(section);if(!heads){warnings.push(`Page ${page.page} ${section}: continuation has no verified column context.`);continue;}}
    for(const row of table(region,heads,page.page,section,warnings)){
     const pcb=row['PCB Label'],name=row.Name,pointKind={Inputs:'input',Outputs:'output',Readers:'reader'}[section];if(!pcb||!name){warnings.push(`Page ${page.page} ${section}: incomplete row excluded.`);continue;}
     const pointFields={name,system:'Access Control',subtype:{input:'Input',output:'Output',reader:'Reader'}[pointKind],sourceSite:fields.sourceSite,sourceController:controller,sourceControllerKey:controllerKey,sourceParentKey:sourceKey,sourceModuleName:kind==='module'?fields.name:'',pcbLabel:pcb};
     const terminal=pcb.match(/^(?:IN(?:PUT)?|OUT(?:PUT)?)?\s*(\d+)$/i);if(terminal){pointFields.terminalNumber=terminal[1];if(pointKind==='input')pointFields.inputNumber=terminal[1];}
     candidates.push({kind:pointKind,sourceKey:key(fields.sourceSite,controller,pointKind,sourceKey,pcb.toUpperCase().replace(/\s+/g,'')),fields:pointFields,provenance:{fileName,page:page.page,section,row:row._row,sourceType:'PDF wiring configuration'}});
    }
   }
  }
  candidates.push(candidate);
 }
 // Only exact named discovery associations within a controller's scope attach a bus to a module.
 for(const c of candidates.filter(c=>c.kind==='module')){const heads=candidates.filter(h=>h.kind==='controller'&&h.sourceKey===c.fields.sourceControllerKey);const buses=heads.flatMap(h=>(h.fields.detectedDevices||[]).filter(d=>d.name===c.fields.name).map(d=>d.bus));if(buses.length===1)c.fields.bus=buses[0];else warnings.push(`Page ${c.provenance.page}: module bus association unresolved.`);}
 for(const c of candidates){if(secret(JSON.stringify(c.fields))){c.blockedReason='Possible credential text in mapped fields; excluded from import.';c.fields={name:'Excluded source row',system:'Access Control',subtype:c.kind};}if(Object.values(c.fields).some(v=>typeof v==='string'&&v.length>2000))throw Error('A PDF field exceeds the text limit.');if(c.fields.wiringConnections)for(const r of c.fields.wiringConnections){const matches=candidates.filter(x=>x.kind==='controller'&&/^[a-f0-9]{12}$/i.test(x.fields.macAddress?.replace(/[^a-f0-9]/gi,'')||'')&&x.fields.sourceSite===c.fields.sourceSite&&x.fields.name.replace(/\s/g,'').toLowerCase()===r.connectedTo.replace(/\s/g,'').toLowerCase()&&x.fields.macAddress?.replace(/[^a-f0-9]/gi,'').toLowerCase()===r.deviceAddress.replace(/[^a-f0-9]/gi,'').toLowerCase());if(matches.length===1){r.endpointSourceKey=matches[0].sourceKey;r.unresolvedEndpoint=false;}}}
 const unresolved=candidates.flatMap(c=>c.fields.wiringConnections||[]).filter(r=>r.unresolvedEndpoint).length;if(unresolved)warnings.push(`${unresolved} wiring endpoints retain explicit device addresses but cannot be matched safely to a physical asset.`);
 if(candidates.length>2000)throw Error('Maximum candidate count is 2,000.');
 if(!candidates.length)return null;
 return {format:'Gallagher wiring configuration',candidates,warnings};
}
function table(items,heads,page,section,warnings){
 const left=heads[0].x,anchors=items.filter(i=>Math.abs(i.x-left)<3&&!/^\*|^Generated\b|^Page\b/.test(i.text)).sort((a,b)=>b.y-a.y),rows=[];
 for(let n=0;n<anchors.length;n++){const a=anchors[n],top=n?(anchors[n-1].y+a.y)/2:a.y+10,bottom=n+1<anchors.length?(anchors[n+1].y+a.y)/2:a.y-10,row={_row:n+1};heads.forEach((h,k)=>row[h.text]=join(items.filter(i=>i.y<top&&i.y>bottom&&i.x>=h.x-2&&i.x<(heads[k+1]?.x-2||10000))));if(Object.values(row).some(v=>typeof v==='string'&&v.length>2000))throw Error('A PDF table cell exceeds the text limit.');rows.push(row);}
 return rows;
}
return {parseWiring};
});
