const allowedText=/\.(txt|md|csv|json|js|mjs|ts|tsx|jsx|py|lua|html|css|xml|yaml|yml|log)$/i;
export function attachments(input=[]){
 if(!Array.isArray(input)||input.length>4)throw Error('Até quatro anexos por mensagem.');
 let bytes=0;
 return input.map(item=>{
  const name=String(item.name||'Anexo').replace(/[\x00-\x1f]/g,'').slice(0,120);
  if(item.kind==='text'){
   if(!allowedText.test(name)||typeof item.content!=='string'||item.content.length>120000)throw Error('Documento de texto inválido ou demasiado grande.');
   bytes+=Buffer.byteLength(item.content);if(bytes>600000)throw Error('Anexos demasiado grandes.');return {kind:'text',name,content:item.content};
  }
  if(item.kind!=='image'||typeof item.base64!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64))throw Error('Imagem inválida.');
  const content=Buffer.from(item.base64,'base64');bytes+=content.length;if(bytes>600000)throw Error('Anexos demasiado grandes.');
  const png=content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=content[0]===255&&content[1]===216&&content[2]===255;
  if(!png&&!jpeg)throw Error('Usa uma imagem PNG ou JPEG.');
  return {kind:'image',name,mime:png?'image/png':'image/jpeg',base64:item.base64};
 });
}
export function localMessage(role,content,items=[]){return {role,content:String(content)+items.filter(a=>a.kind==='text').map(a=>`\n\nDOCUMENTO LOCAL: ${a.name}\n${a.content}`).join(''),...(items.some(a=>a.kind==='image')?{images:items.filter(a=>a.kind==='image').map(a=>a.base64)}:{})}}
