import crypto from 'node:crypto';
import {checkUpdate} from './updater.mjs';
export const officialUpdateUrl='https://raw.githubusercontent.com/nexofocusscripts/NexoAI/main/updates/stable.json';
const urlFor=settings=>settings.updates?.manifestUrl||officialUpdateUrl;
export function updateChecks(current,{checker=checkUpdate,now=Date.now}={}){
 const plans=new Map();
 return {
  prepare(settings){
   if(!settings.onlineMode)throw Error('Ativa o modo online para consultar versões.');
   const url=new URL(urlFor(settings));
   if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('Canal de atualização HTTPS inválido.');
   const id=crypto.randomUUID(),plan={id,url:url.href,expires:now()+600000,method:'GET',headers:{accept:'application/json','user-agent':'NexoAI-Updater'},body:null,dataSent:'Endereço IP e metadados da ligação. Sem projetos, chats, ficheiros, modelos ou chaves de API.'};
   plans.set(id,plan);return plan;
  },
  async execute(settings,id){
   const plan=plans.get(id);plans.delete(id);
   if(!plan||plan.expires<now())throw Error('Autorização de consulta expirada.');
   if(!settings.onlineMode||new URL(urlFor(settings)).href!==plan.url)throw Error('A configuração mudou desde a revisão.');
   return checker({...settings,updates:{...settings.updates,manifestUrl:plan.url}},current);
  }
 };
}
