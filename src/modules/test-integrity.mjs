import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {projectPath} from './filesystem.mjs';
const digest=content=>crypto.createHash('sha256').update(content).digest('hex');
export async function sealTests(root,tests,{allowEmpty=false}={}){
 const argumentsList=tests.flatMap(t=>t.testPaths||t.arguments.filter(a=>!a.startsWith('-')));
 const patterns=argumentsList.map(argument=>({argument,regex:new RegExp('^'+argument.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$')}));
 const sealed={};let files=0;
 async function visit(relative='.'){
  for(const entry of await fs.readdir(await projectPath(root,relative),{withFileTypes:true})){
   if(['.nexo','.git','node_modules'].includes(entry.name))continue;
   const rel=relative==='.'?entry.name:relative+'/'+entry.name;
   if(entry.isSymbolicLink())throw Error('Ligação simbólica nos testes.');
   if(entry.isDirectory())await visit(rel);
   else if(entry.isFile()){
    if(++files>10000)throw Error('Projeto demasiado grande para proteger os testes.');
    const selected=patterns.length?patterns.some(p=>p.regex.test(rel)||rel.startsWith(p.argument+'/')):/(^|\/)(tests?\/|test[^/]*\.[cm]?js$)|\.test\.[cm]?js$/.test(rel);
    if(selected)sealed[rel]=digest(await fs.readFile(await projectPath(root,rel)));
   }
  }
 }
 await visit();if(!allowEmpty&&!Object.keys(sealed).length)throw Error('Os testes autorizados não correspondem a ficheiros do projeto.');return sealed;
}
export async function guardTests(root,sealed,actions){
 for(const [rel,expected] of Object.entries(sealed||{})){
  if(digest(await fs.readFile(await projectPath(root,rel)))!==expected)throw Error('Os testes autorizados foram alterados. Revê uma nova sessão.');
  for(const action of actions){
   if(!['write','delete','mkdir'].includes(action.type))continue;
   const target=await projectPath(root,action.path),relative=path.relative(root,target).replaceAll('\\','/');
   if(action.type==='delete'&&(!relative||rel.toLowerCase()===relative.toLowerCase()||rel.toLowerCase().startsWith(relative.toLowerCase()+'/')))throw Error('O agente não pode remover os testes autorizados para fazer a tarefa passar.');
   if(action.type==='write'&&relative.toLowerCase()===rel.toLowerCase()&&digest(String(action.content??''))!==expected)throw Error('O agente tentou alterar os testes autorizados. Revê uma nova sessão.');
  }
 }
}
