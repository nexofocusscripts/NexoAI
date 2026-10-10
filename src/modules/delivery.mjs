import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {zipSync} from 'fflate';
import {projectPath} from './filesystem.mjs';
import {projectDigest} from './validation.mjs';
import {writeJson,readJson} from './store.mjs';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const secret=name=>/^\.env(?:\.|$)/i.test(name)||/\.(pfx|p12|key|pem)$/i.test(name)||/^(credentials|secrets)(?:\.|$)/i.test(name);
export function deliveryService(data,validation){
 const directory=path.join(data,'deliveries');
 const validId=id=>{if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('Entrega inválida.');return id};
 return {
  async create(session,root){
   if(!session.validationIds?.length)throw Error('Não existem testes validados para esta entrega.');
   const snapshot=await projectDigest(root);
   for(const id of session.validationIds)await validation.require(session.project,root,id);
   const files=Object.create(null),inventory=[],excluded=[];let total=0,count=0;
   async function visit(relative='.'){
    for(const entry of (await fs.readdir(await projectPath(root,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
     const rel=relative==='.'?entry.name:relative+'/'+entry.name;
     if(['node_modules','.git','.nexo'].includes(entry.name)||secret(entry.name)){excluded.push(rel);continue}
     if(entry.isSymbolicLink())throw Error('Entrega contém uma ligação simbólica.');
     if(entry.isDirectory())await visit(rel);
     else if(entry.isFile()){
      const bytes=await fs.readFile(await projectPath(root,rel));total+=bytes.length;
      if(++count>10000||total>100000000)throw Error('Projeto demasiado grande para entrega segura.');
      files['projeto/'+rel]=bytes;inventory.push({path:rel,bytes:bytes.length,sha256:hash(bytes)});
     }
    }
   }
   await visit();if(!count)throw Error('O projeto não contém ficheiros para entregar.');
   if(snapshot!==await projectDigest(root))throw Error('O projeto mudou durante a preparação da entrega.');
   for(const id of session.validationIds)await validation.require(session.project,root,id);
   const report={format:'nexo-delivery-v1',project:session.project,sessionId:session.id,model:session.model,createdAt:new Date().toISOString(),snapshot,
    validation:'Passou os testes comportamentais autorizados desta versão; não é garantia de ausência de erros.',
    tests:session.iterations.at(-1)?.tests.map(t=>({ok:t.ok,code:t.code,testCount:t.testCount,sandbox:t.sandbox,validationId:t.validation?.id}))||[],
    files:inventory,excluded,review:session.iterations.at(-1)?.review?{performed:true,blocking:session.iterations.at(-1).review.blocking===true,findingsCount:session.iterations.at(-1).review.findings?.length||0}:null};
   files['NEXO-RELATORIO.json']=Buffer.from(JSON.stringify(report,null,2));
   const bytes=zipSync(files,{level:6});if(bytes.length>32000000)throw Error('ZIP excede o limite de 32 MB.');
   const id=validId(session.id),metadata={id,project:session.project,name:session.project+'-NexoAI.zip',bytes:bytes.length,sha256:hash(bytes),snapshot,createdAt:report.createdAt,files:inventory.length,excluded};
   await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,id+'.zip'),bytes);await writeJson(path.join(directory,id+'.json'),metadata);return metadata;
  },
  async get(id){validId(id);const metadata=await readJson(path.join(directory,id+'.json'),null);if(!metadata)throw Error('Entrega não encontrada.');const bytes=await fs.readFile(path.join(directory,id+'.zip'));if(bytes.length!==metadata.bytes||hash(bytes)!==metadata.sha256)throw Error('A integridade da entrega não corresponde ao registo.');return {metadata,bytes};}
 };
}
