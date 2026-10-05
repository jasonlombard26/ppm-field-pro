/* All parser work stays in a bounded local worker; no customer content is posted. */
if(typeof importScripts==='function')importScripts('./vendor/sheetjs-0.20.3/xlsx.full.min.js','./report-import-core.js?v=2','./report-import-pdf.js?v=1');
const wiringParser=typeof module==='object'?require('./report-import-pdf.js'):self.PPMWiringImport;
const parserCore=typeof module==='object'?require('./report-import-core.js'):self.PPMReportImport;
const parserXLSX=typeof module==='object'?require('./vendor/sheetjs-0.20.3/xlsx.full.min.js'):self.XLSX;
const parserBase=typeof __filename==='string'?require('node:url').pathToFileURL(__filename).href:self.location.href;
const L=parserCore.LIMITS;
function checkZip(bytes){
 if(bytes[0]!==0x50||bytes[1]!==0x4b)return;
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let entries=0,total=0;
 for(let i=Math.max(0,bytes.length-65557);i+22<=bytes.length;i++)if(view.getUint32(i,true)===0x06054b50){
  const count=view.getUint16(i+10,true),offset=view.getUint32(i+16,true);if(count>2000||offset>=bytes.length)throw Error('Spreadsheet ZIP exceeds safe bounds.');let at=offset;
  while(entries<count){if(at+46>bytes.length||view.getUint32(at,true)!==0x02014b50)throw Error('Invalid spreadsheet ZIP directory.');const size=view.getUint32(at+24,true);total+=size;if(size>32*1024*1024||total>64*1024*1024)throw Error('Expanded spreadsheet exceeds 64 MiB limit.');at+=46+view.getUint16(at+28,true)+view.getUint16(at+30,true)+view.getUint16(at+32,true);entries++;}return;
 }
 throw Error('Unsupported spreadsheet ZIP directory.');
}
async function parseReport(buffer,fileName){
  const bytes=new Uint8Array(buffer);if(bytes.length>L.fileBytes)throw Error('Maximum report size is 15 MiB.');
  if(/\.pdf$/i.test(fileName)){
   const pdfjs=await import('./vendor/pdfjs-6.4.299/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs-6.4.299/legacy/build/pdf.worker.mjs',parserBase).href;
   // In a browser worker PDF.js cannot use window.location. An explicit child port
   // avoids its fake-worker fallback importing a second protocol onto our parent channel.
   const browserWorker=typeof __filename!=='string';
   const pdfPort=browserWorker?new Worker(pdfjs.GlobalWorkerOptions.workerSrc,{type:'module'}):null;
   const pdfWorker=pdfPort?pdfjs.PDFWorker.create({port:pdfPort}):null;
   const fonts=typeof __filename==='string'?require('node:path').join(__dirname,'vendor/pdfjs-6.4.299/standard_fonts/').replace(/\\/g,'/'):new URL('./vendor/pdfjs-6.4.299/standard_fonts/',parserBase).href;
   let loading;
   try{loading=pdfjs.getDocument({data:bytes,worker:pdfWorker,isEvalSupported:false,disableFontFace:true,useWorkerFetch:browserWorker,disableAutoFetch:true,cMapUrl:new URL('./vendor/pdfjs-6.4.299/cmaps/',parserBase).href,cMapPacked:true,standardFontDataUrl:fonts,wasmUrl:new URL('./vendor/pdfjs-6.4.299/wasm/',parserBase).href});
    const doc=await loading.promise;
    if(doc.numPages>L.pages)throw Error('Maximum PDF length is 100 pages.');const pages=[];let count=0;
    for(let page=1;page<=doc.numPages;page++){const content=await (await doc.getPage(page)).getTextContent();const items=content.items.filter(i=>typeof i.str==='string').map(i=>({text:i.str,x:i.transform[4],y:i.transform[5]}));count+=items.reduce((s,i)=>s+i.text.length,0);if(count>L.textChars)throw Error('PDF text exceeds the review limit.');pages.push({page,items});}
    const parsed=wiringParser.parseWiring(pages,fileName);
    return {ok:true,...(parsed?{parsed}:{}),pdfReview:{pages},message:'No supported wiring layout found. Text review only; no records can be applied.'};
   }finally{try{await loading?.destroy();}finally{pdfWorker?.destroy();pdfPort?.terminate();}}
   return;
  }
  if(!/\.xlsx?$/i.test(fileName))throw Error('Choose a supported .xls, .xlsx or .pdf report.');checkZip(bytes);
  const book=parserXLSX.read(bytes,{type:'array',cellFormula:true,cellHTML:false,cellText:true,cellDates:false,bookVBA:false,sheetRows:L.rows+1});
  if(book.SheetNames.length>L.sheets)throw Error('Maximum worksheet count is 20.');let formulas=0;
  const sheets=book.SheetNames.map(name=>{const sheet=book.Sheets[name],range=parserXLSX.utils.decode_range(sheet['!ref']||'A1');if(range.e.r>=L.rows||range.e.c>=L.columns)throw Error('Worksheet exceeds 10,000 rows or 80 columns.');const rows=[];
   for(let r=0;r<=range.e.r;r++){const row=[];for(let c=0;c<=range.e.c;c++){const cell=sheet[parserXLSX.utils.encode_cell({r,c})];if(cell?.f){formulas++;row.push('');}else row.push(cell?String(cell.w??cell.v??''):'');}rows.push(row);}return {name,rows};
  });
  const parsed=parserCore.parseSheets(sheets,fileName);if(formulas)parsed.warnings.push(`${formulas} formula cells were ignored. No formulas or macros were executed.`);return {ok:true,parsed};
}
if(typeof module==='object')module.exports={parseReport,checkZip};
else self.onmessage=async event=>{try{self.postMessage({kind:'ppm-report-result',...await parseReport(event.data.buffer,event.data.fileName)});}catch(error){self.postMessage({kind:'ppm-report-result',ok:false,error:String(error?.message||error)});}};
