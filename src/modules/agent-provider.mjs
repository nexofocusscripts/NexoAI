import crypto from 'node:crypto';

// An autonomous loop never grants network permission to its own next request.
export function agentProvider({consent,settings,audit=async()=>{},approvalTimeout=300000}){
 const requests=new Map(),jobs=new Map(),cancelled=new Set();
 return {
  async chat(owner,provider,model,messages,options={}){
   if(cancelled.has(owner))throw Error('Preparação cancelada.');
   const preview=consent.prepare(await settings(),'chat',{provider,model,messages,...(options.schema?{schema:options.schema}:{})});
   return new Promise((resolve,reject)=>{
    const entry={owner,preview,state:'awaiting_approval',resolve,reject};
    entry.timer=setTimeout(()=>{requests.delete(preview.id);consent.discard(preview.id);reject(Error('O envio externo expirou. Revê uma nova continuação.'));},approvalTimeout);
    requests.set(preview.id,entry);
   });
  },
  pending(){return [...requests.values()].map(r=>({owner:r.owner,state:r.state,preview:r.preview}));},
  async send(id){
   const entry=requests.get(id);if(!entry||entry.state!=='awaiting_approval')throw Error('Pedido externo indisponível.');
   entry.state='sending';clearTimeout(entry.timer);
   try{const result=await consent.send(await settings(),id);await audit('agent.external.sent',{owner:entry.owner,approvalId:id,destination:entry.preview.destination,payloadSha256:entry.preview.payloadSha256});requests.delete(id);entry.resolve(result.message);return {ok:true};}
   catch(error){requests.delete(id);entry.reject(error);throw error;}
  },
  cancel(owner){cancelled.add(owner);for(const [id,entry] of requests){if(entry.owner!==owner||entry.state==='sending')continue;clearTimeout(entry.timer);requests.delete(id);consent.discard(id);entry.reject(Error('O utilizador recusou o envio externo.'));}const job=jobs.get(owner);if(job&&job.status==='running')job.cancelled=true;},
  prepare(operation){const id=crypto.randomUUID(),job={id,status:'running',createdAt:new Date().toISOString()};jobs.set(id,job);Promise.resolve().then(()=>operation(id)).then(result=>{job.status=job.cancelled?'cancelled':'completed';if(!job.cancelled)job.result=result;}).catch(error=>{job.status=job.cancelled?'cancelled':'failed';job.error=error.message;});return {id,status:job.status};},
  job(id){const job=jobs.get(id);if(!job)throw Error('Preparação não encontrada.');return {...job};}
 };
}
