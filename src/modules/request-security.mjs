export function requestGuard(req, expectedHost) {
  if(req.headers.host!==expectedHost)return {status:403,error:'Host inválido.'};
  const origin=req.headers.origin;
  if(origin&&origin!==`http://${expectedHost}`)return {status:403,error:'Origem externa bloqueada.'};
  if(req.headers['sec-fetch-site']==='cross-site')return {status:403,error:'Pedido externo bloqueado.'};
  if(!['GET','HEAD'].includes(req.method)&&!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return {status:415,error:'É necessário application/json.'};
  return null;
}

export async function readBody(req, limit=1048576) {
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>limit){const e=Error('Pedido demasiado grande.');e.status=413;throw e;}chunks.push(chunk);}
  try{return chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{}}catch{const e=Error('JSON inválido.');e.status=400;throw e;}
}
