import path from 'node:path';
import crypto from 'node:crypto';
import {readJson,writeJson} from './store.mjs';
import {safeName} from '../core.mjs';
export function conversations(data){
  let queue=Promise.resolve();
  const file=project=>path.join(data,'chats',safeName(project)+'.json');
  const mutate=(project,action)=>{const next=queue.then(async()=>{const list=await readJson(file(project),[]),value=action(list);await writeJson(file(project),list);return value});queue=next.catch(()=>{});return next};
  return {
    async list(project){return readJson(file(project),[])},
    create(project,title='Novo chat'){return mutate(project,list=>{const value={id:crypto.randomUUID(),title:String(title).slice(0,100),createdAt:new Date().toISOString(),messages:[]};list.push(value);return value})},
    append(project,id,messages){return mutate(project,list=>{const chat=list.find(x=>x.id===id);if(!chat)throw Error('Chat não encontrado neste projeto.');chat.messages.push(...messages);chat.updatedAt=new Date().toISOString();if(chat.title==='Novo chat')chat.title=String(messages[0]?.content||'Chat').slice(0,70);return chat})},
    async get(project,id){const chat=(await this.list(project)).find(x=>x.id===id);if(!chat)throw Error('Chat não encontrado neste projeto.');return chat}
  };
}
