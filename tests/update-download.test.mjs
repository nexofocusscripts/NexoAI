import test from 'node:test';import assert from 'node:assert/strict';
import {updateDownloads} from '../src/modules/update-download.mjs';
const offer={available:true,signatureVerified:true,latest:'1.0.6',packageUrl:'https://github.com/nexofocusscripts/NexoAI/releases/download/v1.0.6/Atualizacao-Nexo-AI-1.0.6.nexoupdate',packageBytes:10,packageSha256:'a'.repeat(64)};
const online={onlineMode:true};
async function finished(service){for(let i=0;i<100;i++){const job=service.jobs()[0];if(job.status!=='running')return job;await new Promise(r=>setTimeout(r,5))}throw Error('Job did not finish')}
test('update download requires a verified offer and separate single-use consent before staging signed installer',async()=>{
 let calls=0;const service=updateDownloads('fixture',{prepareLocal:async()=>({version:'1.0.6',signatureVerified:true})},{downloader:async(asset,destination,{progress})=>{calls++;assert.equal(asset.url,offer.packageUrl);progress({received:10,total:10});return destination}});
 const result=service.remember(offer);assert.throws(()=>service.prepare({},result.downloadOffer),/online/);const plan=service.prepare(online,result.downloadOffer);assert.equal(calls,0);assert.equal(plan.method,'GET');assert.equal(plan.body,null);assert.throws(()=>service.start({},plan.id),/expirada/);
 const valid=service.prepare(online,result.downloadOffer);service.start(online,valid.id);assert.throws(()=>service.start(online,valid.id),/expirada/);const job=await finished(service);assert.equal(calls,1);assert.equal(job.status,'completed');assert.equal(job.installPlan.signatureVerified,true);assert.equal(job.progress.percent,100);
});
test('update download refuses unverified data and redirects outside official asset hosts',async()=>{
 const service=updateDownloads('fixture',{prepareLocal:async()=>({version:'1.0.6'})},{fetcher:async()=>new Response('',{status:302,headers:{location:'https://evil.example/setup'}}),downloader:async(asset,destination,{fetcher})=>fetcher(asset.url)});
 assert.equal(service.remember({...offer,signatureVerified:false}).downloadOffer,undefined);assert.throws(()=>service.prepare(online,'invented'));
 const bad=service.remember({...offer,packageUrl:'https://evil.example/setup'});assert.throws(()=>service.prepare(online,bad.downloadOffer),/oficial/);
 const valid=service.remember(offer),plan=service.prepare(online,valid.downloadOffer);service.start(online,plan.id);const job=await finished(service);assert.equal(job.status,'failed');assert.match(job.error,/não autorizada/);assert.equal(job.installPlan,undefined);
});
