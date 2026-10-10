// Isolated product test; never attaches to an existing user browser/profile.
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
const server=await createServer({server:{host:'127.0.0.1',port:1420,strictPort:true}});
await server.listen();
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 const page=await browser.newPage();const unexpected=[];
 page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:1420/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))unexpected.push(r.url())});
 await page.goto('http://127.0.0.1:1420/');
 const pdf=await fs.readFile(new URL('./fixtures/documento-local.pdf',import.meta.url));
 const docx=zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>NEXO_WORD_LOCAL_OK</w:t></w:r></w:p></w:body></w:document>')});
 const result=await page.evaluate(async({pdf,docx})=>{
  const {readDocument}=await import('/documents.js');
  const a=await readDocument(new File([new Uint8Array(pdf)],'local.pdf',{type:'application/pdf'}));
  const b=await readDocument(new File([new Uint8Array(docx)],'local.docx'));
  let invalid='';try{await readDocument(new File([new Uint8Array([1,2,3])],'bad.pdf'))}catch(e){invalid=e.message}
  return {a,b,invalid};
 },{pdf:[...pdf],docx:[...docx]});
 assert.equal(result.a.items[0].kind,'text');assert.match(result.a.items[0].content,/NEXO_PDF_LOCAL_OK/);
 assert.equal(result.b.items[0].content,'NEXO_WORD_LOCAL_OK');assert.ok(result.invalid);assert.deepEqual(unexpected,[]);
 console.log('PASS: digital PDF and Word extraction, damaged PDF rejection; no external requests.');
}finally{await browser.close();await server.close()}
