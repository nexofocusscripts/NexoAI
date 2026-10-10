import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import worker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {unzipSync} from 'fflate';
pdfjs.GlobalWorkerOptions.workerSrc=worker;
const imageItem=(canvas,name)=>({kind:'image',name,mime:'image/jpeg',base64:canvas.toDataURL('image/jpeg',.75).split(',')[1]});
export async function readDocument(file){
 if(file.size>20000000)throw Error('Documento demasiado grande. Usa ficheiros até 20 MB.');
 if(/\.docx$/i.test(file.name)){
  const archive=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{if(entry.name==='word/document.xml'&&entry.originalSize>4000000)throw Error('Documento demasiado grande.');return entry.name==='word/document.xml'}});
  if(!archive['word/document.xml'])throw Error('Documento Word inválido.');const xml=new DOMParser().parseFromString(new TextDecoder().decode(archive['word/document.xml']),'application/xml');if(xml.querySelector('parsererror'))throw Error('Documento Word inválido.');
  const content=Array.from(xml.getElementsByTagNameNS('*','p')).map(p=>Array.from(p.getElementsByTagNameNS('*','t')).map(n=>n.textContent).join('')).join('\n');if(content.length>120000)throw Error('Divide o documento em partes até 120 mil caracteres.');return {items:[{kind:'text',name:file.name+'.txt',content}],notice:'Texto do documento Word extraído localmente.'};
 }
 if(!/\.pdf$/i.test(file.name))return null;
 const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),standardFontDataUrl:new URL('/fonts/',location.href).href,isEvalSupported:false,useSystemFonts:true,disableFontFace:true,enableXfa:false});
 const pdf=await task.promise;
 try{
  if(pdf.numPages>200)throw Error('Usa PDFs até 200 páginas.');let text='';
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),data=await page.getTextContent();text+=`\nPágina ${i}\n`+data.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('');if(text.length>120000)throw Error('Divide o PDF em partes até 120 mil caracteres.');page.cleanup()}
  if(text.replace(/Página \d+/g,'').trim().length>0)return {items:[{kind:'text',name:file.name+'.txt',content:text}],notice:`Texto de ${pdf.numPages} páginas extraído localmente.`};
  const items=[];for(let i=1;i<=Math.min(pdf.numPages,4);i++){const page=await pdf.getPage(i),first=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(1.5,1024/Math.max(first.width,first.height))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;items.push(imageItem(canvas,file.name+` — página ${i}`));page.cleanup()}
  return {items,notice:pdf.numPages>4?'PDF digitalizado: anexadas apenas as primeiras quatro páginas. Divide o documento para analisar as restantes.':`PDF digitalizado: ${pdf.numPages} páginas preparadas para um modelo visual local.`};
 }finally{await task.destroy()}
}
