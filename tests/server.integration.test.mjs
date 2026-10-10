import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('server startup, offline state, project isolation and API boundary',{timeout:20000},async()=>{
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-http-'));
  const reservation=net.createServer();
  await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
  const port=reservation.address().port;
  await new Promise(resolve=>reservation.close(resolve));
  const process=spawn(globalThis.process.execPath,[fileURLToPath(new URL('../src/server.mjs',import.meta.url))],{
    windowsHide:true,env:{...globalThis.process.env,NEXO_PORT:String(port),NEXO_DATA_DIR:data,NEXO_API_TOKEN:'fixture-token',OLLAMA_URL:'http://127.0.0.1:1'},stdio:['ignore','pipe','pipe']
  });
  let log='';process.stdout.on('data',chunk=>log+=chunk);process.stderr.on('data',chunk=>log+=chunk);
  const base=`http://127.0.0.1:${port}`;
  const fetch=(url,options={})=>globalThis.fetch(url,{...options,headers:{'x-nexo-token':'fixture-token',...options.headers}});
  const send=(url,value,extra={})=>fetch(base+url,{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(value)});
  try{
    for(let i=0;i<100;i++){if(log.includes('http://'))break;if(process.exitCode!==null)throw Error(log);await new Promise(resolve=>setTimeout(resolve,50));}
    assert.ok(log.includes('http://'),log);
    assert.equal((await globalThis.fetch(base+'/api/health')).status,401);
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await (await fetch(base+'/api/health')).json()).ok,true);
    const settings=await(await fetch(base+'/api/settings')).json();
    assert.equal(settings.onlineMode,false);assert.equal(settings.externalAI,false);
    assert.equal((await send('/api/projects',{name:'..'})).status,500);
    assert.equal((await send('/api/projects',{name:'A'})).status,201);
    assert.equal((await send('/api/projects',{name:'B'})).status,201);
    const write=await fetch(base+'/api/file',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({project:'A',filePath:'a.txt',content:'isolated'})});
    assert.equal(write.status,200);
    assert.equal(await fs.readFile(path.join(data,'projects','A','a.txt'),'utf8'),'isolated');
    assert.deepEqual((await(await fetch(base+'/api/files?project=B')).json()).files,[]);
    assert.equal((await send('/api/projects',{name:'unwanted'},{origin:'https://attacker.example'})).status,403);
    const hostileHostStatus=await new Promise((resolve,reject)=>{const req=http.get(base+'/api/settings',{headers:{host:'attacker.example','x-nexo-token':'fixture-token'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject)});
    assert.equal(hostileHostStatus,403);
    assert.equal((await send('/api/search',{query:'private',confirmed:true})).status,409);
    await assert.rejects(()=>fs.stat(path.join(data,'projects','unwanted')),e=>e.code==='ENOENT');
  }finally{
    if(process.exitCode===null){const exited=new Promise(resolve=>process.once('exit',resolve));process.kill();await exited;}
    await fs.rm(data,{recursive:true,force:true});
  }
});
