import test from 'node:test';
import assert from 'node:assert/strict';
import {assistedExplanation} from '../src/modules/education-explanations.mjs';
import {worksheet,worksheetHTML} from '../src/modules/education-worksheets.mjs';
import {validatePlanning} from '../src/modules/education-planning.mjs';
import {coverageGoals,coverageReview} from '../src/modules/education-coverage.mjs';
import {misconception,diagnoseExercise} from '../src/modules/education-diagnostics.mjs';
import {localSpeech} from '../ui/education-speech.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {curriculumIndex,parseOfficialIndex} from '../src/modules/education-index.mjs';
import {educationService} from '../src/modules/education.mjs';

const quotes=[{text:'Um quadrado tem 4 lados iguais.'}];
const draft={steps:[{text:'Os 4 lados do quadrado têm o mesmo comprimento.',quoteIndices:[0]}],checkQuestion:'Como são os lados do quadrado?'};
test('assisted explanations refuse invented numbers and negative or incomplete audits',async()=>{
 let calls=0;
 await assert.rejects(()=>assistedExplanation(async()=>{calls++;return JSON.stringify({...draft,steps:[{text:'Tem 5 lados.',quoteIndices:[0]}]});},'Quadrado?',5,quotes),/números/);
 assert.equal(calls,1);
 for(const decisions of [[],[{index:0,supported:false}],[{index:1,supported:true}]]){
  calls=0;await assert.rejects(()=>assistedExplanation(async()=>JSON.stringify(++calls===1?draft:{decisions}),'Quadrado?',5,quotes),/revisão/);
 }
 calls=0;const result=await assistedExplanation(async()=>JSON.stringify(++calls===1?draft:{decisions:[{index:0,supported:true}]}),'Quadrado?',5,quotes);
 assert.equal(calls,2);assert.match(result.notice,/podem partilhar erros/);
});
test('worksheets separate questions from explanations and escape imported markup',()=>{
 const s=worksheet(5,'areas',2);assert.equal(s.items.length,2);
 s.items=[{question:'<img src=x onerror=alert(1)>',explanation:'PRIVATE_SOLUTION'}];
 const child=worksheetHTML(s),parent=worksheetHTML(s,true);
 assert.doesNotMatch(child,/PRIVATE_SOLUTION|<img/);assert.match(parent,/PRIVATE_SOLUTION/);
 assert.throws(()=>worksheet(5,'areas',21));assert.throws(()=>worksheet(5,'unknown',1));
});
test('planning import requires bounded reviewed themes',()=>{
 assert.throws(()=>validatePlanning({title:'Teste',units:[]}));
 assert.throws(()=>validatePlanning({title:'Teste',units:['a'.repeat(161)]}));
 assert.deepEqual(validatePlanning({title:' Frações ',units:[' Frações equivalentes ']}).units,['Frações equivalentes']);
});
test('coverage reviews are version-specific declarations and cannot claim completion without associations',()=>{
 const docs=[{doc:{id:'dge-math-test',subject:'math',url:'https://www.dge.mec.pt/test.pdf'},saved:{pdfSha256:'first',pages:[{number:1,blocks:['Reconhecer relações entre frações e números racionais.']}]}}];
 const a=coverageGoals(docs,5);assert.equal(a.total,1);assert.equal(a.declaredComplete,0);
 assert.throws(()=>coverageReview(a.goals[0],{status:'declared-complete',confirmed:true},5),/associa/);
 docs[0].saved.pdfSha256='changed';assert.notEqual(coverageGoals(docs,5).goals[0].id,a.goals[0].id);
});
test('possible misconceptions never label a correct answer as an error',()=>{
 const e={expected:12,misconceptions:diagnoseExercise('areas',3,4)};
 assert.equal(misconception(e,'12'),null);assert.equal(misconception(e,'14').code,'area-perimeter');assert.equal(misconception(e,'999'),null);
});
test('voice fails closed without proven local support and cleans up a failed start',async()=>{
 await assert.rejects(()=>localSpeech({environment:{},onText(){},onStatus(){}}),/local/);
 let starts=0,clears=0;
 class Speech {static async available(){return 'available';}processLocally=false;start(){starts++;throw Error('microphone denied');}}
 await assert.rejects(()=>localSpeech({environment:{SpeechRecognition:Speech,setTimeout:()=>1,clearTimeout:()=>clears++},onText(){},onStatus(){}}),/denied/);
 assert.equal(starts,1);assert.equal(clears,1);
});
test('official index consultation previews exact request, requires separate apply and rejects reuse',async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-index-test-'));
 const titles=['Português','Matemática','Educação Física','Inglês','TIC','Ciências Naturais','Educação Visual','Educação Tecnológica'];
 const html='<table>'+titles.map((t,i)=>'<tr><td>'+t+'</td>'+Array.from({length:9},(_,g)=>'<td><a href="/sites/default/files/Curriculo/Aprendizagens_Essenciais/test-'+i+'-'+g+'.pdf">'+(g+1)+'º</a></td>').join('')+'</tr>').join('')+'</table>';
 let calls=0,online=true;
 const service=curriculumIndex(data,{documents:[]},{settings:()=>({onlineMode:online}),fetcher:async(url,options)=>{calls++;assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.body,undefined);return new Response(html,{headers:{'content-type':'text/html'}});}});
 try{
  assert.equal(parseOfficialIndex(html).length,40);assert.throws(()=>parseOfficialIndex('<table>changed</table>'),/estrutura/);
  const plan=await service.prepare();assert.equal(calls,0);assert.match(plan.request.url,/dge.mec.pt/);
  const diff=await service.check(plan.id);assert.equal(calls,1);assert.equal((await service.current()).documents.length,0);
  await assert.rejects(()=>service.check(plan.id),/expirada/);
  await service.apply(diff.candidateId);assert.equal((await service.current()).documents.length,40);
  await assert.rejects(()=>service.apply(diff.candidateId),/expirada/);
  online=false;await assert.rejects(()=>service.prepare(),/online/);assert.equal(calls,1);
 }finally{await fs.rm(data,{recursive:true,force:true});}
});
test('photographs and worksheet solutions require appropriate profile and parent permissions',async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'nexo-input-test-'));let calls=0;
 const service=educationService(data,{localVision:async()=>{calls++;return 'Quanto é 2 + 3?';}});
 try{
  let auth=await service.setup('123456');let p=await service.saveProfile(auth.token,{alias:'Estudo',grade:5});
  await service.lock(auth.token,p.id);
  await assert.rejects(()=>service.photo(p.id,'/9j/AA=='),/autorizada/);assert.equal(calls,0);
  const sheet=await service.worksheet(p.id,'tables',2);
  await assert.rejects(()=>service.worksheetSolutions('invalid',p.id,sheet.id),/PIN/);
  auth=await service.unlock('123456');await service.exit(auth.token);
  await assert.rejects(()=>service.worksheetSolutions(auth.token,p.id,sheet.id),/expirada/);
  p=await service.saveProfile(auth.token,{id:p.id,alias:'Estudo',grade:5,allowPhotoReading:true});await service.lock(auth.token,p.id);
  await assert.rejects(()=>service.photo(p.id,'not-an-image'),/Imagem/);assert.equal(calls,0);
  const result=await service.photo(p.id,'/9j/AA==');assert.equal(result.text,'Quanto é 2 + 3?');assert.equal(calls,1);
 }finally{await fs.rm(data,{recursive:true,force:true});}
});
