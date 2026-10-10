import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {projectPath} from './filesystem.mjs';
import {appendJson,readJson} from './store.mjs';
export async function projectDigest(root){
 const hash=crypto.createHash('sha256');let total=0,files=0;
 async function visit(relative='.'){
  const dir=await projectPath(root,relative),entries=(await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name));
  for(const entry of entries){if(['.nexo','.git','node_modules'].includes(entry.name))continue;const rel=relative==='.'?entry.name:relative+'/'+entry.name;if(entry.isSymbolicLink())throw Error('Projeto contém ligação simbólica.');if(entry.isDirectory())await visit(rel);else if(entry.isFile()){const content=await fs.readFile(await projectPath(root,rel));total+=content.length;files++;if(total>100000000||files>10000)throw Error('Projeto demasiado grande para validação integral.');hash.update(rel+'\0');hash.update(String(content.length)+'\0');hash.update(content);}}
 }
 await visit();return hash.digest('hex');
}
export function validationService(data){const file=path.join(data,'validation','evidence.json');return {
 async record(project,root,command,before,result){const after=await projectDigest(root),proof={id:crypto.randomUUID(),project,command,snapshot:after,stable:before===after,ok:result.ok===true&&result.testCount>0&&before===after&&!/--check(?:\s|$)/.test(command),sandbox:result.sandbox,code:result.code,at:new Date().toISOString()};await appendJson(file,proof,2000);return proof},
 async require(project,root,id){const proof=(await readJson(file,[])).find(x=>x.id===id&&x.project===project);if(!proof?.ok||proof.sandbox!=='Windows AppContainer'||proof.snapshot!==await projectDigest(root))throw Error('É necessária uma validação bem-sucedida da versão atual do projeto.');return proof}
}}
