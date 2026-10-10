import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const helper=fileURLToPath(new URL('../src-tauri/resources/nexo-sandbox.exe',import.meta.url));
const node=fileURLToPath(new URL('../src-tauri/resources/node.exe',import.meta.url));
test('AppContainer executes tests while denying private files and network',{skip:process.platform!=='win32',timeout:75000},async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-sandbox-')),project=path.join(base,'project'),outside=path.join(base,'private.txt');await fs.mkdir(project);await fs.writeFile(outside,'private fixture');
 let escaped=false;const server=net.createServer(socket=>{escaped=true;socket.destroy()});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
 await new Promise((resolve,reject)=>{const control=net.connect(port,'127.0.0.1');control.on('connect',()=>control.destroy());control.on('close',resolve);control.on('error',reject)});assert.equal(escaped,true);escaped=false;
 const script=`const fs=require('node:fs');const assert=require('node:assert/strict');const net=require('node:net');require('node:test')('isolamento',async()=>{fs.writeFileSync('inside.txt','allowed');assert.equal(fs.readFileSync('inside.txt','utf8'),'allowed');assert.throws(()=>fs.readFileSync(${JSON.stringify(outside)}));assert.throws(()=>fs.writeFileSync(${JSON.stringify(outside)},'escape'));await new Promise((resolve,reject)=>{const socket=net.connect(${port},'127.0.0.1');socket.setTimeout(3000,()=>{socket.destroy();console.log('ISOLATION_OK');resolve()});socket.on('connect',()=>{socket.destroy();reject(Error('NETWORK ESCAPE'))});socket.on('error',e=>{try{assert.ok(['EACCES','EPERM','ECONNREFUSED','ETIMEDOUT'].includes(e.code),e.code);console.log('ISOLATION_OK');resolve()}catch(error){reject(error)}})});});`;
 await fs.writeFile(path.join(project,'isolation.cjs'),script);
 try{
  const result=await new Promise(resolve=>execFile(helper,[project,node,'NexoAI.Test.'+crypto.randomUUID(),'--preserve-symlinks','--preserve-symlinks-main','--test','--test-isolation=none','isolation.cjs'],{windowsHide:true,timeout:70000},(error,stdout,stderr)=>resolve({error,stdout,stderr})));
  assert.equal(result.error,null,JSON.stringify(result));assert.match(result.stdout,/ISOLATION_OK/);assert.equal(escaped,false);assert.equal(await fs.readFile(outside,'utf8'),'private fixture');
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(base,{recursive:true,force:true})}
});
