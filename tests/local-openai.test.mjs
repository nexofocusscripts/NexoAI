import test from 'node:test';import assert from 'node:assert/strict';
import {localOpenAI} from '../src/modules/local-openai.mjs';
test('local server models and chat use exact loopback requests without following redirects',async()=>{
 const calls=[],runtime=localOpenAI({id:'lmstudio',baseUrl:'http://127.0.0.1:1234/v1',fetcher:async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/models')?{data:[{id:'local-model'}]}:{choices:[{message:{content:'Olá'}}],usage:{prompt_tokens:4,completion_tokens:1}})}});
 assert.equal((await runtime.models())[0].name,'local-model');assert.equal((await runtime.chat('local-model',[{role:'user',content:'Olá'}])).message,'Olá');assert.equal(calls[0].url,'http://127.0.0.1:1234/v1/models');assert.equal(calls[1].options.redirect,'error');assert.equal(JSON.parse(calls[1].options.body).messages[0].content,'Olá');assert.equal((await runtime.status()).capabilities.pull,false);await assert.rejects(()=>runtime.pull(),/gestor/);
});
test('local adapters reject external addresses, credentials, malformed responses and oversized responses',async()=>{
 for(const baseUrl of ['https://127.0.0.1/v1','http://localhost/v1','http://192.168.1.1/v1','http://127.0.0.1.evil/v1','http://user:pass@127.0.0.1/v1','http://127.0.0.1/v1?x=1'])assert.throws(()=>localOpenAI({id:'test',baseUrl}));
 const adapter=fetcher=>localOpenAI({id:'test',baseUrl:'http://127.0.0.1:1234/v1',fetcher});await assert.rejects(()=>adapter(async()=>Response.json({})).models(),/inválida/);await assert.rejects(()=>adapter(async()=>new Response('x'.repeat(4*1024*1024+1))).models(),/grande/);assert.equal((await adapter(async()=>new Response('',{status:401})).status()).available,false);
});
