import test from 'node:test';
import assert from 'node:assert/strict';
import {externalConsent} from '../src/modules/external-consent.mjs';
const settings={onlineMode:true,externalAI:true,providers:{openai:{enabled:true,baseUrl:'https://provider.example/v1',apiKey:'fixture-secret',model:'fixture-model'}}};
test('exact preview covers full request and consent is single use',async()=>{
 let calls=[];const gateway=externalConsent({fetcher:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({choices:[{message:{content:'OK'}}]})}}});
 const prompt='x'.repeat(5000),preview=gateway.prepare(settings,'chat',{provider:'openai-compatible',prompt});assert.equal(calls.length,0);assert.equal(preview.payload.messages[0].content,prompt);assert.equal(preview.payloadText,JSON.stringify(preview.payload));assert.ok(!JSON.stringify(preview).includes('fixture-secret'));
 await gateway.send(settings,preview.id);assert.equal(calls.length,1);assert.equal(calls[0].options.body,preview.payloadText);assert.equal(calls[0].url,preview.destination);assert.equal(calls[0].options.redirect,'error');await assert.rejects(()=>gateway.send(settings,preview.id),/Consentimento/);
});
test('changing endpoint or credential invalidates approved request',async()=>{
 const gateway=externalConsent({fetcher:async()=>{throw Error('Must not send')}}),preview=gateway.prepare(settings,'chat',{provider:'openai-compatible',prompt:'private'});
 const changed=structuredClone(settings);changed.providers.openai.baseUrl='https://other.example/v1';await assert.rejects(()=>gateway.send(changed,preview.id),/mudou/);
});
test('offline and disabled services never send data',()=>{
 const gateway=externalConsent();assert.throws(()=>gateway.prepare({...settings,onlineMode:false},'chat',{provider:'openai-compatible',prompt:'x'}),/desativado/);assert.throws(()=>gateway.prepare({...settings,externalAI:false},'chat',{provider:'openai-compatible',prompt:'x'}),/desativada/);
});
