import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {unzipSync} from 'fflate';
import {projectPath} from './filesystem.mjs';import {readJson,writeJson} from './store.mjs';
const catalog=JSON.parse(await fs.readFile(fileURLToPath(new URL('../../config/test-dependencies.json',import.meta.url)),'utf8'));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const relative=id=>'vendor/nexo/'+id;
const manifest='vendor/nexo/dependencies.json';
export function projectDependencies(data,{fetcher=fetch,packages=catalog}={}){
 const plans=new Map(),running=new Map(),jobs=new Map();
 const find=id=>{const pkg=packages.find(p=>p.id===id);if(!pkg)throw Error('Biblioteca fora do catálogo verificado.');return pkg;};
 async function installed(project){return readJson(await projectPath(project,manifest),[]);}
 async function identity(project){const entries=await installed(project),pythonPaths=[],references=[],hash=crypto.createHash('sha256');
  if(!Array.isArray(entries)||entries.length>20)throw Error('Manifesto de bibliotecas inválido.');
  for(const entry of entries){const pkg=find(entry.id);if(entry.sha256!==pkg.sha256||entry.version!==pkg.version||!entry.files||Object.keys(entry.files).length>1000)throw Error('Biblioteca alterada. Revê a sua preparação.');hash.update(JSON.stringify(entry));
   const pinned=Object.fromEntries(Object.entries(pkg.hashes||{}).map(([name,sha])=>[relative(pkg.id)+'/'+name,sha]));
   if(!Object.keys(pinned).length||Object.keys(pinned).length!==Object.keys(entry.files).length)throw Error('Manifesto de biblioteca inválido.');
   for(const [name,expected]of Object.entries(entry.files)){if(!name.startsWith(relative(pkg.id)+'/')||name.includes('..')||!/^[a-f0-9]{64}$/.test(expected)||pinned[name]!==expected)throw Error('Manifesto de biblioteca inválido.');const file=await projectPath(project,name),stat=await fs.stat(file);if(stat.size>24000000)throw Error('Biblioteca demasiado grande.');const bytes=await fs.readFile(file);if(digest(bytes)!==expected)throw Error('Biblioteca alterada. Revê a sua preparação.');hash.update(name);hash.update(bytes);if(pkg.language==='csharp'&&name.endsWith('.dll'))references.push(file);}
   if(pkg.language==='python')pythonPaths.push(await projectPath(project,relative(pkg.id)));
  }
  return {pythonPaths,references,dependencyFingerprint:hash.digest('hex'),dependencies:entries.map(e=>({name:find(e.id).name,language:find(e.id).language,version:e.version,license:find(e.id).license}))};
 }
 async function install(project,pkg,signal){
  const cache=path.join(data,'dependency-downloads',pkg.sha256+'.zip');let bytes=await fs.readFile(cache).catch(()=>null);
  if(!bytes||digest(bytes)!==pkg.sha256){const response=await fetcher(pkg.url,{redirect:'error',signal});if(!response.ok)throw Error('Download de biblioteca HTTP '+response.status);const chunks=[];let count=0;for await(const chunk of response.body){count+=chunk.length;if(count>pkg.bytes)throw Error('Biblioteca excede o tamanho previsto.');chunks.push(chunk);}bytes=Buffer.concat(chunks);if(bytes.length!==pkg.bytes||digest(bytes)!==pkg.sha256)throw Error('Checksum da biblioteca inválido.');await fs.mkdir(path.dirname(cache),{recursive:true});await fs.writeFile(cache,bytes);}
  const selected={},entries=unzipSync(bytes);let expanded=0,count=0;
  for(const [name,content]of Object.entries(entries)){if(name.endsWith('/'))continue;if(++count>1000||((expanded+=content.length)>24000000))throw Error('Biblioteca demasiado grande.');if(name.includes('..')||name.includes('\\')||name.includes(':')||name.startsWith('/'))throw Error('Caminho inválido na biblioteca.');
   if(pkg.files){if(pkg.files[name])selected[pkg.files[name]]=content;}
   else {if(name.includes('.data/')||/\.(?:exe|dll|pyd|pth|bat|cmd|ps1)$/i.test(name))throw Error('A biblioteca Python contém componentes não suportados.');selected[name]=content;}
  }
  if(pkg.files&&Object.keys(selected).length!==Object.keys(pkg.files).length)throw Error('Biblioteca incompleta.');
  const files={};for(const [name,content]of Object.entries(selected)){const rel=relative(pkg.id)+'/'+name;files[rel]=digest(content);await projectPath(project,rel);}
  const stage=path.resolve(data,'dependency-staging',crypto.randomUUID()),backup=stage+'-previous',folder=await projectPath(project,relative(pkg.id));
  if(!stage.startsWith(path.resolve(data)+path.sep))throw Error('Preparação fora da pasta de dados.');
  await fs.mkdir(stage,{recursive:true});for(const [name,content]of Object.entries(selected)){const target=path.resolve(stage,name);if(!target.startsWith(stage+path.sep))throw Error('Ficheiro fora da preparação.');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content);}
  if(signal.aborted)throw Error('Preparação cancelada.');
  const previous=await installed(project);let moved=false,swapped=false;
  try{await fs.mkdir(path.dirname(folder),{recursive:true});if(await fs.stat(folder).catch(()=>null)){await fs.rename(folder,backup);moved=true;}await fs.rename(stage,folder);swapped=true;await writeJson(await projectPath(project,manifest),[...previous.filter(e=>e.id!==pkg.id),{id:pkg.id,version:pkg.version,sha256:pkg.sha256,files}]);}
  catch(error){if(swapped)await fs.rename(folder,stage);if(moved)await fs.rename(backup,folder);throw error;}
  return identity(project);
 }
 return {
  identity,
  async status(project){let error=null;try{await identity(project)}catch(e){error=e.message}const entries=await installed(project);return {catalog:packages,installed:Array.isArray(entries)?entries.map(e=>({id:e.id,version:e.version})):[],error,scope:'Catálogo verificado: Python puro e bibliotecas .NET geridas. Sem pip, scripts de instalação, NuGet restore ou dependências arbitrárias.'};},
  prepare(project,id,{onlineMode=false}={}){const pkg=find(id);if(!onlineMode)throw Error('Ativa o modo online para preparar bibliotecas.');if(running.has(project))throw Error('Aguarda a preparação atual.');const plan={id:crypto.randomUUID(),project,package:id,url:pkg.url,bytes:pkg.bytes,version:pkg.version,name:pkg.name,sha256:pkg.sha256,license:pkg.license,licenseUrl:pkg.licenseUrl,destination:relative(id),dataSent:'GET para o URL mostrado; o servidor recebe o endereço IP. Não são enviados ficheiros, chats ou chaves.',expiresAt:Date.now()+300000};plans.set(plan.id,plan);return plan;},
  start(project,id,{onlineMode=false}={}){const plan=plans.get(id);plans.delete(id);if(!onlineMode||!plan||plan.project!==project||plan.expiresAt<Date.now())throw Error('Preparação expirada ou modo online desativado.');if(running.has(project))throw Error('Aguarda a preparação atual.');const state={id:crypto.randomUUID(),kind:'dependency.install',target:plan.name,status:'running',createdAt:new Date().toISOString()},abort=new AbortController();jobs.set(state.id,{state,abort});running.set(project,state.id);install(project,find(plan.package),abort.signal).then(()=>{state.status='completed'}).catch(e=>{state.status=abort.signal.aborted?'cancelled':'failed';state.error=e.message}).finally(()=>{state.finishedAt=new Date().toISOString();running.delete(project)});return {...state};},
  active(project){return running.has(project)},jobs(){return [...jobs.values()].map(j=>({...j.state}))},cancel(id){const job=jobs.get(id);if(!job)throw Error('Preparação não encontrada.');job.abort.abort();return {ok:true}}
 };
}
