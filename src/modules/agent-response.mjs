const action={type:'object',properties:{type:{type:'string',enum:['write','mkdir','delete','command','memory']},path:{type:'string'},content:{type:'string'},command:{type:'string'},title:{type:'string'},solution:{type:'string'}},required:['type'],additionalProperties:false};
export function agentSchema(review=false){return {type:'object',properties:{message:{type:'string'},actions:{type:'array',items:action},reads:{type:'array',items:{type:'string'}},review:{type:'object',properties:{findings:{type:'array',items:{type:'string'}},blocking:{type:'boolean'}},required:['findings','blocking'],additionalProperties:false}},required:review?['actions','review']:['actions'],additionalProperties:false};}
export function agentResponse(content,{review=false}={}){
 // Legacy adapters may return the tagged protocol; it remains separately validated.
 if(/<nexo_(?:actions|read)>/i.test(content))return content;
 let value;try{value=JSON.parse(content)}catch{throw Error('O modelo não devolveu um plano estruturado válido. Escolhe um modelo de programação com suporte a JSON estruturado.');}
 if(!value||!Array.isArray(value.actions)||value.reads!==undefined&&!Array.isArray(value.reads))throw Error('Resposta estruturada incompleta.');
 if(value.reads?.length){if(value.actions.length||value.reads.some(n=>typeof n!=='string'))throw Error('Pedido de leitura inválido.');return '<nexo_read>'+JSON.stringify(value.reads)+'</nexo_read>';}
 for(const a of value.actions){if(!a||!['write','mkdir','delete','command','memory'].includes(a.type)||(['write','mkdir','delete'].includes(a.type)&&typeof a.path!=='string')||(a.type==='write'&&typeof a.content!=='string')||(a.type==='command'&&typeof a.command!=='string')||(a.type==='memory'&&typeof a.solution!=='string'))throw Error('O modelo devolveu uma ação incompleta.');}
 if(review&&(!Array.isArray(value.review?.findings)||typeof value.review.blocking!=='boolean'))throw Error('O modelo não devolveu uma revisão estruturada.');
 return (typeof value.message==='string'?value.message:'')+'\n'+(value.review?'<nexo_review>'+JSON.stringify(value.review)+'</nexo_review>':'')+'<nexo_actions>'+JSON.stringify(value.actions)+'</nexo_actions>';
}
