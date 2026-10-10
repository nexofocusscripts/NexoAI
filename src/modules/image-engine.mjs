import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {unzipSync} from 'fflate';
import {verifiedDownload} from './download.mjs';
import {readJson,writeJson} from './store.mjs';
import {requireSpace} from './storage.mjs';
const release='https://github.com/leejet/stable-diffusion.cpp/releases/download/master-951-f89d9b1/';
const assets={
 cpu:{name:'Motor CPU',url:release+'sd-master-f89d9b1-bin-win-cpu-x64.zip',bytes:17536557,sha256:'7c46bc1f4e89b22af9dd70e8d510dea2167c619676d23d313b83deffcd9b1ecc'},
 vulkan:{name:'Motor GPU Vulkan',url:release+'sd-master-f89d9b1-bin-win-vulkan-x64.zip',bytes:30117011,sha256:'2c5bed22585ff678ff2c9077f5088d55c2d9c0faa948db7f2e689e1ccea701a9'},
 model:{name:'Stable Diffusion 1.5',url:'https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/451f4fe16113bff5a5d2269ed5ad43b0592e9a14/v1-5-pruned-emaonly.safetensors',bytes:4265146304,sha256:'6ce0161689b3853acaa03779ec93eafe75a02f4ced659bee03f50797806fa2fa'}
};
export function imageEngine(data){
 const base=path.join(data,'image-engine'),manifest=path.join(base,'installed.json'),jobs=new Map(),plans=new Map();
 const job=(kind,operation)=>{if([...jobs.values()].some(j=>j.state.status==='running'))throw Error('Aguarda a operação de imagens em curso.');const abort=new AbortController(),state={id:crypto.randomUUID(),kind,target:'Imagens locais',status:'running',createdAt:new Date().toISOString()};jobs.set(state.id,{state,abort});Promise.resolve().then(()=>operation(state,abort.signal)).then(()=>{state.status='completed'}).catch(e=>{state.status=abort.signal.aborted?'cancelled':'failed';state.error=e.message});return {...state}};
 async function extract(zip,folder){
  const entries=unzipSync(await fs.readFile(zip));let bytes=0,executable;
  for(const [name,content] of Object.entries(entries)){
   if(name.endsWith('/'))continue;
   if(name.includes('..')||name.includes('\\')||name.includes(':')||name.startsWith('/'))throw Error('Distribuição contém caminhos inválidos.');
   bytes+=content.length;if(bytes>200000000)throw Error('Distribuição demasiado grande.');
   const target=path.join(folder,name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content);if(path.basename(name)==='sd-cli.exe')executable=target;
  }
  if(!executable)throw Error('Motor de imagens não encontrado na distribuição.');return executable;
 }
 const invoke=(executable,args,signal)=>new Promise((resolve,reject)=>{const child=spawn(executable,args,{cwd:path.dirname(executable),windowsHide:true,stdio:['ignore','pipe','pipe'],signal,env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH,LOCALAPPDATA:process.env.LOCALAPPDATA,TEMP:process.env.TEMP}});let output='';const timer=setTimeout(()=>child.kill(),600000);for(const stream of [child.stdout,child.stderr])stream.on('data',c=>{output=(output+c).slice(-16000)});child.on('error',e=>{clearTimeout(timer);reject(e)});child.on('exit',code=>{clearTimeout(timer);code===0?resolve(output):reject(Error('O motor de imagens falhou. '+output.slice(-1500)))})});
 return {
  async status(){const installed=await readJson(manifest,null);if(!installed)return {available:false,provider:'stable-diffusion.cpp'};try{await fs.access(installed.executable);await fs.access(installed.model);return {available:true,provider:'stable-diffusion.cpp',model:'Stable Diffusion 1.5',backend:installed.backend}}catch{return {available:false,provider:'stable-diffusion.cpp',repairRequired:true}}},
  async gallery(){const folder=path.join(base,'outputs');let entries;try{entries=await fs.readdir(folder)}catch(e){if(e.code==='ENOENT')return [];throw e}const files=await Promise.all(entries.filter(n=>/^[a-f0-9-]{36}\.png$/.test(n)).map(async name=>({name,stat:await fs.stat(path.join(folder,name))})));return Promise.all(files.filter(f=>f.stat.isFile()&&f.stat.size<8000000).sort((a,b)=>b.stat.mtimeMs-a.stat.mtimeMs).slice(0,20).map(async f=>({id:f.name.slice(0,-4),file:f.name,image:'data:image/png;base64,'+(await fs.readFile(path.join(folder,f.name))).toString('base64')})))},
  prepare(hardware){const backend=hardware.gpu?.length?'vulkan':'cpu',downloads=[assets[backend],...(backend==='vulkan'?[assets.cpu]:[]),assets.model];const plan={id:crypto.randomUUID(),backend,downloads,bytes:downloads.reduce((n,a)=>n+a.bytes,0),license:'CreativeML OpenRAIL M',licenseUrl:'https://huggingface.co/spaces/CompVis/stable-diffusion-license',dataSent:'Downloads do motor e modelo. Os pedidos e imagens ficam locais.',expires:Date.now()+600000};plans.set(plan.id,plan);return plan},
  install(id){const plan=plans.get(id);plans.delete(id);if(!plan||plan.expires<Date.now())throw Error('Plano expirado.');return job('image.install',async(state,signal)=>{
   await requireSpace(base,plan.bytes+200000000);
   const executables={};for(const backend of [...new Set([plan.backend,'cpu'])]){const zip=path.join(base,backend+'.zip');await verifiedDownload(assets[backend],zip,{signal,progress:p=>{state.progress={stage:assets[backend].name,...p}}});executables[backend]=await extract(zip,path.join(base,backend));}
   const model=path.join(base,'sd15.safetensors');await verifiedDownload(assets.model,model,{signal,progress:p=>{state.progress={stage:assets.model.name,...p}}});await writeJson(manifest,{backend:plan.backend,executable:executables[plan.backend],cpu:executables.cpu,model,version:'master-951-f89d9b1'});
  })},
  generate({prompt,negativePrompt='',steps=20,width=512,height=512,seed=-1}){if(typeof prompt!=='string'||!prompt.trim()||prompt.length>8000)throw Error('Pedido de imagem inválido.');if(![256,512,768].includes(width)||![256,512,768].includes(height)||!Number.isInteger(steps)||steps<1||steps>50||!Number.isInteger(seed))throw Error('Opções de imagem inválidas.');return job('image.generate',async(state,signal)=>{
   const installed=await readJson(manifest,null);if(!installed)throw Error('Instala primeiro o motor de imagens local.');await fs.mkdir(path.join(base,'outputs'),{recursive:true});const output=path.join(base,'outputs',state.id+'.png'),args=['-m',installed.model,'-p',prompt,'-n',String(negativePrompt),'-W',String(width),'-H',String(height),'--steps',String(steps),'-s',String(seed),'-o',output];state.progress={stage:'A gerar no computador'};
   try{await invoke(installed.executable,args,signal)}catch(error){if(installed.backend==='cpu'||signal.aborted)throw error;state.progress={stage:'GPU indisponível: a tentar CPU'};await invoke(installed.cpu,args,signal)}
   const content=await fs.readFile(output);if(!content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('O motor não devolveu uma imagem PNG válida.');state.image='data:image/png;base64,'+content.toString('base64');state.file=path.basename(output);state.progress={stage:'Imagem criada'};
  })},
  async remove(){if([...jobs.values()].some(j=>j.state.status==='running'))throw Error('Aguarda a operação atual.');await fs.rm(path.join(base,'sd15.safetensors'),{force:true});await fs.rm(manifest,{force:true});return {ok:true}},
  jobs(){return [...jobs.values()].map(j=>({...j.state}))},
  cancel(id){const entry=jobs.get(id);if(!entry||entry.state.status!=='running')throw Error('Operação não encontrada.');entry.abort.abort();return {ok:true}},
  stop(){for(const entry of jobs.values())entry.abort.abort()}
 };
}
