const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {Journal,payloadFor}=require('../sync-core.js');
let chromium;try{({chromium}=require('playwright'));}catch{}
const root=path.resolve(__dirname,'..');
let server,browser,url;
const local=(name='original',id=1)=>({sites:[{id,name}],assets:[{id:10,siteId:id,note:name}],photos:[]});
const row=(name='original',rev=1,id=1)=>({id,revision:rev,site_state:payloadFor(local(name,id),local(name,id).sites[0])});
function seed(state=local(),rows=[row()],role='technician'){
  const journal=new Journal({ownerId:'account-a'});journal.reconcile(local(),[row()],[{site_id:1,role}]);
  return {state,rows,members:rows.map(row=>({site_id:row.id,role})),meta:journal.meta};
}
const browserTest=(name,fn)=>test(name,{skip:!chromium?'Install Playwright to run browser regression coverage':false},fn);
test.before(async()=>{
  if(!chromium)return;
  server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const allowed={'/':'tests/fixtures/sync-harness.html','/sync-core.js':'sync-core.js','/supabase-sync.js':'supabase-sync.js','/sync-bootstrap.js':'sync-bootstrap.js'};
    if(!allowed[pathname]){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(root,allowed[pathname])));
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
});
test.after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function open(t,config){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
  await context.addInitScript(value=>{window.TEST_SEED=value;},config);
  const page=await context.newPage();await page.goto(url);return {context,page};
}
async function settled(page){await page.waitForFunction(()=>document.getElementById('ppmCloudStatus')?.textContent==='Cloud: synced');}
async function edit(page,name){await page.evaluate(name=>{db.sites[0].name=name;db.assets[0].note=name;localStorage.setItem('ppmV3Data',JSON.stringify(db));},name);}

browserTest('startup sends retained offline edits using the saved revision',async t=>{const {page}=await open(t,seed(local('offline')));await settled(page);assert.equal(await page.evaluate(()=>testBackend.calls[0].args.p_site_state.site.name),'offline');assert.equal(await page.evaluate(()=>testBackend.calls[0].args.p_expected_revision),'1');});
browserTest('conflicting cloud version preserves local state and does not write',async t=>{const {page}=await open(t,seed(local('offline'),[row('remote',2)]));await page.waitForFunction(()=>document.getElementById('ppmCloudStatus')?.textContent.includes('review'));assert.equal(await page.evaluate(()=>db.sites[0].name),'offline');assert.equal(await page.evaluate(()=>testBackend.calls.length),0);await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByText('The cloud has another version',{exact:false}).waitFor();});
browserTest('viewer site does not stop editable site saving',async t=>{const config=seed(local('viewer-edits'),[row(),row('site two',1,2)],'viewer');config.state.sites.push({id:2,name:'local site two'});config.state.assets.push({id:20,siteId:2,note:'local site two'});config.meta.sites[2]={base:row('site two',1,2).site_state,revision:'1',role:'technician'};config.members[1].role='technician';const {page}=await open(t,config);await page.waitForFunction(()=>testBackend.calls.length===1);assert.equal(await page.evaluate(()=>testBackend.calls[0].args.p_site_id),2);});
browserTest('server denial does not stop another editable site',async t=>{const config=seed(local('edit one'));config.state.sites.push({id:2,name:'edit two'});config.rows.push(row('two',1,2));config.members.push({site_id:2,role:'admin'});config.meta.sites[2]={base:row('two',1,2).site_state,revision:'1',role:'admin'};config.failSites=[1];const {page}=await open(t,config);await page.waitForFunction(()=>testBackend.calls.length===2);assert.deepEqual(await page.evaluate(()=>testBackend.calls.map(x=>x.args.p_site_id)),[1,2]);});
browserTest('save acknowledgement cannot clear an edit made in flight',async t=>{const config=seed(local('first'));config.holdRpc=true;const {page}=await open(t,config);await page.waitForFunction(()=>typeof testBackend.releaseRpc==='function');await edit(page,'second');await page.evaluate(()=>{testBackend.holdRpc=false;testBackend.releaseRpc();});await page.waitForFunction(()=>testBackend.calls.length===2);await settled(page);assert.equal(await page.evaluate(()=>testBackend.calls[1].args.p_site_state.site.name),'second');assert.equal(await page.evaluate(()=>testBackend.calls[1].args.p_expected_revision),'2');});
browserTest('quota failure while pulling cloud cannot advance the saved baseline',async t=>{const config=seed(local(),[row('remote',2)]);config.failStateWrite=true;const {page}=await open(t,config);await page.getByText('Local data needs attention').waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ppmSyncJournalV1')).sites[1].revision),'1');assert.equal(await page.evaluate(()=>testBackend.calls.length),0);});
browserTest('explicit sign-out archives pending changes and removes active data',async t=>{const {page}=await open(t,seed(local('offline'),[row('remote',2)]));await page.waitForFunction(()=>document.getElementById('ppmCloudStatus')?.textContent.includes('review'));await page.getByRole('button',{name:'Account',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ppmAccountCacheV1:account-a')).state.sites[0].name),'offline');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ppmV3Data')).sites.length),0);});
browserTest('sign-in restores only the matching account cache after reload',async t=>{const config=seed();config.session=null;const {page}=await open(t,config);await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();await page.getByRole('button',{name:'Sign in',exact:true}).click();await settled(page);assert.equal(await page.evaluate(()=>db.sites[0].name),'original');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ppmSyncJournalV1')).ownerId),'account-a');});
browserTest('external sign-out is handled during a deferred startup read',async t=>{const config=seed(local('offline'));config.holdReads=true;const {page}=await open(t,config);await page.waitForFunction(()=>typeof testBackend.releaseRead==='function');await page.evaluate(()=>emitAuth('SIGNED_OUT',null));await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ppmAccountCacheV1:account-a')).state.sites[0].name),'offline');assert.equal(await page.evaluate(()=>testBackend.calls.length),0);});
browserTest('identity change clears old dialogs and account data before offline use',async t=>{const {page}=await open(t,seed());await settled(page);await page.evaluate(()=>{const modal=document.createElement('div');modal.id='old-account-dialog';modal.textContent='synthetic private old dialog';document.body.appendChild(modal);emitAuth('SIGNED_OUT',null);});await page.getByRole('button',{name:'Use offline only',exact:true}).click();assert.equal(await page.locator('#old-account-dialog').count(),0);assert.equal(await page.evaluate(()=>db.sites.length),0);});
browserTest('a second tab is blocked before app state initialization',async t=>{const {page,context}=await open(t,seed());await settled(page);const second=await context.newPage();await second.goto(url);await second.getByText('PPM is open in another tab').waitFor();assert.equal(await second.evaluate(()=>typeof window.db),'undefined');await second.close();});
browserTest('revoked sites are hidden and retained in recovery, never recreated',async t=>{const {page}=await open(t,seed(local('offline'),[]));await page.waitForFunction(()=>document.getElementById('ppmCloudStatus')?.textContent.includes('review'));assert.equal(await page.evaluate(()=>db.sites.length),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ppmSyncJournalV1')).sites[1].recovery.state.site.name),'offline');assert.equal(await page.evaluate(()=>testBackend.calls.length),0);});
