// Existing local servers only; model installation stays with their own manager.
export function localOpenAI({id,baseUrl,fetcher=fetch}={}){
 const url=new URL(baseUrl);
 if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/v1')throw Error('O runtime tem de estar neste computador.');
 const request=async(route,options={})=>{
  const response=await fetcher(url.href+route,{redirect:'error',signal:AbortSignal.timeout(5000),...options});
  if(!response.ok)throw Error(`O runtime local respondeu com erro ${response.status}.`);
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4*1024*1024)throw Error('Resposta do runtime demasiado grande.');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 };
 const capabilities={chat:true,models:true,pull:false,remove:false,local:true};
 return {
  async status(){try{await request('/models');return {provider:id,available:true,local:true,capabilities,baseUrl:url.href}}catch{return {provider:id,available:false,local:true,capabilities,baseUrl:url.href,instructions:'Abre o gestor deste runtime e ativa o servidor local.'}}},
  async models(){const result=await request('/models');if(!Array.isArray(result.data))throw Error('Lista de modelos inválida.');return result.data.filter(m=>typeof m.id==='string'&&m.id.length<=256).map(m=>({name:m.id,size:null,capabilities:[],details:{},provider:id}))},
  async chat(model,messages,options={}){if(typeof model!=='string'||!model||model.length>256)throw Error('Modelo inválido.');const result=await request('/chat/completions',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(options.timeoutMs||600000),body:JSON.stringify({model,messages,stream:false,temperature:options.temperature??0.2,max_tokens:options.maxTokens||4096,...(options.schema?{response_format:{type:'json_schema',json_schema:{name:'nexo_agent',schema:options.schema}}}:{})})});if(result.choices?.[0]?.finish_reason==='length')throw Error('O modelo atingiu o limite da resposta. Divide o pedido; não foram aceites ficheiros incompletos.');const content=result.choices?.[0]?.message?.content;if(typeof content!=='string')throw Error('O runtime não devolveu texto.');return {message:content,model,usage:{promptTokens:result.usage?.prompt_tokens,completionTokens:result.usage?.completion_tokens}}},
  async pull(){throw Error('Instala os modelos no gestor deste runtime. O Nexo AI deteta-os automaticamente.')},
  async remove(){throw Error('Remove os modelos no gestor deste runtime.')}
 };
}
