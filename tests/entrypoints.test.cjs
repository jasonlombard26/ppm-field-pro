const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const file of ['index.html','pc.html'])test(`${file} syntax and guarded loader ordering`,()=>{
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)){if(script[1].trim())new vm.Script(script[1],{filename:file});}
 assert.ok(html.indexOf('sync-core.js')<html.indexOf('sync-bootstrap.js'));
 assert.ok(html.indexOf('sync-bootstrap.js')<html.indexOf('payload-v37.js'));
 assert.match(html,/await window\.ppmCacheReady/);
 assert.match(html,/ppmSyncStartupGuard/);
 assert.match(html,/supabase-sync\.js\?v=38/);
});
for(const file of ['sync-core.js','sync-bootstrap.js','supabase-sync.js'])test(`${file} syntax`,()=>{new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});});
