import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {projectPath} from './filesystem.mjs';
export async function prepareCsharp(project,runtime,testPath,dependencies=[]){
 const manifest=JSON.parse(await fs.readFile(path.join(runtime,'nexo-runtime.json'),'utf8'));
 const stage=await projectPath(project,'.nexo/csharp');await fs.mkdir(stage,{recursive:true});
 const runner=await fs.readFile(fileURLToPath(new URL('../runners/csharp-tests.cs',import.meta.url)),'utf8');await fs.writeFile(await projectPath(project,'.nexo/csharp/runner.cs'),runner);
 const sources=[],tests=[];async function visit(relative='.'){
  for(const item of await fs.readdir(await projectPath(project,relative),{withFileTypes:true})){if(['.nexo','.git','node_modules','bin','obj'].includes(item.name))continue;const rel=relative==='.'?item.name:relative+'/'+item.name;if(item.isSymbolicLink())throw Error('Ligação simbólica em projeto C#.');if(item.isDirectory())await visit(rel);else if(item.name.endsWith('.cs')){(rel===testPath||rel.startsWith(testPath+'/')?tests:sources).push(rel);if(sources.length+tests.length>1000)throw Error('Projeto C# demasiado grande.');}}
 }
 await visit();if(!tests.length)throw Error('Não existem ficheiros C# no caminho de testes autorizado.');
 const refs=path.join(runtime,'packs/Microsoft.NETCore.App.Ref',manifest.refVersion,'ref/net10.0');
 for(const file of dependencies){const relative=path.relative(project,file).replaceAll('\\','/');await projectPath(project,relative);await fs.copyFile(file,await projectPath(project,'.nexo/csharp/'+path.basename(file)));}
 const common=['/nologo','/nostdlib+',...dependencies.map(file=>'/reference:"'+file+'"'),...(await fs.readdir(refs)).filter(n=>n.endsWith('.dll')).map(n=>'/reference:"'+path.join(refs,n)+'"')];
 const compiler=['exec',path.join(runtime,'sdk',manifest.version,'Roslyn/bincore/csc.dll')],compile=[];
 if(sources.length){await fs.writeFile(await projectPath(project,'.nexo/csharp/implementation.rsp'),[...common,'/target:library','/out:.nexo/csharp/implementation.dll',...sources.map(n=>'"'+n+'"')].join('\n'));compile.push([...compiler,'@.nexo/csharp/implementation.rsp']);}
 const argumentsList=[...common,'/target:exe','/main:NexoRunner','/out:.nexo/csharp/checks.dll',...(sources.length?['/reference:.nexo/csharp/implementation.dll']:[]),...tests.map(n=>'"'+n+'"'),'".nexo/csharp/runner.cs"'];
 await fs.writeFile(await projectPath(project,'.nexo/csharp/compile.rsp'),argumentsList.join('\n'));
 await fs.writeFile(await projectPath(project,'.nexo/csharp/checks.runtimeconfig.json'),JSON.stringify({runtimeOptions:{tfm:'net10.0',framework:{name:'Microsoft.NETCore.App',version:'10.0.0'}}}));
 compile.push([...compiler,'@.nexo/csharp/compile.rsp']);return {compile,test:['.nexo/csharp/checks.dll']};
}
