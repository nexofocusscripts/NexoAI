import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {requireSpace} from './storage.mjs';
export async function verifiedDownload(asset,destination,{signal,progress=()=>{},fetcher=fetch}={}){
 const hashFile=async file=>{const handle=await fs.open(file,'r'),hash=crypto.createHash('sha256');try{for await(const chunk of handle.createReadStream())hash.update(chunk);return hash.digest('hex')}finally{await handle.close().catch(()=>{})}};
 await fs.mkdir(path.dirname(destination),{recursive:true});
 try{const stat=await fs.stat(destination);if(stat.size===asset.bytes&&await hashFile(destination)===asset.sha256)return destination}catch{}
 const partial=destination+'.partial';let offset=0;try{offset=(await fs.stat(partial)).size}catch{}
 if(offset>asset.bytes){await fs.rm(partial);offset=0}
 if(offset<asset.bytes){
  await requireSpace(path.dirname(destination),asset.bytes-offset);
  const response=await fetcher(asset.url,{signal,headers:offset?{Range:`bytes=${offset}-`}:{}});
  if(!response.ok||!response.body)throw Error(`Download falhou (${response.status}).`);
  if(offset&&response.status!==206)offset=0;
  if(response.status===206&&!String(response.headers.get('content-range')).startsWith(`bytes ${offset}-`))throw Error('Retoma de download inválida.');
  const handle=await fs.open(partial,offset?'a':'w');
  try{for await(const chunk of response.body){offset+=chunk.length;if(offset>asset.bytes)throw Error('Tamanho de download inválido.');await handle.write(chunk);progress({received:offset,total:asset.bytes})}}finally{await handle.close()}
 }
 if(offset!==asset.bytes||await hashFile(partial)!==asset.sha256){await fs.rm(partial,{force:true});throw Error('Integridade do download inválida.')}
 await fs.rename(partial,destination);return destination;
}
