import path from 'node:path';
import {readJson,transactionJson} from './store.mjs';
import {hardwareKey,isEmbedding} from './model-guide.mjs';
const probes=[
 {id:'response',title:'Resposta curta',prompt:'Responde apenas com a palavra NEXO.',check:text=>text.trim()==='NEXO'},
 {id:'logic',title:'Raciocínio simples',prompt:'Uma caixa tem 12 bolas. Retiram-se 5 e acrescentam-se 2. Quantas ficam? Responde apenas com o número.',check:text=>text.trim()==='9'},
 {id:'code',title:'Leitura de código',prompt:'Em JavaScript: const xs=[2,4,6]; console.log(xs.filter(x=>x>2).reduce((a,b)=>a+b,0)); Qual é a saída? Responde apenas com o número.',check:text=>text.trim()==='10'},
];
export function measurementService(data){
 const file=path.join(data,'benchmarks','models.json'),running=new Set();
 return {async list(){return readJson(file,[])},async measure(model,hw,adapter){
  if(isEmbedding(model))throw Error('Modelos de embeddings não respondem a este teste de conversa.');
  if(running.size)throw Error('Já existe uma medição em curso. Aguarda para evitar interferência entre modelos.');
  running.add(model.name);
  const startedAt=new Date().toISOString(),cases=[];
  try{
   for(const probe of probes){const start=Date.now();try{
    const result=await adapter.chat(model.name,[{role:'user',content:probe.prompt}],{maxTokens:256,temperature:0,timeoutMs:120000,think:false});
    const text=String(result.message||''),duration=Date.now()-start;
    cases.push({id:probe.id,title:probe.title,ok:probe.check(text),elapsedMs:duration,response:text.slice(0,1000),completionTokens:result.usage?.completionTokens??null,tokensPerSecond:result.evalDurationNs>0&&result.usage?.completionTokens>0?result.usage.completionTokens/(result.evalDurationNs/1e9):null,loadMs:result.loadDurationNs>=0?result.loadDurationNs/1e6:null});
   }catch(error){cases.push({id:probe.id,title:probe.title,ok:false,elapsedMs:Date.now()-start,error:error.message});break}}
   const record={model:model.name,digest:model.digest||null,hardwareKey:hardwareKey(hw),startedAt,cases,success:cases.length===probes.length&&cases.every(c=>c.ok),passed:cases.filter(c=>c.ok).length,total:probes.length,totalMs:cases.reduce((n,c)=>n+c.elapsedMs,0),notice:'Três sondas curtas, uma execução por sonda; limite de 256 tokens e pedido de resposta direta sem raciocínio prolongado, quando suportado pelo runtime. A primeira pode incluir carregamento a frio. Conversas normais podem usar outro modo e demorar mais. Isto mede estes pedidos, não inteligência geral nem capacidade de completar projetos. Sem acesso a ficheiros ou execução de código.'};
   await transactionJson(file,[],items=>[record,...items.filter(x=>x.model!==model.name)].slice(0,100));return record;
  }finally{running.delete(model.name)}
 }};
}
