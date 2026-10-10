export function imageService(settings){
 const c=settings.localImage||{};
 const localUrl=()=>{const url=new URL(c.baseUrl||'http://127.0.0.1:7860');if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash)throw Error('O motor local de imagens tem de usar um endereço de loopback.');return url.href.replace(/\/$/,'')};
 return {status(){return {enabled:!!c.enabled,baseUrl:localUrl(),backend:c.backend||'automatic1111'}},async generate(prompt,{negativePrompt='',width=1024,height=1024,steps=28}={}){
  if(!c.enabled)throw Error('Motor local de imagens desativado.');
  if((c.backend||'automatic1111')!=='automatic1111')throw Error('Backend de imagem local não suportado nesta configuração.');
  for(const value of [width,height])if(!Number.isInteger(value)||value<64||value>2048||value%8)throw Error('Dimensões de imagem inválidas.');
  if(!Number.isInteger(steps)||steps<1||steps>100)throw Error('Número de passos inválido.');
  const r=await fetch(localUrl()+'/sdapi/v1/txt2img',{method:'POST',redirect:'error',signal:AbortSignal.timeout(600000),headers:{'content-type':'application/json'},body:JSON.stringify({prompt,negative_prompt:negativePrompt,width,height,steps})});
  if(!r.ok)throw Error(`Motor de imagem HTTP ${r.status}`);const d=await r.json();return {backend:'local',images:(d.images||[]).map(x=>'data:image/png;base64,'+x),info:d.info};
 }};
}
