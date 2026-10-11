import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import {sandboxService} from '../src/modules/sandbox.mjs';import {executionGuide} from '../src/modules/execution-guide.mjs';
test('runtime tampering after approval prevents execution and consumes the old authorization',async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-executor-approval-')),runtime=path.join(data,'dotnet'),project=path.join(data,'project');await fs.mkdir(runtime);await fs.mkdir(project);const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 try{await fs.writeFile(path.join(runtime,'dotnet.exe'),'not an executable');await fs.writeFile(path.join(runtime,'library.dll'),'original');await fs.writeFile(path.join(runtime,'nexo-runtime.json'),JSON.stringify({hashes:{'dotnet.exe':hash('not an executable'),'library.dll':hash('original')}}));const service=sandboxService({dotnetRoot:runtime}),plan=await service.prepare(project,'csharp test tests');await fs.writeFile(path.join(runtime,'library.dll'),'changed');await assert.rejects(()=>service.execute(project,'csharp test tests',plan.id),/Runtime alterado/);await assert.rejects(()=>service.execute(project,'csharp test tests',plan.id),/Autorização/)}finally{await fs.rm(data,{recursive:true,force:true})}
});
test('automatic C# choice follows existing source files and fails honestly when its runtime is missing',async()=>{
 await assert.rejects(()=>executionGuide({files:[{path:'Program.cs'}]}),/runtime C#/);await assert.rejects(()=>executionGuide({prompt:'Cria um módulo Rust'}),/dessa linguagem/);await assert.rejects(()=>executionGuide({executor:'shell'}),/inválida/);
});
