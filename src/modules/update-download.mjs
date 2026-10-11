import crypto from 'node:crypto';import path from 'node:path';
import {verifiedDownload} from './download.mjs';

export function updateDownloads(data,updates,{fetcher=fetch,downloader=verifiedDownload,now=Date.now}={}){
 const offers=new Map(),plans=new Map(),jobs=new Map();
 const safeFetch=async(url,options={})=>{
  for(let count=0;count<5;count++){
   const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(target.hostname))throw Error('Origem de download não autorizada.');
   const response=await fetcher(target.href,{...options,redirect:'manual'});
   if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();url=new URL(response.headers.get('location'),target).href;continue}return response;
  }throw Error('Demasiados redirecionamentos no download.');
 };
 return {
  remember(result){if(!result.available||!result.signatureVerified)return result;const id=crypto.randomUUID();offers.set(id,{...result,expires:now()+600000});return {...result,downloadOffer:id}},
  prepare(settings,id){
   if(!settings.onlineMode)throw Error('Ativa o modo online para descarregar a atualização.');const offer=offers.get(id);
   if(!offer||offer.expires<now())throw Error('Consulta novamente as versões.');
   const expected=`https://github.com/nexofocusscripts/NexoAI/releases/download/v${offer.latest}/Atualizacao-Nexo-AI-${offer.latest}.nexoupdate`;
   if(offer.packageUrl!==expected||!Number.isInteger(offer.packageBytes)||offer.packageBytes<1||offer.packageBytes>110000000||! /^[a-f0-9]{64}$/.test(offer.packageSha256||''))throw Error('O canal não contém um pacote oficial com integridade verificável.');
   const plan={id:crypto.randomUUID(),version:offer.latest,url:expected,bytes:offer.packageBytes,sha256:offer.packageSha256,method:'GET',headers:{},body:null,expires:now()+600000,dataSent:'Endereço IP e metadados da ligação. Nenhum projeto, chat, ficheiro ou chave de API.'};plans.set(plan.id,plan);return {...plan};
  },
  start(settings,id){
   const plan=plans.get(id);plans.delete(id);if(!settings.onlineMode||!plan||plan.expires<now())throw Error('Autorização de download expirada ou modo online desativado.');
   const abort=new AbortController(),state={id:crypto.randomUUID(),kind:'update.download',target:plan.version,status:'running',progress:null,createdAt:new Date().toISOString()};jobs.set(state.id,{state,abort});
   const destination=path.join(data,'updates','downloads',plan.sha256+'.nexoupdate');
   Promise.resolve().then(()=>downloader(plan,destination,{fetcher:safeFetch,signal:abort.signal,progress:p=>{state.progress={...p,percent:Math.round(p.received/p.total*100)}}})).then(async()=>{if(abort.signal.aborted)throw Error('Download cancelado.');state.installPlan=await updates.prepareLocal(destination);if(state.installPlan.version!==plan.version)throw Error('A versão do pacote não corresponde à consulta.');state.status='completed';state.finishedAt=new Date().toISOString()}).catch(error=>{state.status=abort.signal.aborted?'cancelled':'failed';state.error=error.message;state.finishedAt=new Date().toISOString()});
   return {...state};
  },
  jobs(){return [...jobs.values()].map(x=>structuredClone(x.state))},
  cancel(id){const job=jobs.get(id);if(!job||job.state.status!=='running')throw Error('Download não está em curso.');job.abort.abort();return {ok:true}}
 };
}
