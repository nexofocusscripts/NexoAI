import path from 'node:path';import crypto from 'node:crypto';
import {readJson,transactionJson} from './store.mjs';
import {embeddingService} from './embeddings.mjs';
const words=s=>new Set(String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9_]{3,}/g)||[]);const score=(a,b)=>{let A=words(a),B=words(b),n=0;for(const x of A)if(B.has(x))n++;return n/Math.max(1,Math.sqrt(A.size*B.size))};
export function semanticMemory(data,{embed,model='nomic-embed-text:latest'}={}){
 const file=path.join(data,'semantic-memory.json'),service=embeddingService();
 const vector=async text=>{try{const result=await (embed?embed(text):service.embed(model,text));return Array.isArray(result)&&result.length&&result.every(Number.isFinite)?result:null}catch{return null}};
 const describe=x=>`${x.title||''} ${x.problem||''} ${x.solution||''} ${(x.tags||[]).join(' ')}`;
 return {
  async add(input){
   const value={id:crypto.randomUUID(),project:input.project,title:String(input.title||''),problem:String(input.problem||''),solution:String(input.solution||''),tags:Array.isArray(input.tags)?input.tags.map(String).slice(0,20):[],scope:'project',status:'candidate',createdAt:new Date().toISOString(),uses:0};
   const embedding=await vector(describe(value));if(embedding)value.embedding={model,vector:embedding};
   await transactionJson(file,[],items=>[...items,value].slice(-2000));return value;
  },
  async search(query,{project,limit=8,confirmedOnly=true}={}){
   const items=(await readJson(file,[])).filter(x=>(!project||x.project===project||x.scope==='global')&&(!confirmedOnly||x.status==='confirmed'));
   const embedding=items.some(x=>x.embedding?.model===model)?await vector(query):null;
   return items.map(x=>{const semantic=embedding&&x.embedding?.model===model&&x.embedding.vector.length===embedding.length;const {embedding:storedVector,...publicItem}=x;return {...publicItem,_score:semantic?service.cosine(embedding,x.embedding.vector):score(query,describe(x)),retrieval:semantic?'local-embeddings':'lexical-fallback'}}).filter(x=>x._score>0.05).sort((a,b)=>b._score-a._score).slice(0,Math.min(20,limit));
  },
  async confirm(id,validation,{global=false}={}){
   if(!validation?.ok||!validation.id||!validation.snapshot||validation.sandbox!=='Windows AppContainer')throw Error('Validação de testes necessária.');
   let result;await transactionJson(file,[],items=>{const value=items.find(x=>x.id===id);if(!value)throw Error('Memória não encontrada');if(value.project!==validation.project)throw Error('Validação pertence a outro projeto.');value.status='confirmed';value.scope=global?'global':'project';value.validation={id:validation.id,snapshot:validation.snapshot,command:validation.command,at:validation.at};value.confirmedAt=new Date().toISOString();result=value;return items});return result;
  },
  async list(){return (await readJson(file,[])).map(({embedding,...value})=>value)}
 };
}
