import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import net from 'node:net';
import {testCommand,sandboxService} from '../src/modules/sandbox.mjs';
import {sealTests,guardTests} from '../src/modules/test-integrity.mjs';
import {projectDigest,validationService} from '../src/modules/validation.mjs';
test('Python executes behavioral tests, denies outside files/network and keeps approved tests immutable',{skip:process.platform!=='win32',timeout:75000},async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-python-')),root=path.join(base,'project');await fs.mkdir(root);const privateFile=path.join(base,'private.txt');await fs.writeFile(privateFile,'private');let connected=false;const server=net.createServer(s=>{connected=true;s.destroy()});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 await fs.writeFile(path.join(root,'maths.py'),'def add(a,b):\n    return a+b\n');
 await fs.writeFile(path.join(root,'test_maths.py'),`import unittest, socket\nfrom maths import add\nclass Checks(unittest.TestCase):\n    def test_behavior(self):\n        self.assertEqual(add(2,3),5)\n    def test_files(self):\n        with self.assertRaises(OSError):\n            open(${JSON.stringify(privateFile)}).read()\n        with self.assertRaises(OSError):\n            open(${JSON.stringify(privateFile)},'w')\n    def test_network(self):\n        with self.assertRaises(OSError):\n            socket.create_connection(('127.0.0.1',${server.address().port}),timeout=2)\n`);
 try{
  const command='python -m unittest discover',service=sandboxService(),plan=await service.prepare(root,command);assert.equal(plan.runtime,'python');const sealed=await sealTests(root,[plan]);assert.ok(sealed['test_maths.py']);await assert.rejects(()=>guardTests(root,sealed,[{type:'write',path:'test_maths.py',content:'pass'}]),/alterar/);
  const before=await projectDigest(root),result=await service.execute(root,command,plan.id);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.testCount,3);assert.equal(connected,false);assert.equal(await fs.readFile(privateFile,'utf8'),'private');const proof=await validationService(base).record('A',root,command,before,result);assert.equal(proof.ok,true);await assert.rejects(()=>service.execute(root,command,plan.id),/Autorização/);
  await fs.writeFile(path.join(root,'maths.py'),'def add(a,b):\n    return a-b\n');const retry=await service.prepare(root,command);const failed=await service.execute(root,command,retry.id);assert.equal(failed.ok,false);assert.equal(failed.testCount,3);
 }finally{await new Promise(r=>server.close(r));await fs.rm(base,{recursive:true,force:true})}
});
test('Lua runner requires real tests, reports failures and denies private files',{skip:process.platform!=='win32',timeout:75000},async()=>{
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-lua-')),root=path.join(base,'project');await fs.mkdir(root);const outside=path.join(base,'private.txt');await fs.writeFile(outside,'private');const command='lua checks.lua',service=sandboxService();
 try{
  await fs.writeFile(path.join(root,'maths.lua'),'return {add=function(a,b) return a+b end}');await fs.writeFile(path.join(root,'checks.lua'),`local m=require('maths')\ntest('addition',function() assert(m.add(2,3)==5) end)\ntest('private',function() assert(io.open(${JSON.stringify(outside).replaceAll('\\\\','/')},'r')==nil) end)\n`);
  const p=await service.prepare(root,command),sealed=await sealTests(root,[p]);assert.ok(sealed['checks.lua']);const before=await projectDigest(root),r=await service.execute(root,command,p.id);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.testCount,2);assert.equal((await validationService(base).record('A',root,command,before,r)).ok,true);
  await fs.writeFile(path.join(root,'maths.lua'),'return {add=function(a,b) return a-b end}');const f=await service.prepare(root,command);assert.equal((await service.execute(root,command,f.id)).ok,false);
  await fs.writeFile(path.join(root,'checks.lua'),'print("no real tests")');const z=await service.prepare(root,command);const zero=await service.execute(root,command,z.id);assert.equal(zero.ok,false);assert.equal(zero.testCount,0);
 }finally{await fs.rm(base,{recursive:true,force:true})}
});
test('executor command grammar denies shell, arbitrary scripts, downloads and escaping paths',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-grammar-'));try{for(const cmd of ['python script.py','python -m pip install x','python -m unittest discover -s ../private','python -m unittest discover -p ../../x.py','python -m unittest discover -s tests -s other','lua ../outside.lua','lua -e print(1)','python -m unittest discover; echo bad'])await assert.rejects(()=>testCommand(root,cmd));}finally{await fs.rm(root,{recursive:true,force:true})}
});
