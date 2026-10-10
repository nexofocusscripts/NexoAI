import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const data=path.resolve('../real-model-validation');await fs.mkdir(data,{recursive:true});
const reservation=net.createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const child=spawn(process.execPath,['src/server.mjs'],{windowsHide:true,env:{...process.env,NEXO_DATA_DIR:data,NEXO_PORT:String(port),NEXO_API_TOKEN:'real-model-fixture'},stdio:['ignore','pipe','pipe']});let log='';child.stdout.on('data',c=>log+=c);child.stderr.on('data',c=>log+=c);
const api=async(route,body,method=body?'POST':'GET')=>{const r=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{'x-nexo-token':'real-model-fixture',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(JSON.stringify(value));return value};
try{
 for(let i=0;i<100&&!log.includes('http://');i++)await new Promise(r=>setTimeout(r,100));assert.match(log,/http:/);
 const project='Agente real';await api('/api/projects',{name:project});
 const tests="import test from 'node:test';import assert from 'node:assert/strict';import {sum} from './sum.mjs';test('sum accepts positive and negative values',()=>{assert.equal(sum(2,3),5);assert.equal(sum(-2,7),5);assert.equal(sum(0,0),0)});";
 await api('/api/file',{project,filePath:'sum.test.mjs',content:tests},'PUT');
 await api('/api/file',{project,filePath:'sum.mjs',content:'export function sum(a,b){return a-b}\n'},'PUT');
 const initialPlan={message:'Validar implementação e corrigir falhas.',actions:[{type:'command',command:'node --test sum.test.mjs'}]};
 const session=await api('/api/agent/session/prepare',{project,prompt:'Corrige sum.mjs para somar corretamente dois números. Preserva os testes existentes. Valida com node --test sum.test.mjs.',model:'qwen2.5-coder:14b',initialPlan,maxIterations:3});
 await api('/api/agent/session/start',{id:session.id,confirmed:true});
 let result;for(let i=0;i<600;i++){result=await api('/api/agent/session?id='+session.id);if(!['running','editing','testing','analysing'].includes(result.status))break;await new Promise(r=>setTimeout(r,1000))}
 assert.equal(result.status,'validated',JSON.stringify(result));assert.ok(result.iterations.length>=2);assert.equal(result.iterations[0].tests[0].ok,false);assert.ok(result.validationIds.length);
 assert.equal(await fs.readFile(path.join(data,'projects',project,'sum.test.mjs'),'utf8'),tests);
 console.log('PASS: actual local model corrected failed implementation, repeated authorized AppContainer tests, preserved tests and produced validation evidence.');
 const memory=await api('/api/memory/semantic',{project,title:'Soma correta',problem:'Resultado aritmético incorreto',solution:'A função sum deve usar a operação a + b para adicionar números positivos, negativos e zero.'});
 const stored=JSON.parse(await fs.readFile(path.join(data,'semantic-memory.json'),'utf8')).find(x=>x.id===memory.id);assert.ok(stored.embedding?.vector.length>100,'Real embeddings missing');
 await api('/api/memory/semantic/confirm',{id:memory.id,project,validationId:result.validationIds[0]});
 const retrieval=await api('/api/memory/semantic?q='+encodeURIComponent('Como adicionar duas quantidades?')+'&project='+encodeURIComponent(project));assert.equal(retrieval.items[0]?.id,memory.id);assert.equal(retrieval.items[0].retrieval,'local-embeddings');
 console.log('PASS: actual nomic embeddings persisted and retrieved a solution promoted with current successful test evidence.');
 await fs.writeFile(path.join(data,'results.json'),JSON.stringify({agent:result.status,iterations:result.iterations.length,sandbox:result.iterations.at(-1).tests[0].sandbox,semantic:retrieval.items[0].retrieval},null,2));
}finally{child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r))}
