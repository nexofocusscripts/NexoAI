import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {unzipSync} from 'fflate';
import {verifiedDownload} from './download.mjs';import {requireSpace} from './storage.mjs';import {readJson,writeJson} from './store.mjs';
const asset=JSON.parse(await fs.readFile(fileURLToPath(new URL('../../config/csharp-runtime.json',import.meta.url)),'utf8'));
export function csharpRuntime(data){
 const directory=path.join(data,'test-runtimes','dotnet'),jobs=new Map(),plans=new Map();
 return {
  directory,
  async status(){const manifest=await readJson(path.join(directory,'nexo-runtime.json'),null);return {available:!!manifest,version:manifest?.version||asset.version,downloadBytes:asset.bytes,scope:'Testes C# com biblioteca padrão; sem NuGet, aplicações GUI ou servidor.'}},
  async prepare(){await requireSpace(data,asset.bytes+500000000);const id=crypto.randomUUID(),plan={id,version:asset.version,url:asset.url,bytes:asset.bytes,sha256:asset.sha256,network:true,scope:'Descarregar o SDK oficial e preparar o compilador e runtime C#. Não instala .NET no Windows, não envia projetos e não descarrega pacotes NuGet.'};plans.set(id,{expires:Date.now()+600000,plan});return plan},
  install(id){const entry=plans.get(id);plans.delete(id);if(!entry||entry.expires<Date.now())throw Error('Autorização expirada. Revê o download.');if([...jobs.values()].some(j=>j.state.status==='running'))throw Error('Já existe uma preparação C# em curso.');const abort=new AbortController(),state={id:crypto.randomUUID(),kind:'executor.install',target:'C# / .NET',status:'running',createdAt:new Date().toISOString()};jobs.set(state.id,{state,abort});
   void (async()=>{
    const cache=path.join(data,'test-runtimes','downloads','dotnet.zip');await verifiedDownload(asset,cache,{signal:abort.signal,progress:p=>Object.assign(state,p)});
    const bytes=await fs.readFile(cache);if(crypto.createHash('sha512').update(bytes).digest('hex')!==asset.sha512)throw Error('Checksum Microsoft inválido.');
    const stage=directory+'.stage-'+state.id;await fs.mkdir(stage,{recursive:true});let expanded=0,files=0;const hashes={};
    try{const entries=unzipSync(bytes,{filter:e=>e.name==='dotnet.exe'||e.name==='LICENSE.txt'||e.name==='ThirdPartyNotices.txt'||e.name.startsWith('host/fxr/')||e.name.startsWith('shared/Microsoft.NETCore.App/')||e.name.startsWith('packs/Microsoft.NETCore.App.Ref/')||e.name.startsWith('sdk/'+asset.version+'/Roslyn/bincore/')});
     for(const [name,b]of Object.entries(entries)){if(abort.signal.aborted)throw Error('Preparação cancelada.');if(name.endsWith('/'))continue;const target=path.resolve(stage,name);if(!target.startsWith(stage+path.sep)||name.includes('..')||name.includes('\\'))throw Error('Caminho de runtime inválido.');expanded+=b.length;if(expanded>500000000||++files>10000)throw Error('Runtime expandido demasiado grande.');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,b);hashes[name]=crypto.createHash('sha256').update(b).digest('hex');}
     if(!hashes['dotnet.exe'])throw Error('Runtime incompleto.');const refVersion=(await fs.readdir(path.join(stage,'packs/Microsoft.NETCore.App.Ref')))[0];await writeJson(path.join(stage,'nexo-runtime.json'),{version:asset.version,refVersion,hashes});
     if(await fs.stat(directory).catch(()=>null))throw Error('O runtime já está preparado.');await fs.rename(stage,directory);await fs.rm(cache,{force:true});state.status='completed';
    }finally{await fs.rm(stage,{recursive:true,force:true})}
   })().catch(e=>{state.status=abort.signal.aborted?'cancelled':'failed';state.error=e.message});return {...state};
  },
  jobs(){return [...jobs.values()].map(j=>({...j.state}))},cancel(id){const j=jobs.get(id);if(!j)throw Error('Operação não encontrada.');j.abort.abort();return {ok:true}}
 };
}
