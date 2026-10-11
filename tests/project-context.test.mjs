import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {projectContext,guardContextChanges} from '../src/modules/project-context.mjs';
test('context ranks requested files beyond the old 40 file cutoff and never cuts their contents',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-context-'));try{
  const items=[];for(let n=0;n<50;n++){const name=`irrelevant-${n}.txt`;await fs.writeFile(path.join(root,name),'x'.repeat(500));items.push({path:name,type:'file'})}
  await fs.writeFile(path.join(root,'invoice.py'),'def total(): return 42\n');items.push({path:'invoice.py',type:'file'});
  const context=await projectContext(root,items,'Corrige invoice.py',{budget:1000});assert.equal(context.files[0].path,'invoice.py');assert.equal(context.files[0].content,'def total(): return 42\n');assert.equal(context.complete,false);
  assert.throws(()=>guardContextChanges(context,[{type:'write',path:context.omitted[0].path,content:'replacement'}]),/integralmente/);
  assert.doesNotThrow(()=>guardContextChanges(context,[{type:'write',path:'invoice.py',content:'fixed'}]));
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('context excludes credentials, binary and oversized files and blocks directory deletion containing omissions',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-context-'));try{
  await fs.mkdir(path.join(root,'config'));for(const [name,content]of [['config/.env','TOKEN=private'],['key.pem','private'],['binary.dat',Buffer.from([0,1,2])],['large.py','x'.repeat(200)]])await fs.writeFile(path.join(root,name),content);
  const context=await projectContext(root,['config/.env','key.pem','binary.dat','large.py'].map(path=>({path,type:'file'})),'',{maxFileBytes:100});assert.equal(context.files.length,0);assert.deepEqual(context.omitted.map(x=>x.reason).sort(),['binary','sensitive','sensitive','size']);assert.throws(()=>guardContextChanges(context,[{type:'delete',path:'config'}]),/integralmente/);assert.throws(()=>guardContextChanges(context,[{type:'write',path:'.env.production'}]),/credenciais/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
