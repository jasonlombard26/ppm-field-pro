/* Pure, dependency-free reconciliation rules. No network or browser storage access. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PPMSyncCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const stable=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)
    ?Object.keys(item).sort().reduce((result,key)=>(result[key]=item[key],result),{}):item);
  // An omitted empty site collection and an explicit [] carry the same state.
  const comparable=value=>value?.site?Object.fromEntries(Object.entries(value).filter(([key,item])=>key==='site'||!Array.isArray(item)||item.length)):value;
  const equal=(a,b)=>stable(comparable(a))===stable(comparable(b));
  const validId=id=>Number.isSafeInteger(Number(id))&&Number(id)>0;
  const revision=value=>(typeof value==='number'&&!Number.isSafeInteger(value))?null:(/^[1-9][0-9]*$/.test(String(value))?String(value):null);
  function payloadFor(state,site){
    const result={site:copy(site)};
    for(const [key,value] of Object.entries(state)){
      if(key==='sites'||key==='photos'||!Array.isArray(value))continue;
      const scoped=value.filter(item=>Number(item?.siteId)===Number(site.id));
      if(scoped.length||value.some(item=>item&&Object.hasOwn(item,'siteId')))result[key]=copy(scoped);
    }
    return result;
  }
  function payloads(state){
    return Object.fromEntries((state.sites||[]).filter(site=>validId(site.id)).map(site=>[String(site.id),payloadFor(state,site)]));
  }
  function replaceSite(state,id,payload){
    const result=copy(state),number=Number(id);
    for(const [key,value] of Object.entries(result)){
      if(!Array.isArray(value)||key==='photos')continue;
      result[key]=key==='sites'?value.filter(site=>Number(site.id)!==number):value.filter(item=>Number(item?.siteId)!==number);
    }
    result.sites=result.sites||[];
    result.sites.push({...copy(payload.site),id:number});
    for(const [key,value] of Object.entries(payload)){
      if(key==='site'||key==='photos'||key==='sites'||!Array.isArray(value))continue;
      result[key]=(result[key]||[]).concat(value.map(item=>({...copy(item),siteId:number})));
    }
    return result;
  }
  function removeSite(state,id){
    const next=copy(state),number=Number(id);
    for(const [key,value] of Object.entries(next)){
      if(Array.isArray(value))next[key]=value.filter(item=>Number(key==='sites'?item.id:item?.siteId)!==number);
    }
    return next;
  }
  class Journal{
    constructor(metadata={}){
      if(metadata.version!==undefined&&metadata.version!==1)throw new Error('Unsupported local sync journal');
      this.meta={version:1,ownerId:metadata.ownerId||null,sites:copy(metadata.sites||{})};
    }
    dirty(state,id){
      const current=payloads(state)[id],entry=this.meta.sites[id];
      return !entry||!equal(current,entry.base);
    }
    observeNew(state){
      for(const id of Object.keys(payloads(state))){
        if(!this.meta.sites[id])this.meta.sites[id]={base:null,revision:null,role:'admin',createdHere:true};
      }
    }
    reconcile(state,rows,memberships){
      let next=copy(state);
      const local=payloads(state),seen=new Set(),roles=Object.fromEntries(memberships.map(item=>[String(item.site_id),item.role]));
      // Previously revoked data is kept in recovery metadata, outside the active app.
      for(const [id,entry] of Object.entries(this.meta.sites)){
        if(entry.recovery&&!local[id])local[id]=entry.recovery.state;
      }
      // Validate the complete read before changing any journal entry.
      for(const row of rows){
        if(!validId(row.id)||!revision(row.revision)||!row.site_state?.site||Number(row.site_state.site.id)!==Number(row.id))throw new Error('Cloud schema or site payload needs review');
      }
      for(const row of rows){
        const id=String(row.id),remote=copy(row.site_state),rev=revision(row.revision);
        seen.add(id);
        const previous=this.meta.sites[id],entry=previous||{base:null,revision:null};
        entry.role=roles[id]||'viewer';
        entry.remote={state:remote,revision:rev};
        let adopted=false;
        if((!previous&&!local[id])||equal(local[id],remote)||(previous&&equal(local[id],previous.base))){
          next=replaceSite(next,id,remote);adopted=true;
          Object.assign(entry,{base:remote,revision:rev,problem:null,createdHere:false});
        }else if(!local[id]){
          entry.problem='local-deletion';
        }else if(!['admin','technician'].includes(entry.role)){
          entry.problem='read-only';
        }else if(!previous?.revision||String(previous.revision)!==rev){
          entry.problem='conflict';
        }else{
          entry.problem=null;
        }
        if(entry.recovery){
          // A clean recovered cache must not overwrite a newer remote version.
          if(!adopted&&local[id])next=replaceSite(next,id,local[id]);
          if(entry.recovery.photos?.length)next.photos=(next.photos||[]).concat(copy(entry.recovery.photos));
          delete entry.recovery;
        }
        this.meta.sites[id]=entry;
      }
      for(const id of new Set([...Object.keys(local),...Object.keys(this.meta.sites)])){
        if(seen.has(id))continue;
        const entry=this.meta.sites[id]||{base:null,revision:null};
        entry.remote=null;
        if(entry.revision){
          if(local[id]&&!entry.recovery)entry.recovery={state:copy(local[id]),photos:copy((state.photos||[]).filter(photo=>Number(photo.siteId)===Number(id)))};
          entry.problem='unavailable';entry.role=null;next=removeSite(next,id);
        }
        else if(!entry.createdHere)entry.problem='unconfirmed';
        else if(['network','upgrade','permission'].includes(entry.problem))entry.problem=null;
        this.meta.sites[id]=entry;
      }
      return next;
    }
    pending(state){
      const local=payloads(state);
      return Object.entries(this.meta.sites).filter(([id,entry])=>local[id]&&this.dirty(state,id)&&!entry.problem&&['admin','technician'].includes(entry.role))
        .map(([id,entry])=>({id,payload:copy(local[id]),expectedRevision:entry.revision}));
    }
    acknowledge(id,sent,newRevision){
      const rev=revision(newRevision);
      if(!rev)throw new Error('Cloud save did not return a revision');
      Object.assign(this.meta.sites[id],{base:copy(sent),revision:rev,remote:{state:copy(sent),revision:rev},createdHere:false,problem:null});
    }
    fail(id,problem){this.meta.sites[id].problem=problem;}
    approveCreation(id){
      const entry=this.meta.sites[id];
      if(!entry||entry.revision||entry.problem!=='unconfirmed')throw new Error('This site cannot be created from local data');
      Object.assign(entry,{createdHere:true,role:'admin',problem:null});
    }
    chooseLocal(id){
      const entry=this.meta.sites[id];
      if(!entry?.remote||entry.problem!=='conflict'||!['admin','technician'].includes(entry.role))throw new Error('Local replacement is not allowed');
      Object.assign(entry,{base:copy(entry.remote.state),revision:entry.remote.revision,problem:null});
    }
    chooseCloud(state,id){
      const entry=this.meta.sites[id];
      if(!entry?.remote)throw new Error('No authorised cloud copy is available');
      const next=replaceSite(state,id,entry.remote.state);
      Object.assign(entry,{base:copy(entry.remote.state),revision:entry.remote.revision,createdHere:false,problem:null});
      return next;
    }
    issues(state){
      return Object.entries(this.meta.sites).filter(([id,entry])=>entry.problem||this.dirty(state,id))
        .map(([id,entry])=>({id,problem:entry.problem||'pending'}));
    }
  }
  const keys={state:'ppmV3Data',meta:'ppmSyncJournalV1',transaction:'ppmSyncTransitionV1'};
  function writeCache(storage,state,meta,write=(key,value)=>storage.setItem(key,value)){
    // localStorage is atomic per key, not across keys. A redo record protects
    // both cloud pulls and recovery-only moves if any subsequent write fails.
    const transaction=JSON.stringify({state,meta});
    write(keys.transaction,transaction);
    write(keys.state,JSON.stringify(state));
    write(keys.meta,JSON.stringify(meta));
    storage.removeItem(keys.transaction);
  }
  function recoverStorage(storage,write=(key,value)=>storage.setItem(key,value)){
    const raw=storage.getItem(keys.transaction);
    if(!raw)return false;
    const transaction=JSON.parse(raw);
    if(!transaction.state||!Array.isArray(transaction.state.sites)||transaction.meta?.version!==1)throw new Error('Invalid local recovery transaction');
    // Do not rewrite the redo record: retain it until both final writes succeed.
    write(keys.state,JSON.stringify(transaction.state));
    write(keys.meta,JSON.stringify(transaction.meta));
    storage.removeItem(keys.transaction);
    return true;
  }
  return {Journal,payloadFor,payloads,replaceSite,removeSite,equal,revision,writeCache,recoverStorage,keys};
});
