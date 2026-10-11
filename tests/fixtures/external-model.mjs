import fs from 'node:fs/promises';
const original=globalThis.fetch;
if(!process.env.NEXO_EXTERNAL_FIXTURE_LOG)throw Error('Fixture requires isolated log');
globalThis.fetch=async(url,options)=>{
 if(String(url)!=='https://fixture.invalid/v1/chat/completions')return original(url,options);
 const d=JSON.parse(options.body),system=d.messages[0].content;
 await fs.appendFile(process.env.NEXO_EXTERNAL_FIXTURE_LOG,JSON.stringify({url,body:options.body})+'\n');
 const actions=a=>'<nexo_actions>'+JSON.stringify(a)+'</nexo_actions>';
 const content=system.includes('Vais criar ou corrigir')?actions([{type:'write',path:'index.mjs',content:'export const add=(a,b)=>a-b;'},{type:'write',path:'sum.test.mjs',content:"import {test} from 'node:test';import assert from 'node:assert/strict';import {add} from './index.mjs';test('soma',()=>assert.equal(add(2,3),5));"},{type:'write',path:'README.md',content:'Testar soma'},{type:'command',command:'node --test sum.test.mjs'}]):system.includes('Revê criticamente')?'<nexo_review>{"findings":[],"blocking":false}</nexo_review>'+actions([]):actions([{type:'write',path:'index.mjs',content:'export const add=(a,b)=>a+b;'}]);
 return new Response(JSON.stringify({choices:[{message:{content}}]}),{headers:{'content-type':'application/json'}});
};
