import fs from 'node:fs/promises';
import path from 'node:path';
import {projectPath} from './filesystem.mjs';

export function sensitivePath(name){
 const base=name.replaceAll('\\','/').split('/').at(-1).toLowerCase();
 return /^\.env(?:\.|$)/.test(base)||/\.(?:pem|pfx|p12|key)$/.test(base)||/^(?:credentials|secrets?)(?:\.|$)/.test(base);
}

// Include whole files only: a partial file must never look like a complete read.
export async function projectContext(root,items,prompt='',{budget=18000,maxFileBytes=120000,required=[]}={}){
 const requested=new Set(required.map(p=>p.toLowerCase()));
 const terms=prompt.toLowerCase().match(/[\p{L}\p{N}_./-]{3,}/gu)||[];
 const candidates=items.filter(x=>x.type==='file').map(x=>({path:x.path,score:(requested.has(x.path.toLowerCase())?1000000:0)+terms.reduce((n,t)=>n+(x.path.toLowerCase().includes(t)?10:0),0)+(/(?:test|spec|readme|package\.json|pyproject|\.csproj)/i.test(x.path)?2:0)})).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path));
 const result={files:[],omitted:[],complete:true};let used=0;
 for(const item of candidates){
  if(sensitivePath(item.path)){result.omitted.push({path:item.path,reason:'sensitive'});continue}
  try{
   const filename=await projectPath(root,item.path),stat=await fs.stat(filename);
   if(stat.size>maxFileBytes){result.omitted.push({path:item.path,reason:'size'});continue}
   const buffer=await fs.readFile(filename);
   if(buffer.includes(0)){result.omitted.push({path:item.path,reason:'binary'});continue}
   const content=new TextDecoder('utf-8',{fatal:true}).decode(buffer),cost=content.length+item.path.length+50;
   if(used+cost>budget){result.omitted.push({path:item.path,reason:'budget'});continue}
   used+=cost;result.files.push({path:item.path,content});
  }catch{result.omitted.push({path:item.path,reason:'unreadable'})}
 }
 result.complete=result.omitted.length===0;
 for(const name of required)if(!result.files.some(f=>f.path.toLowerCase()===name.toLowerCase()))throw Error(`Não foi possível ler integralmente ${name}. Divide o trabalho ou seleciona menos ficheiros; segredos e ficheiros binários são bloqueados.`);
 return result;
}

export function guardContextChanges(context,actions){
 for(const action of actions){
  if(!['write','delete','mkdir'].includes(action.type))continue;
  const name=path.posix.normalize(String(action.path||'').replaceAll('\\','/'));
  if(sensitivePath(name)||name.toLowerCase().startsWith('vendor/nexo')||(action.type==='delete'&&name.toLowerCase()==='vendor')||name.split('/').some(p=>['.git','.nexo','node_modules'].includes(p.toLowerCase())))throw Error('O agente não pode alterar ficheiros de credenciais, segredos ou bibliotecas geridas.');
  const normalized=name.toLowerCase();
  const omitted=context.omitted.find(x=>x.path.toLowerCase()===normalized||(action.type==='delete'&&(normalized==='.'||x.path.toLowerCase().startsWith(normalized+'/'))));
  if(omitted)throw Error(`O ficheiro ${omitted.path} não foi lido integralmente. A alteração foi bloqueada para preservar o projeto.`);
 }
 return actions;
}
