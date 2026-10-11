import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {projectPath} from './filesystem.mjs';
const resources=process.env.NEXO_DESKTOP==='1'?path.dirname(process.execPath):fileURLToPath(new URL('../../src-tauri/resources/',import.meta.url));
const definitions={node:{name:'Node',file:'node.exe'},python:{name:'Python 3.13',file:'python/python.exe'},lua:{name:'Lua 5.4',file:'nexo-lua-tests.exe'},csharp:{name:'C# / .NET 10',file:'dotnet.exe'}};
export function executorPath(id,{dotnetRoot}={}){if(!definitions[id])throw Error('Executor não suportado.');if(id==='csharp'){if(!dotnetRoot)throw Error('Prepara o runtime C# em Definições.');return path.join(dotnetRoot,'dotnet.exe')}return path.join(resources,definitions[id].file)}
export async function executorIdentity(id,options={}){
 const file=executorPath(id,options);let bytes;try{bytes=await fs.readFile(file)}catch{throw Error(id==='csharp'?'Prepara o runtime C# em Definições.':`${definitions[id].name} não está incluído nesta instalação. Repara a aplicação com o instalador.`)}
 const hash=crypto.createHash('sha256').update(bytes);
 if(id==='python'||id==='csharp'){
  const folder=path.dirname(file),manifest=await fs.readFile(path.join(folder,'nexo-runtime.json'),'utf8');hash.update(manifest);
  for(const [name,expected] of Object.entries(JSON.parse(manifest).hashes)){
   if(!/^[a-zA-Z0-9_./-]+$/.test(name)||name.includes('..')||path.isAbsolute(name))throw Error('Manifesto de runtime inválido.');const b=await fs.readFile(path.join(folder,name));
   if(crypto.createHash('sha256').update(b).digest('hex')!==expected)throw Error('Runtime alterado. Repara a instalação.');hash.update(name);hash.update(b);
  }
 }
 return {runtime:id,runtimeName:definitions[id].name,runtimeFingerprint:hash.digest('hex')};
}
export async function executorStatus(options={}){return Promise.all(Object.entries(definitions).map(async([id,d])=>{try{await executorIdentity(id,options);return {id,name:d.name,available:true,network:false}}catch(e){return {id,name:d.name,available:false,reason:e.message}}}))}
export async function parseNonNode(project,tokens,options={}){
 let runtime,args,testPaths;
 if(tokens[0]==='python'){
  if(tokens[1]!=='-m'||tokens[2]!=='unittest'||tokens[3]!=='discover')throw Error('Python exige testes unittest discover; scripts e pip não são comandos de validação autorizados.');
  let folder='.',pattern='test*.py';const seen=new Set();
  for(let i=4;i<tokens.length;i+=2){const flag=tokens[i],value=tokens[i+1];if(!['-s','-p'].includes(flag)||seen.has(flag)||!value)throw Error('Opções de teste Python inválidas.');seen.add(flag);if(flag==='-s')folder=value;else pattern=value}
  if(!/^[a-zA-Z0-9_.*-]+\.py$/.test(pattern)||pattern.includes('..'))throw Error('Padrão de testes inválido.');
  if(folder!=='.'&&(!/^[a-zA-Z0-9_ /.-]+$/.test(folder)||folder.split('/').some(p=>p==='..'||p==='.'||!p)))throw Error('Pasta de testes inválida.');
  await projectPath(project,folder);
  runtime='python';args=['-I','-B','-m','unittest','discover','-s',folder,'-p',pattern,'-t','.'];testPaths=[folder==='.'?pattern:folder+'/'+pattern];
 }else if(tokens[0]==='lua'){
  if(tokens.length!==2||!tokens[1].endsWith('.lua')||tokens[1].startsWith('-'))throw Error('Lua exige um ficheiro de testes .lua.');
  await projectPath(project,tokens[1]);runtime='lua';args=[tokens[1]];testPaths=[tokens[1]];
 }else if(tokens[0]==='csharp'){
  const folder=tokens[2]||'tests';if(tokens[1]!=='test'||tokens.length>3||!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(folder)||folder.includes('..'))throw Error('Usa csharp test tests, com uma pasta ou ficheiro de testes dentro do projeto.');
  await projectPath(project,folder);runtime='csharp';args=['test',folder];testPaths=[folder];
 }else return null;
 return {...await executorIdentity(runtime,options),arguments:args,testPaths};
}
export function countTests(runtime,stdout,stderr){
 if(runtime==='csharp')return Number((stderr.match(/^NEXO_CSHARP_TESTS=(\d+) FAILED=\d+$/m)||[])[1]||0);
 if(runtime==='python')return Number((stderr.match(/^Ran (\d+) tests? in /m)||[])[1]||0);
 if(runtime==='lua')return Number((stderr.match(/^NEXO_LUA_TESTS=(\d+) FAILED=\d+$/m)||[])[1]||0);
 return Number((stdout.match(/^# tests (\d+)$/m)||[])[1]||0);
}
