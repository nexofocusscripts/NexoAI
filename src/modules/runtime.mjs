import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {requireSpace} from './storage.mjs';
const run=(exe,args,timeout=120000)=>new Promise((resolve,reject)=>execFile(exe,args,{windowsHide:true,timeout,maxBuffer:1048576},(error,stdout)=>error?reject(Error('Falha na operação do runtime.')):resolve(stdout)));
// The installer may start a background app. Wait for its own exit, not inherited pipes.
const runInstaller=(exe,args)=>new Promise((resolve,reject)=>{
 const child=spawn(exe,args,{windowsHide:true,stdio:'ignore'});const timer=setTimeout(()=>{child.kill();reject(Error('Instalação do runtime excedeu o tempo limite.'))},600000);
 child.on('error',error=>{clearTimeout(timer);reject(Error(`Não foi possível iniciar o instalador (${error.code}).`))});
 child.on('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(`O instalador terminou com código ${code}.`))});
});
const validModel=name=>{if(typeof name!=='string'||name.length>160||! /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(name))throw Error('Nome de modelo inválido.');return name};
export function runtimeService(data,{baseUrl='http://127.0.0.1:11434',fetcher=fetch}={}){
 const metadata=new Map();
 // Use the official per-user location: ROCm asset names exceed MAX_PATH when
 // installed below a deeply nested project or application data directory.
 const installDirectory=()=>{
  if(!process.env.LOCALAPPDATA)throw Error('Não foi possível localizar a pasta de aplicações do Windows.');
  const directory=path.join(process.env.LOCALAPPDATA,'Programs','Ollama');
  if(directory.length>110)throw Error('A pasta de aplicações do Windows é demasiado longa para instalar este runtime.');
  return directory;
 };
 const jobs=new Map(),plans=new Map();let owned=null;
 const request=async(route,options={})=>{const response=await fetcher(baseUrl+route,{signal:AbortSignal.timeout(600000),...options});if(!response.ok)throw Error(`Runtime HTTP ${response.status}`);return response};
 const job=(kind,target,operation)=>{const id=crypto.randomUUID(),abort=new AbortController(),state={id,kind,target,status:'running',progress:null,createdAt:new Date().toISOString()};jobs.set(id,{state,abort});Promise.resolve().then(()=>operation(state,abort.signal)).then(()=>{state.status='completed';state.finishedAt=new Date().toISOString()}).catch(error=>{state.status=abort.signal.aborted?'cancelled':'failed';state.error=error.message;state.finishedAt=new Date().toISOString()});return {...state}};
 return {
  async status(){try{const response=await fetcher(baseUrl+'/api/version',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error();const d=await response.json();return {provider:'ollama',available:true,version:d.version,local:true}}catch{return {provider:'ollama',available:false,local:true}}},
  async models(){const d=await(await request('/api/tags',{signal:AbortSignal.timeout(5000)})).json();return Promise.all((d.models||[]).map(async model=>{const key=model.digest||model.name;let info=metadata.get(key);if(!info){try{const value=await(await request('/api/show',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:model.name}),signal:AbortSignal.timeout(5000)})).json();info={capabilities:value.capabilities||[],details:value.details||model.details||{}};metadata.set(key,info)}catch{info={capabilities:model.capabilities||[],details:model.details||{}}}}return {...model,...info}}))},
  async chat(model,messages,options={}){validModel(model);const result=await(await request('/api/chat',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(options.timeoutMs||600000),body:JSON.stringify({model,messages,stream:false,...(options.schema?{format:options.schema}:{}),...(options.think===false?{think:false}:{}),options:{num_ctx:8192,num_predict:options.maxTokens||4096,temperature:options.temperature??0.2}})})).json();return {message:result.message?.content||'',model,usage:{promptTokens:result.prompt_eval_count,completionTokens:result.eval_count},durationNs:result.total_duration,evalDurationNs:result.eval_duration,loadDurationNs:result.load_duration}},
  async prepareInstall(){
   if(process.platform!=='win32')throw Error('Instalação automática disponível apenas no Windows.');
   const response=await fetcher('https://api.github.com/repos/ollama/ollama/releases/latest',{headers:{accept:'application/vnd.github+json','user-agent':'Nexo-AI'},signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error('Não foi possível consultar a distribuição oficial do Ollama.');
   const release=await response.json(),asset=release.assets.find(x=>x.name==='OllamaSetup.exe');
   if(!asset||!asset.digest?.startsWith('sha256:')||!asset.browser_download_url.startsWith('https://github.com/ollama/ollama/releases/download/'))throw Error('Distribuição oficial sem integridade verificável.');
   const plan={id:crypto.randomUUID(),provider:'ollama',version:release.tag_name,url:asset.browser_download_url,bytes:asset.size,sha256:asset.digest.slice(7),installationDirectory:installDirectory(),dataSent:'Pedido de download, sem chats ou ficheiros de projetos.',expiresAt:Date.now()+600000};plans.set(plan.id,plan);return plan;
  },
  install(id){const plan=plans.get(id);plans.delete(id);if(!plan||plan.expiresAt<Date.now())throw Error('Confirmação expirada. Revê o download novamente.');return job('runtime.install','ollama',async(state,signal)=>{
   const dir=path.join(data,'runtime');await fs.mkdir(dir,{recursive:true});const installer=path.join(dir,'OllamaSetup.exe'),partial=installer+'.partial';
   try{
    await requireSpace(dir,plan.bytes*3);
    await requireSpace(plan.installationDirectory,plan.bytes*2);
    const response=await fetcher(plan.url,{signal});if(!response.ok||!response.body)throw Error('Download do Ollama falhou.');
    const hash=crypto.createHash('sha256'),handle=await fs.open(partial,'w');let received=0;
    try{for await(const chunk of response.body){received+=chunk.length;if(received>plan.bytes+1048576)throw Error('Tamanho do download inválido.');hash.update(chunk);await handle.write(chunk);state.progress={received,total:plan.bytes};}}finally{await handle.close()}
    if(received!==plan.bytes||hash.digest('hex')!==plan.sha256)throw Error('Integridade do download inválida.');
    await fs.rename(partial,installer);
    const verifier=process.env.NEXO_SIGNATURE_EXE||fileURLToPath(new URL('../../src-tauri/resources/nexo-signature.exe',import.meta.url));
    const signature=JSON.parse(await run(verifier,[installer]));
    if(signature.status!=='Valid'||! /Ollama/i.test(signature.subject))throw Error('Assinatura do instalador Ollama não aprovada.');
    if(signal.aborted)throw Error('Instalação cancelada.');state.progress={stage:'installing'};
    const installDir=plan.installationDirectory;
    await runInstaller(installer,['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-',`/DIR=${installDir}`]);
    if(!(await this.status()).available){
     const executable=path.join(installDir,'ollama.exe');
     owned=spawn(executable,['serve'],{windowsHide:true,env:{...process.env,OLLAMA_HOST:'127.0.0.1:11434'},stdio:'ignore'});owned.on('error',()=>{});
     for(let i=0;i<40;i++){if((await this.status()).available)break;await new Promise(resolve=>setTimeout(resolve,500))}
    }
    if(!(await this.status()).available)throw Error('Ollama instalado mas ainda indisponível. Tenta reiniciar a aplicação.');
   }finally{await fs.rm(partial,{force:true});await fs.rm(installer,{force:true});}
  })},
  async startExisting(){
   if((await this.status()).available)return true;
   const candidates=[path.join(data,'runtimes','ollama','ollama.exe'),...(process.env.LOCALAPPDATA?[path.join(process.env.LOCALAPPDATA,'Programs','Ollama','ollama.exe')]:[])];
   for(const exe of candidates){try{await fs.access(exe);owned=spawn(exe,['serve'],{windowsHide:true,env:{...process.env,OLLAMA_HOST:'127.0.0.1:11434'},stdio:'ignore'});owned.on('error',()=>{});return true}catch{}}
   return false;
  },
  pull(name){validModel(name);return job('model.pull',name,async(state,signal)=>{
   const modelDirectory=process.env.OLLAMA_MODELS||path.join(process.env.USERPROFILE||data,'.ollama','models');
   await requireSpace(modelDirectory,1073741824);
   const response=await request('/api/pull',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:name,stream:true}),signal});
   let pending='';const decoder=new TextDecoder();
    for await(const chunk of response.body){pending+=decoder.decode(chunk,{stream:true});let offset;while((offset=pending.indexOf('\n'))>=0){const line=pending.slice(0,offset);pending=pending.slice(offset+1);if(!line.trim())continue;const event=JSON.parse(line);if(event.error)throw Error(event.error);if(Number.isFinite(event.total))await requireSpace(modelDirectory,Math.max(0,event.total-(event.completed||0)));state.progress={stage:event.status,received:event.completed,total:event.total};}}
  })},
  async remove(name){validModel(name);await request('/api/delete',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({model:name})});return {ok:true}},
  jobs(){return [...jobs.values()].map(x=>({...x.state}))},
  cancel(id){const entry=jobs.get(id);if(!entry||entry.state.status!=='running')throw Error('Operação não encontrada.');if(entry.state.progress?.stage==='installing')throw Error('A instalação já começou. Aguarda a conclusão.');entry.abort.abort();return {ok:true}},
  stop(){owned?.kill();for(const {abort} of jobs.values())abort.abort()}
 };
}
