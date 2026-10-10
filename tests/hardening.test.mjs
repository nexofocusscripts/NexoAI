import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Readable} from 'node:stream';
import {safeName,inside} from '../src/core.mjs';
import {projectPath} from '../src/modules/filesystem.mjs';
import {requestGuard,readBody} from '../src/modules/request-security.mjs';
import {importProject} from '../src/modules/backup.mjs';
test('project names cannot address parent or Windows devices',()=>{for(const name of ['.','..','CON','nul.txt','COM1','LPT9'])assert.throws(()=>safeName(name));});
test('file paths reject absolute, ADS and Windows traversal',()=>{for(const name of ['../outside','C:/outside','file:stream','..\\outside','/outside','file\0'])assert.throws(()=>inside(os.tmpdir(),name));});
test('junction cannot escape project',async()=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-links-')),project=path.join(base,'project'),outside=path.join(base,'outside');
  await fs.mkdir(project);await fs.mkdir(outside);
  try{await fs.symlink(outside,path.join(project,'link'),'junction');await assert.rejects(()=>projectPath(project,'link/private.txt'),/bloquead/);await assert.rejects(()=>projectPath(path.join(project,'link'),'.'),/bloquead/);}
  finally{await fs.rm(base,{recursive:true,force:true});}
});
test('browser requests require local host, origin and JSON',()=>{
  const valid={method:'POST',headers:{host:'127.0.0.1:4170',origin:'http://127.0.0.1:4170','content-type':'application/json'}};
  assert.equal(requestGuard(valid,'127.0.0.1:4170'),null);
  for(const headers of [{host:'attacker.test'},{origin:'https://attacker.test'},{'sec-fetch-site':'cross-site'},{'content-type':'text/plain'}])assert.ok(requestGuard({...valid,headers:{...valid.headers,...headers}},'127.0.0.1:4170'));
});
test('oversized and malformed bodies are rejected',async()=>{await assert.rejects(()=>readBody(Readable.from([Buffer.alloc(9)]),8),e=>e.status===413);await assert.rejects(()=>readBody(Readable.from([Buffer.from('{')])),e=>e.status===400);});
test('invalid backup is rejected before partial writes',async()=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-backup-'));
  try{await assert.rejects(()=>importProject(base,{format:'nexo-project-v1',files:{'ok.txt':'b2s=','../escape':'b2s='}}));await assert.rejects(()=>fs.stat(path.join(base,'ok.txt')),e=>e.code==='ENOENT');}
  finally{await fs.rm(base,{recursive:true,force:true});}
});
