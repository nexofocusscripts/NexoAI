import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {projectPath} from './filesystem.mjs';
const helper=process.env.NEXO_SANDBOX_EXE||fileURLToPath(new URL('../../src-tauri/resources/nexo-sandbox.exe',import.meta.url));
const node=process.env.NEXO_DESKTOP==='1'?process.execPath:fileURLToPath(new URL('../../src-tauri/resources/node.exe',import.meta.url));
export async function testCommand(project,command){
 if(typeof command!=='string'||command.length>2000||/[\r\n;&|<>`$]/.test(command))throw Error('Comando de teste não permitido.');
 let text=command.trim();
 if(text==='npm test'){
  const manifest=JSON.parse(await fs.readFile(await projectPath(project,'package.json'),'utf8'));text=manifest.scripts?.test||'';
 }
 if(!/^node\s+--(?:test|check)(?:\s|$)/.test(text))throw Error('Neste runtime, apenas testes e verificações Node são executáveis.');
 const tokens=text.match(/"[^"]*"|'[^']*'|[^\s]+/g)||[];
 const args=tokens.slice(1).map(x=>x.replace(/^("|')(.*)\1$/,'$2'));
 const mode=args.shift();if(!['--test','--check'].includes(mode))throw Error('Teste inválido.');
 if(args.some(arg=>arg.startsWith('-')))throw Error('Flags adicionais de execução são bloqueadas.');
 for(const argument of args){if(!argument||/[\x00-\x1f:]/.test(argument)||argument.includes('..')||argument.includes('\\')||path.isAbsolute(argument))throw Error('Caminho de teste inválido.');await projectPath(project,argument)}
 return {requested:command,executable:'Node incluído no Nexo AI',arguments:['--preserve-symlinks','--preserve-symlinks-main',mode,...(mode==='--test'?['--test-isolation=none','--test-reporter=tap']:[]),...args],sandbox:'Windows AppContainer',network:false,timeoutSeconds:60,memoryMb:1536};
}
export function sandboxService(){const grants=new Map();return {
 async prepare(project,command){const preview=await testCommand(project,command),id=crypto.randomUUID();grants.set(id,{project,preview,expires:Date.now()+600000});return {id,...preview}},
 async execute(project,command,id){const approval=grants.get(id);grants.delete(id);if(!approval||approval.expires<Date.now()||approval.project!==project||approval.preview.requested!==command)throw Error('Autorização de teste inválida ou expirada.');const current=await testCommand(project,command);if(JSON.stringify(current)!==JSON.stringify(approval.preview))throw Error('O comando mudou desde a revisão. Revê a autorização.');
  return new Promise(resolve=>execFile(helper,[project,node,'NexoAI.Test.'+crypto.randomUUID(),...current.arguments],{windowsHide:true,timeout:70000,maxBuffer:524288,env:{SystemRoot:process.env.SystemRoot,LOCALAPPDATA:process.env.LOCALAPPDATA,APPDATA:process.env.APPDATA,USERPROFILE:process.env.USERPROFILE,ProgramData:process.env.ProgramData,SystemDrive:process.env.SystemDrive,windir:process.env.windir}},(error,stdout,stderr)=>resolve({ok:!error,testCount:Number(stdout.match(/^# tests (\d+)$/m)?.[1]||0),code:error?.code??0,stdout:stdout.slice(-12000),stderr:stderr.slice(-12000),sandbox:current.sandbox,network:false})))
 }
 }}
