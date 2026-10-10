// Editorial guidance is explicitly separate from runtime metadata and measurements.
export const reviewedAt='2026-10-10';
export const modelProfiles=[
 {name:'qwen3-coder:30b',title:'Qwen3-Coder 30B',tasks:['code'],downloadGb:19,context:256000,agent:true,reasoning:'Especializado em resolver tarefas de programação em várias etapas. Não implica o mesmo desempenho de Claude nem uma pontuação universal de inteligência.',strengths:['Programação, revisão e correção de código','Planeamento de alterações em vários ficheiros','Treinado para agentes e uso de ferramentas'],limits:['Modelo pesado: parte dos pesos pode ficar na RAM numa GPU de 12 GB','Só texto; não interpreta imagens','A criação de ficheiros e ZIP depende das ferramentas disponibilizadas pelo Nexo'],source:'https://ollama.com/library/qwen3-coder'},
 {name:'devstral:24b',title:'Devstral 24B',tasks:['code'],downloadGb:14,context:128000,agent:true,reasoning:'Especializado em engenharia de software com ferramentas, exploração de projetos e edição de vários ficheiros. A qualidade depende do projeto, instruções e ferramentas.',strengths:['Explorar projetos e localizar código relevante','Edição de vários ficheiros','Modelo desenvolvido para agentes de programação'],limits:['14 GB de pesos aproximados: pode exceder 12 GB de VRAM antes da memória de contexto','Só texto; não gera nem interpreta imagens','Precisa de validação local para comparar com modelos já instalados'],source:'https://ollama.com/library/devstral'},
 {name:'qwen2.5-coder:14b',title:'Qwen2.5-Coder 14B',tasks:['code'],downloadGb:9,context:32768,agent:false,reasoning:'Especializado em gerar, explicar e corrigir código. O Nexo pode usá-lo no seu ciclo de agente com ações estruturadas, mesmo sem declarar ferramentas nativas.',strengths:['Geração e explicação de código','Correções localizadas e revisão','Compromisso entre tamanho e programação'],limits:['Não pressupor suporte nativo a ferramentas apenas pelo nome','Projetos longos exigem seleção de contexto','Resultados devem ser revistos e testados'],source:'https://ollama.com/library/qwen2.5-coder:14b'},
 {name:'qwen3:8b',title:'Qwen3 8B',tasks:['general','documents'],downloadGb:5.2,context:40960,agent:true,reasoning:'Modelo geral com modos de raciocínio e resposta direta na família Qwen3. O raciocínio prolongado pode demorar mais; o modo efetivo depende do runtime.',strengths:['Conversas, explicações e documentos','Menor utilização de memória','Família com suporte a ferramentas e raciocínio'],limits:['Menor capacidade para programação extensa que um especialista maior não é uma regra garantida','Raciocínio prolongado consome tempo e contexto','Só texto'],source:'https://ollama.com/library/qwen3:8b'},
 {name:'qwen3:14b',title:'Qwen3 14B',tasks:['general','documents'],downloadGb:9.3,context:40960,agent:true,reasoning:'Modelo geral da família Qwen3. Mais parâmetros não garantem melhores respostas em todas as tarefas; compara resultados nas tuas tarefas.',strengths:['Análise de texto, conversa e documentos','Família com raciocínio e ferramentas','Alternativa geral a modelos especializados em código'],limits:['Mais memória e tempo que a variante 8B em condições comparáveis','Só texto','Não existe uma nota de raciocínio medida para este computador'],source:'https://ollama.com/library/qwen3'},
 {name:'qwen2.5vl:3b',title:'Qwen2.5-VL 3B',tasks:['image','documents'],downloadGb:3.2,context:32768,agent:false,reasoning:'Especializado em compreender imagens juntamente com texto. Útil para páginas digitalizadas e perguntas visuais; não é um motor de geração de imagens.',strengths:['Interpretar PNG/JPEG e páginas digitalizadas','Variante visual relativamente pequena','Conversar sobre imagens localmente'],limits:['Pode interpretar mal texto pequeno e detalhes','Não produz imagens: a geração usa um motor separado','Não é a primeira escolha para um agente de programação'],source:'https://ollama.com/library/qwen2.5vl:3b'},
 {name:'qwen2.5vl:7b',title:'Qwen2.5-VL 7B',tasks:['image','documents'],downloadGb:6,context:32768,agent:false,reasoning:'Variante visual maior da família Qwen2.5-VL. A melhoria em tarefas específicas deve ser verificada com exemplos, sem assumir uma classificação universal.',strengths:['Compreensão de imagens e documentos visuais','Texto e imagem na mesma conversa'],limits:['Exige mais memória que a variante 3B','Pode cometer erros em leitura e interpretação','Não gera imagens'],source:'https://ollama.com/library/qwen2.5vl'},
];
export const preferenceLabels={balanced:'Equilibrar capacidade e recursos',quality:'Priorizar especialização e capacidade',speed:'Priorizar rapidez e menor memória'};
export const isEmbedding=m=>m.capabilities?.includes('embedding')||/embed/i.test(m.name);
export function profileFor(name){const exact=modelProfiles.find(p=>p.name===name);if(exact)return exact;const normalized=name.replace(/:latest$/,'');return modelProfiles.find(p=>p.name.split(':')[0]===normalized)||null}
export function hardwareFit(model,hw={}){
 const gb=model.size>0?model.size/1073741824:model.downloadGb||null,ram=Number(hw.ramGb)||0;
 const vram=Math.max(0,...(hw.gpu||[]).map(g=>Number(g.vramGb)||0));
 if(!gb)return {level:'unknown',text:'Memória necessária desconhecida. Mede antes de comparar.',weightsGb:null};
 // Reserve space for context/runtime/OS. These are estimates, not admission checks.
 const reserve=Math.max(2,gb*.15),need=gb+reserve;
 if(ram&&ram<need+4)return {level:'limited',weightsGb:gb,text:`Memória apertada: cerca de ${gb.toFixed(1)} GB de pesos mais contexto/runtime. RAM detetada: ${ram.toFixed(1)} GB. Pode falhar ou usar paginação.`};
 if(vram>=need)return {level:'gpu',weightsGb:gb,text:`Os pesos e uma reserva aproximada cabem nos ${vram.toFixed(1)} GB de VRAM. Boa possibilidade de aceleração; contexto e processos concorrentes podem alterar o resultado.`};
 if(vram)return {level:'hybrid',weightsGb:gb,text:`Pesos de cerca de ${gb.toFixed(1)} GB mais contexto/runtime; VRAM ${vram.toFixed(1)} GB. Prevê execução repartida entre GPU e RAM, potencialmente mais lenta.`};
 return {level:'cpu',weightsGb:gb,text:'VRAM não confirmada. A velocidade não pode ser prevista com confiança; execução por CPU pode ser mais lenta. Isto não prova ausência de aceleração.'};
}
export function rankModels(models,task,hw={},preference='balanced',measurements=[]){
 if(!preferenceLabels[preference])preference='balanced';
 return models.filter(m=>!isEmbedding(m)&&(task!=='image'||m.capabilities?.includes('vision')||/vl|vision/i.test(m.name))).map(m=>{
  const p=profileFor(m.name),fit=hardwareFit({...p,...m},hw),vision=m.capabilities?.includes('vision')||/vl|vision/i.test(m.name);
  const suitability=task==='image'?(vision?110:-1000):task==='code'?(p?.tasks.includes('code')?100:/coder|devstral/i.test(m.name)?90:20):(p?.tasks.includes(task)?85:40);
  const knownSize=fit.weightsGb||8;
  let score=suitability+(task==='code'&&p?.agent?12:0);
  if(fit.level==='limited')score-=180;
  if(preference==='quality')score+=Math.min(knownSize,25)*1.3;
  else if(preference==='speed')score-=knownSize*2.5+(fit.level==='hybrid'?25:0);
  else score-=knownSize*.3+(fit.level==='hybrid'?15:0);
  const measurement=measurements.find(x=>x.model===m.name&&x.digest===m.digest&&x.hardwareKey===hardwareKey(hw));
  if(preference==='speed'&&measurement?.success===true&&measurement.totalMs>0)score+=Math.max(0,18-Math.log2(1+measurement.totalMs/1000)*3);
  return {model:m.name,score,fit,reason:`${preferenceLabels[preference]}. ${p?.tasks.includes(task)?'Especialização adequada à tarefa.':'Adequação inferida; confirma com exemplos.'} ${fit.text}`,measurement:measurement||null};
 }).sort((a,b)=>b.score-a.score||a.model.localeCompare(b.model));
}
export function hardwareKey(hw){return JSON.stringify({cpu:hw.cpu,ramGb:Math.round(hw.ramGb||0),gpu:(hw.gpu||[]).map(g=>[g.name,g.vramGb,g.driver]),windows:hw.windows?.BuildNumber})}
export function guide(models,hw,preference='balanced',measurements=[]){
 const all=[...modelProfiles.map(p=>({name:p.name,...p})),...models.filter(m=>!modelProfiles.some(p=>p.name===m.name))];
 return {reviewedAt,hardware:hw,preference,preferences:preferenceLabels,activeContextTokens:8192,notice:'Descrições editoriais e estimativas não são resultados de benchmark. O Nexo usa atualmente até 8192 tokens de contexto; o máximo do fabricante não é o contexto ativo. Não existem notas universais de inteligência. Criar ficheiros, testar e gerar ZIP depende das funções da aplicação.',models:all.map(p=>{const installed=models.find(m=>m.name===p.name),profile=profileFor(p.name);return {...profile,...p,installed:!!installed,sizeBytes:installed?.size||null,digest:installed?.digest||null,runtimeCapabilities:installed?.capabilities||[],details:installed?.details||{},fit:hardwareFit({...profile,...p,...installed},hw),measurement:measurements.find(x=>x.model===p.name&&x.digest===installed?.digest&&x.hardwareKey===hardwareKey(hw))||null,unknown:!profile,embedding:installed?isEmbedding(installed):false}}),recommendations:Object.fromEntries(['code','general','documents','image'].map(task=>[task,rankModels(models,task,hw,preference,measurements).slice(0,3)]))};
}
