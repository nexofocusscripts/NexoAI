import crypto from 'node:crypto';
function endpoint(base,suffix){const url=new URL(base.replace(/\/$/,'')+suffix);if(url.protocol!=='https:'||url.username||url.password)throw Error('Os providers externos exigem HTTPS e URL sem credenciais.');return url.toString()}
function requestFor(settings,kind,input){
 if(!settings.onlineMode)throw Error('Modo online desativado.');
 const providers=settings.providers||{};
 if(kind==='chat'){
  if(!settings.externalAI)throw Error('IA externa desativada.');
  const messages=input.messages||[{role:'user',content:String(input.prompt||'')}];
  if(!Array.isArray(messages)||messages.some(m=>!['user','assistant','system'].includes(m.role)||typeof m.content!=='string'))throw Error('Mensagens inválidas.');
  if(input.provider==='anthropic'){
   const c=providers.anthropic;if(!c?.enabled||!c.apiKey)throw Error('Provider Anthropic não configurado.');
   return {url:'https://api.anthropic.com/v1/messages',method:'POST',headers:{'content-type':'application/json','x-api-key':c.apiKey,'anthropic-version':'2023-06-01'},body:{model:input.model||c.model,max_tokens:4096,system:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),messages:messages.filter(m=>m.role!=='system')}};
  }
  if(input.provider!=='openai-compatible')throw Error('Provider não suportado.');
  const c=providers.openai;if(!c?.enabled||!c.apiKey)throw Error('Provider de texto não configurado.');
  return {url:endpoint(c.baseUrl,'/chat/completions'),method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+c.apiKey},body:{model:input.model||c.model,messages,stream:false}};
 }
 if(kind==='image'){
  const c=providers.image;if(!settings.externalAI||!c?.enabled||!c.apiKey)throw Error('Geração externa de imagens desativada.');
  return {url:endpoint(c.baseUrl,'/images/generations'),method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+c.apiKey},body:{model:c.model||'gpt-image-1',prompt:String(input.prompt||''),size:'1024x1024'}};
 }
 if(kind==='search'){
  if(!settings.webSearch)throw Error('Pesquisa web desativada.');const c=settings.search||{},limit=Math.min(10,Math.max(1,Number(input.limit)||8));
  if(c.provider==='brave'&&c.apiKey){const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',String(input.query));url.searchParams.set('count',String(limit));return {url:url.toString(),method:'GET',headers:{accept:'application/json','x-subscription-token':c.apiKey}}}
  if(c.provider==='searxng'&&c.baseUrl){const url=new URL('/search',c.baseUrl);if(url.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('A pesquisa externa exige HTTPS.');url.searchParams.set('q',String(input.query));url.searchParams.set('format','json');return {url:url.toString(),method:'GET',headers:{accept:'application/json'}}}
  throw Error('Configura um motor de pesquisa nas Definições.');
 }
 throw Error('Operação externa inválida.');
}
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function externalConsent({fetcher=fetch}={}){const pending=new Map();return {
 prepare(settings,kind,input){
  const request=requestFor(settings,kind,input);if(JSON.stringify(request).length>524288)throw Error('Dados externos demasiado grandes.');
  const id=crypto.randomUUID(),expiresAt=Date.now()+300000;pending.set(id,{settingsHash:digest(request),kind,input:structuredClone(input),request,expiresAt});
  const headers={...request.headers};for(const key of ['authorization','x-api-key','x-subscription-token'])if(headers[key])headers[key]='[credencial configurada: enviada neste cabeçalho]';
  return {id,expiresAt,destination:request.url,method:request.method,headers,payload:request.body??null,payloadText:request.body?JSON.stringify(request.body):'',payloadSha256:digest(request.body??null),warning:'Revê o destino e todos os dados do pedido. Nada é enviado antes de confirmares.'};
 },
 async send(settings,id){
  const approval=pending.get(id);pending.delete(id);
  if(!approval||approval.expiresAt<Date.now())throw Error('Consentimento inválido ou expirado.');
  if(digest(requestFor(settings,approval.kind,approval.input))!==approval.settingsHash)throw Error('O provider ou o pedido mudou. Revê os dados novamente.');
  const r=approval.request,response=await fetcher(r.url,{method:r.method,headers:r.headers,...(r.body?{body:JSON.stringify(r.body)}:{}),signal:AbortSignal.timeout(180000),redirect:'error'});
  if(!response.ok)throw Error(`Serviço externo HTTP ${response.status}`);const result=await response.json();
  if(approval.kind==='chat')return {kind:'chat',message:approval.input.provider==='anthropic'?result.content?.map(x=>x.text||'').join('')||'':result.choices?.[0]?.message?.content||''};
  if(approval.kind==='search')return {kind:'search',results:(result.results||result.web?.results||[]).slice(0,10).map(x=>({title:x.title,url:x.url,snippet:x.content||x.description||''}))};
  return {kind:'image',data:result.data||[]};
 }
}}
