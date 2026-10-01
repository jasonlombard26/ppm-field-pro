const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..');
const inlineScripts=html=>[...parseHTML(html).document.querySelectorAll('script')]
 .filter(script=>!script.hasAttribute('src'))
 .map(script=>script.textContent)
 .filter(source=>source.trim());
for(const file of ['index.html','pc.html'])test(`${file} syntax and guarded loader ordering`,()=>{
 const html=fs.readFileSync(path.join(root,file),'utf8');
 const scripts=inlineScripts(html);
 assert.ok(scripts.length>0,`${file} must include its startup script`);
 for(const source of scripts)new vm.Script(source,{filename:file});
 assert.ok(html.indexOf('sync-core.js')<html.indexOf('sync-bootstrap.js'));
 assert.ok(html.indexOf('sync-bootstrap.js')<html.indexOf('payload-v37.js'));
 assert.match(html,/await window\.ppmCacheReady/);
 assert.match(html,/ppmSyncStartupGuard/);
 assert.match(html,/supabase-sync\.js\?v=38/);
});
for(const file of ['sync-core.js','sync-bootstrap.js','supabase-sync.js'])test(`${file} syntax`,()=>{new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});});

test('HTML parsing finds scripts with closing-tag whitespace without reading comments or external fallbacks',()=>{
 const html=`<!doctype html><html><head></head><body>
 <!-- <script>invalid comment JavaScript</script> -->
 <script data-description="a > b">window.first=true;</script >
 <SCRIPT>window.second=true;</SCRIPT
 >
 <script src="external.js">invalid external fallback JavaScript</script >
 </body></html>`;
 const scripts=inlineScripts(html);
 assert.deepEqual(scripts,['window.first=true;','window.second=true;']);
 for(const source of scripts)assert.doesNotThrow(()=>new vm.Script(source));
});

test('syntax errors before a whitespace-terminated script tag are still checked',()=>{
 const scripts=inlineScripts('<script>const broken = ;</script >');
 assert.equal(scripts.length,1);
 assert.throws(()=>new vm.Script(scripts[0]),SyntaxError);
});
