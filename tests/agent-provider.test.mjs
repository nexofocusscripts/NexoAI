import test from 'node:test';
import assert from 'node:assert/strict';
import {externalConsent} from '../src/modules/external-consent.mjs';
import {agentProvider} from '../src/modules/agent-provider.mjs';
const settings=()=>({onlineMode:true,externalAI:true,providers:{openai:{enabled:true,apiKey:'fixture-key',model:'fixture',baseUrl:'https://example.invalid/v1'}}});
const settle=()=>new Promise(r=>setImmediate(r));
test('each agent correction requires a fresh exact payload approval; no network before consent',async()=>{
 const sent=[],events=[];const st=settings();const consent=externalConsent({fetcher:async(url,options)=>{sent.push({url,options});return new Response(JSON.stringify({choices:[{message:{content:'answer'}}]}));}});
 const service=agentProvider({consent,settings:async()=>st,audit:async(...args)=>events.push(args)});
 const messages=[{role:'user',content:'original code'}];const first=service.chat('session','openai-compatible','fixture',messages);await settle();messages[0].content='changed after preview';assert.equal(sent.length,0);
 const preview=service.pending()[0].preview;assert.match(preview.payloadText,/original code/);assert.doesNotMatch(JSON.stringify(preview),/fixture-key/);
 await service.send(preview.id);assert.equal(await first,'answer');assert.equal(sent[0].options.body,preview.payloadText);await assert.rejects(()=>service.send(preview.id));
 const second=service.chat('session','openai-compatible','fixture',[{role:'user',content:'test failure; repair'}]);await settle();assert.equal(sent.length,1);assert.notEqual(service.pending()[0].preview.id,preview.id);await service.send(service.pending()[0].preview.id);assert.equal(await second,'answer');assert.equal(sent.length,2);assert.equal(events.length,2);assert.doesNotMatch(JSON.stringify(events),/original code|fixture-key/);
});
test('changed configuration and refusal prevent the next agent request',async()=>{
 let sent=0;const st=settings();const consent=externalConsent({fetcher:async()=>{sent++;return new Response('{}');}});const service=agentProvider({consent,settings:async()=>st});
 const result=service.chat('first','openai-compatible','fixture',[{role:'user',content:'private'}]);const rejection=assert.rejects(result,/mudou/);await settle();st.providers.openai.apiKey='different';await assert.rejects(()=>service.send(service.pending()[0].preview.id),/mudou/);await rejection;assert.equal(sent,0);
 const refused=service.chat('second','openai-compatible','fixture',[{role:'user',content:'private'}]);const refusedResult=assert.rejects(refused,/recusou/);await settle();service.cancel('second');await refusedResult;assert.equal(service.pending().length,0);await assert.rejects(()=>service.chat('second','openai-compatible','fixture',[]),/cancelada/);assert.equal(sent,0);
});
test('expired preparation fails without sending or silently accepting',async()=>{
 let sent=0;const consent=externalConsent({fetcher:async()=>{sent++;return new Response('{}');}});const service=agentProvider({consent,settings:async()=>settings(),approvalTimeout:10});const job=service.prepare(id=>service.chat(id,'openai-compatible','fixture',[{role:'user',content:'code'}]));await new Promise(r=>setTimeout(r,35));assert.equal(service.job(job.id).status,'failed');assert.match(service.job(job.id).error,/expirou/);assert.equal(sent,0);assert.deepEqual(service.pending(),[]);
});
