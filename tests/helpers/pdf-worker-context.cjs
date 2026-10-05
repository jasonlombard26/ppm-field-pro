// Browser-style JS realm checks, not a real browser or a rendering test.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),root=path.resolve(__dirname,'../..');
function scope(messages){const s={console,Blob,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,structuredClone,AbortController,ReadableStream,TransformStream,Response,Headers,fetch:()=>{throw Error('Network forbidden in this test');},onmessage:null,postMessage:x=>messages.push(x),addEventListener:()=>{},removeEventListener:()=>{},location:{href:'https://example.invalid/report-parser-worker.js'}};s.self=s;return s;}
(async()=>{
 const emitted=[],s=scope(emitted),context=vm.createContext(s),vendor=new vm.SourceTextModule(fs.readFileSync(path.join(root,'vendor/pdfjs-6.4.299/legacy/build/pdf.worker.mjs'),'utf8'),{context});await vendor.link(()=>{throw Error('Unexpected static import');});await vendor.evaluate();assert.equal(emitted.length,1);assert.equal(emitted[0].action,'ready');assert.equal(emitted[0].sourceName,'worker');
 for(const fail of [false,true]){
  const replies=[],s=scope(replies),c=vm.createContext(s),ports=[];let loadingDestroyed=0,pdfDestroyed=0,options;
  s.Worker=class{constructor(url,opts){this.url=url;this.options=opts;this.terminated=0;ports.push(this);}terminate(){this.terminated++;}};
  s.importScripts=(...names)=>{for(const name of names){if(name.includes('sheetjs')){s.XLSX={};continue;}vm.runInContext(fs.readFileSync(path.join(root,name.split('?')[0]),'utf8'),c);}};
  const api={GlobalWorkerOptions:{},PDFWorker:{create:({port})=>{assert.equal(port,ports[0]);return {destroy:()=>pdfDestroyed++};}},getDocument:o=>{options=o;return {promise:fail?Promise.reject(Error('synthetic load failure')):Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[{str:'Synthetic text',transform:[1,0,0,1,50,700]}]})})}),destroy:async()=>loadingDestroyed++};}};
  const mod=new vm.SyntheticModule(Object.keys(api),function(){for(const [k,v] of Object.entries(api))this.setExport(k,v);},{context:c});await mod.link(()=>{});await mod.evaluate();
  const app=new vm.Script(fs.readFileSync(path.join(root,'report-parser-worker.js'),'utf8'),{filename:'report-parser-worker.js',importModuleDynamically:async()=>mod});app.runInContext(c);await s.onmessage({data:{buffer:new ArrayBuffer(1),fileName:'synthetic.pdf'}});
  assert.equal(ports.length,1);assert.equal(ports[0].options.type,'module');assert.match(ports[0].url,/\/vendor\/pdfjs-6\.4\.299\/legacy\/build\/pdf.worker.mjs$/);assert.ok(options.worker);assert.equal(options.useWorkerFetch,true);assert.equal(options.isEvalSupported,false);assert.equal(ports[0].terminated,1);assert.equal(pdfDestroyed,1);assert.equal(loadingDestroyed,1);assert.equal(replies.length,1);assert.equal(replies[0].kind,'ppm-report-result');assert.equal(replies[0].ok,!fail);
 }
 console.log('Vendor ready-message reproduction and isolated child-port success/failure cleanup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
