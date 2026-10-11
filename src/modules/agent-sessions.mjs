import path from 'node:path';
import crypto from 'node:crypto';
import {readJson,writeJson} from './store.mjs';

// Approval covers one project, the visible objective and exact test commands.
// A new command always pauses the session; model output cannot authorize it.
export function agentSessions(data,operations){
 const pending=new Map(),running=new Map(),failures=new Map();
 const file=id=>{if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Sessão inválida.');return path.join(data,'agents',id+'.json')};
 const save=session=>writeJson(file(session.id),session);
 async function drive(session){
  const control=running.get(session.project)||{id:session.id,cancelled:false};running.set(session.project,control);
  try{
   session.backup=await operations.snapshot(session.project);await save(session);
   for(let iteration=session.iterations.length+1;iteration<=session.limit;iteration++){
    if(control.cancelled){session.status='cancelled';break}
    const plan=iteration===1?session.initialPlan:await operations.plan(session);
    if(control.cancelled){session.status='cancelled';break}
    const unapproved=plan.actions.filter(a=>a.type==='command'&&!session.tests.some(t=>t.requested===a.command));
    if(unapproved.length){session.status='needs_permission';session.pendingPlan=plan;session.pendingCommands=unapproved.map(a=>a.command);break}
    session.status='editing';await save(session);
    if(operations.guard&&(iteration>1||session.existingTests))await operations.guard(iteration===1?{...session,protectedTests:session.existingTests}:session,plan.actions);
    const results=await operations.apply(session.project,plan.actions.filter(a=>a.type!=='command'));
    if(iteration===1&&operations.seal)session.protectedTests=await operations.seal(session.project,session.tests);
    let review=null;
    if(session.delivery&&operations.review){
     session.status='reviewing';await save(session);review=iteration===1&&session.initialPlan.review?session.initialPlan.review:await operations.review(session);
     if(control.cancelled){session.status='cancelled';break}
     const extra=review.actions.filter(a=>a.type==='command'&&!session.tests.some(t=>t.requested===a.command));
     if(extra.length){session.status='needs_permission';session.pendingPlan=review;session.pendingCommands=extra.map(a=>a.command);break}
     if(operations.guard)await operations.guard(session,review.actions);
     results.push(...await operations.apply(session.project,review.actions.filter(a=>a.type!=='command')));
    }
    const tests=[];
    for(const preview of session.tests){
     if(control.cancelled)break;
     session.status='testing';await save(session);
     tests.push(await operations.test(session.project,preview));
    }
    session.iterations.push({iteration,message:plan.message,results,tests,review});
    const verified=tests.length>0&&tests.every(t=>t.ok&&t.validation?.ok)&&results.every(r=>r.ok);
    if(control.cancelled){session.status='cancelled';break}
    if(verified){session.validationIds=tests.map(t=>t.validation.id);if(session.delivery){if(!operations.deliver)throw Error('Entrega ZIP indisponível.');session.status='packaging';await save(session);session.artifact=await operations.deliver(session)}session.status='validated';break}
    if(!plan.actions.length&&!tests.length){session.status='needs_validation';break}
    session.status='analysing';await save(session);
   }
   if(['editing','testing','analysing','running','reviewing','packaging'].includes(session.status))session.status='limit_reached';
  }catch(error){session.status='failed';session.error=error.message}
  finally{session.updatedAt=new Date().toISOString();try{await save(session)}catch(error){failures.set(session.id,{...session,status:'failed',error:'Não foi possível guardar a sessão. Verifica o armazenamento antes de continuar.'})}finally{if(running.get(session.project)?.id===session.id)running.delete(session.project)}}
 }
 return {
  async prepare({project,prompt,model,provider='local',runtime,initialPlan,maxIterations=5,delivery=false}){
   if(running.has(project))throw Error('Já existe um agente em execução neste projeto.');
   if(!prompt||!Array.isArray(initialPlan?.actions))throw Error('Plano de agente inválido.');
   const tests=[];for(const command of [...new Set(initialPlan.actions.filter(a=>a.type==='command').map(a=>a.command))])tests.push(await operations.preview(project,command));
   if(!tests.length)throw Error('O plano tem de incluir pelo menos um teste comportamental para validar o resultado.');
   if(tests.some(t=>t.arguments.includes('--check')))throw Error('A verificação de sintaxe não substitui testes comportamentais.');
   const session={id:crypto.randomUUID(),project,prompt,model,provider,runtime,initialPlan,tests,delivery:delivery===true,limit:Math.max(1,Math.min(Number(maxIterations)||5,8)),status:'awaiting_approval',iterations:[],createdAt:new Date().toISOString()};
   if(operations.existingTests)session.existingTests=await operations.existingTests(project,tests);
   if(operations.projectState)session.projectState=await operations.projectState(project);
   pending.set(session.id,{session,expires:Date.now()+600000});await save(session);return session;
  },
  async start(id){const entry=pending.get(id);pending.delete(id);if(!entry||entry.expires<Date.now())throw Error('Plano expirado. Revê e autoriza novamente.');const session=entry.session;if(operations.projectState&&session.projectState!==await operations.projectState(session.project))throw Error('O projeto mudou desde a pré-visualização. Revê um novo plano.');if(running.has(session.project))throw Error('O projeto já tem um agente em execução.');running.set(session.project,{id:session.id,cancelled:false});session.status='running';try{await save(session)}catch(error){running.delete(session.project);throw error}void drive(session);return session},
  async get(id){if(failures.has(id))return failures.get(id);const session=await readJson(file(id),null);if(!session)throw Error('Sessão não encontrada.');if(['running','editing','testing','analysing','reviewing','packaging'].includes(session.status)&&running.get(session.project)?.id!==session.id){session.status='interrupted';await save(session)}return session},
  async cancel(id){const session=await this.get(id),control=running.get(session.project);if(control?.id===id)control.cancelled=true;else{session.status='cancelled';await save(session)}return {ok:true}},
  async prepareResume(id,owner){const previous=await this.get(id);if(running.has(previous.project))throw Error('Aguarda a operação atual.');if(['validated','restored','awaiting_approval'].includes(previous.status))throw Error('Esta sessão não precisa de continuação.');const plan=previous.pendingPlan||await operations.plan(owner?{...previous,id:owner}:previous);const approved=previous.tests.map(t=>({type:'command',command:t.requested}));return this.prepare({project:previous.project,prompt:previous.prompt,model:previous.model,provider:previous.provider,runtime:previous.runtime,initialPlan:{...plan,actions:[...plan.actions,...approved.filter(a=>!plan.actions.some(p=>p.type==='command'&&p.command===a.command))]},maxIterations:previous.limit,delivery:previous.delivery})},
  active(project){return running.has(project)},
  async restore(id){const session=await this.get(id);if(running.has(session.project))throw Error('Aguarda a paragem do agente antes de recuperar ficheiros.');await operations.restore(session);session.status='restored';await save(session);return session}
 };
}
