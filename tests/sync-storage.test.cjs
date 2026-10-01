const test=require('node:test');
const assert=require('node:assert/strict');
const {writeCache,recoverStorage,keys}=require('../sync-core.js');
function store(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
const oldState={sites:[{id:1,name:'old'}],photos:[{id:'photo'}]},oldMeta={version:1,sites:{1:{revision:'1',base:{site:{id:1,name:'old'}}}}};
const newState={sites:[{id:1,name:'new'}],photos:[]},newMeta={version:1,sites:{1:{revision:'2',base:{site:{id:1,name:'new'}}}}};
for(const step of [1,2,3])test(`cache transition survives quota/crash at write ${step}`,()=>{
  const storage=store();storage.setItem(keys.state,JSON.stringify(oldState));storage.setItem(keys.meta,JSON.stringify(oldMeta));let writes=0;
  assert.throws(()=>writeCache(storage,newState,newMeta,(key,value)=>{if(++writes===step)throw new Error('quota');storage.setItem(key,value);}));
  recoverStorage(storage);
  const expected=step===1?[oldState,oldMeta]:[newState,newMeta];
  assert.deepEqual(JSON.parse(storage.getItem(keys.state)),expected[0]);assert.deepEqual(JSON.parse(storage.getItem(keys.meta)),expected[1]);assert.equal(storage.getItem(keys.transaction),null);
});
test('revoked unsynced data is recoverable after active-state removal and metadata quota failure',()=>{
  const storage=store(),meta={version:1,sites:{1:{problem:'unavailable',recovery:{state:oldState,photos:oldState.photos}}}};
  storage.setItem(keys.state,JSON.stringify(oldState));storage.setItem(keys.meta,JSON.stringify(oldMeta));
  assert.throws(()=>writeCache(storage,{sites:[],photos:[]},meta,(key,value)=>{if(key===keys.meta)throw new Error('quota');storage.setItem(key,value);}));
  assert.equal(JSON.parse(storage.getItem(keys.transaction)).meta.sites[1].recovery.state.sites[0].name,'old');recoverStorage(storage);
  assert.deepEqual(JSON.parse(storage.getItem(keys.meta)).sites[1].recovery.photos,[{id:'photo'}]);
});
test('recovery replay itself is restartable',()=>{const storage=store();storage.setItem(keys.transaction,JSON.stringify({state:newState,meta:newMeta}));assert.throws(()=>recoverStorage(storage,(key,value)=>{if(key===keys.meta)throw new Error('quota');storage.setItem(key,value);}));assert.ok(storage.getItem(keys.transaction));recoverStorage(storage);assert.deepEqual(JSON.parse(storage.getItem(keys.meta)),newMeta);});
test('malformed recovery transaction is retained and fails closed',()=>{const storage=store();storage.setItem(keys.transaction,'{"state":{}}');assert.throws(()=>recoverStorage(storage));assert.ok(storage.getItem(keys.transaction));});
