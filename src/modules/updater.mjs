import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
const publicKeyFile=fileURLToPath(new URL('../../config/update-public.pem',import.meta.url));
export function verifyManifest(envelope,key){
 if(typeof envelope?.payload!=='string'||envelope.payload.length>20000||typeof envelope.signature!=='string'||!crypto.verify(null,Buffer.from(envelope.payload),key,Buffer.from(envelope.signature,'base64')))throw Error('Assinatura da atualização inválida.');
 const manifest=JSON.parse(envelope.payload);
 if(manifest.product!=='NexoAI'||!/^\d+\.\d+\.\d+$/.test(manifest.version)||manifest.dataSchema!==1||manifest.file!=='setup.exe'||! /^[a-f0-9]{64}$/.test(manifest.sha256)||!Number.isInteger(manifest.bytes)||manifest.bytes<1||manifest.bytes>100000000)throw Error('Manifesto de atualização inválido ou incompatível.');
 return manifest;
}
export async function checkUpdate(settings,current,{fetcher=fetch,publicKey}={}){
 const url=settings.updates?.manifestUrl;if(!url)return {configured:false,current};
 if(!settings.onlineMode)throw Error('Ativa o modo online para consultar atualizações.');
 if(new URL(url).protocol!=='https:')throw Error('Atualizações exigem HTTPS.');
 const response=await fetcher(url,{redirect:'error',headers:{accept:'application/json','user-agent':'NexoAI-Updater'},signal:AbortSignal.timeout(15000)});if(response.status===404)return {configured:false,current,available:false,reason:'O canal oficial ainda não foi publicado.'};if(!response.ok)throw Error(`Atualizações HTTP ${response.status}`);
 const chunks=[];let count=0;for await(const chunk of response.body){count+=chunk.length;if(count>30000)throw Error('Manifesto demasiado grande.');chunks.push(chunk)}const text=Buffer.concat(chunks).toString('utf8');
 const manifest=verifyManifest(JSON.parse(text),publicKey||await fs.readFile(publicKeyFile));
 return {configured:true,current,latest:manifest.version,available:compare(manifest.version,current)>0,notes:String(manifest.notes||''),packageUrl:manifest.packageUrl||'',packageBytes:manifest.packageBytes,packageSha256:manifest.packageSha256,signatureVerified:true};
}
function compare(a,b){const A=a.split('.').map(Number),B=b.split('.').map(Number);for(let i=0;i<3;i++)if(A[i]!==B[i])return A[i]-B[i];return 0}
async function treeHash(root){const hash=crypto.createHash('sha256');let count=0,bytes=0;async function walk(relative=''){for(const entry of (await fs.readdir(path.join(root,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.isSymbolicLink())throw Error('Recuperação contém uma ligação simbólica.');const rel=path.join(relative,entry.name);if(entry.isDirectory())await walk(rel);else if(entry.isFile()){const content=await fs.readFile(path.join(root,rel));bytes+=content.length;count++;if(bytes>1000000000||count>20000)throw Error('Recuperação demasiado grande.');hash.update(rel);hash.update(content)}}}await walk();return {hash:hash.digest('hex'),bytes,count}}
export function updateService(data,current='1.0.0',{publicKey}={}){
 const key=async()=>publicKey||fs.readFile(publicKeyFile);
 const base=path.join(data,'updates'),plans=new Map();
 return {
  async prepareLocal(file){
   if(typeof file!=='string'||path.extname(file).toLowerCase()!=='.nexoupdate')throw Error('Seleciona um pacote .nexoupdate.');
   const stat=await fs.stat(file);if(stat.size>110000000)throw Error('Pacote de atualização demasiado grande.');
   let entries=0;const archive=unzipSync(await fs.readFile(file),{filter:entry=>{entries++;if(entries>2||!['manifest.json','setup.exe'].includes(entry.name)||entry.originalSize>(entry.name==='manifest.json'?30000:100000000))throw Error('Entradas do pacote inválidas.');return true}}),names=Object.keys(archive);if(names.length!==2||!names.includes('manifest.json')||!names.includes('setup.exe')||archive['manifest.json'].length>30000||archive['setup.exe'].length>100000000)throw Error('Pacote de atualização inválido.');
   const envelope=JSON.parse(Buffer.from(archive['manifest.json']).toString('utf8')),manifest=verifyManifest(envelope,await key()),setup=archive['setup.exe'];
   if(setup.length!==manifest.bytes||crypto.createHash('sha256').update(setup).digest('hex')!==manifest.sha256)throw Error('Integridade do instalador inválida.');
   if(compare(manifest.version,current)<0)throw Error('Usa a recuperação guardada para regressar à versão anterior.');
   const id=crypto.randomUUID(),directory=path.join(base,'staged',id);await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'setup.exe'),setup);await fs.writeFile(path.join(directory,'manifest.json'),JSON.stringify(envelope));
   const plan={id,mode:'install',directory,rollback:path.join(base,'rollback'),version:manifest.version,current,bytes:manifest.bytes,sha256:manifest.sha256,expires:Date.now()+600000};plans.set(id,plan);return {...plan,signatureVerified:true};
  },
  async prepareRollback(){const directory=path.join(base,'rollback');try{await fs.access(path.join(directory,'app'))}catch{throw Error('Ainda não existe uma instalação anterior guardada para recuperar.')}const snapshot=await treeHash(path.join(directory,'app')),version=(await fs.readFile(path.join(directory,'version.txt'),'utf8')).trim();if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Versão de recuperação inválida.');const plan={id:crypto.randomUUID(),mode:'rollback',directory,rollback:directory,version,current,...snapshot,expires:Date.now()+600000};plans.set(plan.id,plan);return plan},
  async consume(id){const plan=plans.get(id);plans.delete(id);if(!plan||plan.expires<Date.now())throw Error('Autorização de atualização expirada.');if(plan.mode==='install'){const envelope=JSON.parse(await fs.readFile(path.join(plan.directory,'manifest.json'),'utf8')),manifest=verifyManifest(envelope,await key()),setup=await fs.readFile(path.join(plan.directory,'setup.exe'));if(manifest.sha256!==plan.sha256||setup.length!==plan.bytes||crypto.createHash('sha256').update(setup).digest('hex')!==plan.sha256)throw Error('Pacote alterado desde a revisão.')}else if((await treeHash(path.join(plan.directory,'app'))).hash!==plan.hash)throw Error('Recuperação alterada desde a revisão.');return plan}
 };
}
