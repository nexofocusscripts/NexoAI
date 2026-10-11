import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {projectPath} from './filesystem.mjs';
import {parseNonNode,executorPath,countTests} from './test-executors.mjs';
import {prepareCsharp} from './csharp-tests.mjs';
const helper=process.env.NEXO_SANDBOX_EXE||fileURLToPath(new URL('../../src-tauri/resources/nexo-sandbox.exe',import.meta.url));
const node=process.env.NEXO_DESKTOP==='1'?process.execPath:fileURLToPath(new URL('../../src-tauri/resources/node.exe',import.meta.url));
export async function testCommand(project,command,options={}){
 if(typeof command!=='string'||command.length>2000||/[\r\n;&|<>`$]/.test(command))throw Error('Comando de teste não permitido.');
 let text=command.trim();
 if(text==='npm test'){
  const manifest=JSON.parse(await fs.readFile(await projectPath(project,'package.json'),'utf8'));text=manifest.scripts?.test||'';
 }
 const tokens=text.match(/"[^"]*"|'[^']*'|[^\s]+/g)||[];
 const normalized=tokens.map(x=>x.replace(/^("|')(.*)\1$/,'$2'));
 const other=await parseNonNode(project,normalized,options);
 if(other)return {requested:command,executable:other.runtimeName+' gerido pelo Nexo AI',...other,sandbox:'Windows AppContainer',network:false,timeoutSeconds:other.runtime==='csharp'?180:60,memoryMb:1536,...(other.runtime==='csharp'?{steps:['Compilar ficheiros C# de implementação numa biblioteca local.','Compilar apenas os testes autorizados com o executor Nexo.','Executar os testes NexoTest da pasta ou ficheiro autorizado.'],dependencies:'Biblioteca padrão .NET 10; sem NuGet, MSBuild ou rede.'}:{})};
 if(!/^node\s+--(?:test|check)(?:\s|$)/.test(text))throw Error('Comando não suportado. Usa testes Node, Python unittest ou Lua.');
 const args=tokens.slice(1).map(x=>x.replace(/^("|')(.*)\1$/,'$2'));
 const mode=args.shift();if(!['--test','--check'].includes(mode))throw Error('Teste inválido.');
 if(args.some(arg=>arg.startsWith('-')))throw Error('Flags adicionais de execução são bloqueadas.');
 for(const argument of args){if(!argument||/[\x00-\x1f:]/.test(argument)||argument.includes('..')||argument.includes('\\')||path.isAbsolute(argument))throw Error('Caminho de teste inválido.');await projectPath(project,argument)}
 return {requested:command,executable:'Node incluído no Nexo AI',arguments:['--preserve-symlinks','--preserve-symlinks-main',mode,...(mode==='--test'?['--test-isolation=none','--test-reporter=tap']:[]),...args],sandbox:'Windows AppContainer',network:false,timeoutSeconds:60,memoryMb:1536};
}
export function sandboxService(options={}){const grants=new Map();return {
 async prepare(project,command){const preview=await testCommand(project,command,options),id=crypto.randomUUID();grants.set(id,{project,preview,expires:Date.now()+600000});return {id,...preview}},
 async execute(project,command,id){const approval=grants.get(id);grants.delete(id);if(!approval||approval.expires<Date.now()||approval.project!==project||approval.preview.requested!==command)throw Error('Autorização de teste inválida ou expirada.');const current=await testCommand(project,command,options);if(JSON.stringify(current)!==JSON.stringify(approval.preview))throw Error('O comando mudou desde a revisão. Revê a autorização.');
  const executable=current.runtime?executorPath(current.runtime,options):node;
  const run=args=>new Promise(resolve=>execFile(helper,[project,executable,'NexoAI.Test.'+crypto.randomUUID(),...args],{windowsHide:true,timeout:70000,maxBuffer:524288,env:{SystemRoot:process.env.SystemRoot,LOCALAPPDATA:process.env.LOCALAPPDATA,APPDATA:process.env.APPDATA,USERPROFILE:process.env.USERPROFILE,ProgramData:process.env.ProgramData,SystemDrive:process.env.SystemDrive,windir:process.env.windir}},(error,stdout,stderr)=>resolve({ok:!error,testCount:countTests(current.runtime||'node',stdout,stderr),runtime:current.runtime||'node',code:error?.code??0,stdout:stdout.slice(-12000),stderr:stderr.slice(-12000),sandbox:current.sandbox,network:false})));
  if(current.runtime==='csharp'){const steps=await prepareCsharp(project,options.dotnetRoot,current.testPaths[0]),compiled=[];for(const args of steps.compile){const result=await run(args);if(!result.ok)return result;compiled.push({ok:true,stdout:result.stdout,stderr:result.stderr})}const result=await run(steps.test);return {...result,compile:compiled}}
  return run(current.arguments);
 }
 }}
