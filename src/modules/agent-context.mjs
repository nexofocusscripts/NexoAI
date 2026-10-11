import path from 'node:path';
import {sensitivePath} from './project-context.mjs';
export const readingInstructions=' Se precisares de ficheiros omitted, devolve apenas <nexo_read>["caminho relativo"]</nexo_read>, sem ações. O Nexo pode reler até quatro grupos de contexto, mantendo ficheiros completos. Não peças segredos, binários nem pastas internas. Se o trabalho exceder o contexto, propõe dividir o objetivo.';
export async function contextConversation({context,chat,messages,maxReads=4}){
 let required=[],view=await context(required);
 for(let round=0;round<=maxReads;round++){
  const output=await chat(await messages(view));const match=output.match(/<nexo_read>([\s\S]*?)<\/nexo_read>/i);
  if(!match)return {output,view};
  if(round===maxReads)throw Error('O modelo atingiu o limite de leituras. Divide o objetivo em tarefas menores.');
  if(/<nexo_actions>/i.test(output))throw Error('Uma leitura não pode incluir alterações no mesmo pedido.');
  let names;try{names=JSON.parse(match[1])}catch{throw Error('Pedido de leitura inválido.');}
  if(!Array.isArray(names)||!names.length||names.length>20||names.some(n=>typeof n!=='string'))throw Error('Lista de ficheiros a ler inválida.');
  names=names.map(n=>path.posix.normalize(n.replaceAll('\\','/')));
  for(const name of names)if(name==='.'||name.startsWith('../')||path.posix.isAbsolute(name)||name.includes(':')||sensitivePath(name)||name.split('/').some(p=>['.git','.nexo','node_modules'].includes(p.toLowerCase())))throw Error('Pedido de leitura fora do projeto ou com dados protegidos.');
  const combined=[...new Set([...required,...names])];if(combined.length===required.length)throw Error('O modelo repetiu a leitura sem avançar.');required=combined;view=await context(required);
 }
}
