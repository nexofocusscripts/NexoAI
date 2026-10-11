import test from 'node:test';import assert from 'node:assert/strict';
import {contextConversation} from '../src/modules/agent-context.mjs';
test('agent can ask for omitted files and receives whole contents before proposing changes',async()=>{
 let calls=0;const seen=[];const result=await contextConversation({context:async required=>({files:required.map(path=>({path,content:'complete code\n'})),omitted:required.length?[]:[{path:'src/calc.py',reason:'budget'}]}),messages:view=>[{role:'user',content:JSON.stringify(view)}],chat:async messages=>{seen.push(messages);return ++calls===1?'<nexo_read>["src/calc.py"]</nexo_read>':'<nexo_actions>[]</nexo_actions>';}});
 assert.equal(calls,2);assert.equal(result.view.files[0].content,'complete code\n');assert.match(seen[1][0].content,/complete code/);
});
test('context reads reject secrets, traversal, mixed edits and repeated requests',async()=>{
 for(const response of ['<nexo_read>["../secret.txt"]</nexo_read>','<nexo_read>[".env"]</nexo_read>','<nexo_read>[".git/config"]</nexo_read>','<nexo_read>["src/a.py"]</nexo_read><nexo_actions>[]</nexo_actions>'])await assert.rejects(()=>contextConversation({context:async()=>({}),messages:()=>[],chat:async()=>response}));
 await assert.rejects(()=>contextConversation({context:async()=>({}),messages:()=>[],chat:async()=>'<nexo_read>["a.py"]</nexo_read>'}),/repetiu/);
});
