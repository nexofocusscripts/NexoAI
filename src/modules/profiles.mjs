export const profiles={programming:{label:'Programação',tasks:['code'],suggested:['qwen3-coder:30b']},images:{label:'Imagens',tasks:['image'],suggested:['qwen2.5vl:7b']},documents:{label:'Documentos',tasks:['documents'],suggested:['qwen3:14b']},everything:{label:'Tudo',tasks:['code','image','documents','general'],suggested:['qwen3-coder:30b','qwen2.5vl:7b','qwen3:14b']}};
export function installationPlan(profile,installed=[],hardware={}){
 installed=installed.filter(x=>!x.capabilities?.includes('embedding')&&!/embed/i.test(x.name));
 const p=profiles[profile]||profiles.everything,names=new Set(installed.map(x=>x.name)),ram=hardware.ramGb||0,vram=Math.max(0,...(hardware.gpu||[]).map(x=>x.vramGb||0));
 const coder=ram>=48&&vram>=20?'qwen3-coder:30b':ram>=24&&vram>=10?'qwen2.5-coder:14b':ram>=12?'qwen2.5-coder:7b':'qwen2.5-coder:3b';
 const general=ram>=24&&vram>=10?'qwen3:14b':ram>=12?'qwen3:8b':'qwen3:4b';
 const vision=ram>=16?'qwen2.5vl:7b':'qwen2.5vl:3b';
 const selections={programming:[coder],documents:[general],images:[vision],everything:[coder,general,vision]};
 const proposed=selections[profile]||selections.everything;
 // Keep suitable already-installed models before offering another download.
 const selected=proposed.map(name=>{const task=/coder/.test(name)?'code':/vl|vision/.test(name)?'image':'general';return names.has(name)?name:installed.find(x=>(task==='code'?/coder/i.test(x.name):task==='image'?/vl|vision/i.test(x.name):!/coder|vl|vision/i.test(x.name))&&(!x.size||x.size/1073741824<ram*.55))?.name||name});
 const estimates={'3b':2.5,'4b':3,'7b':5,'8b':6,'14b':10,'30b':20};
 const models=[...new Set(selected)].map(name=>({name,installed:names.has(name),action:names.has(name)?'keep':'install',estimatedDownloadGb:names.has(name)?0:(estimates[name.match(/(3b|4b|7b|8b|14b|30b)(?=:|$)/)?.[1]]||8)}));
 const requiredGb=models.reduce((n,m)=>n+m.estimatedDownloadGb,0)+(['images','everything'].includes(profile)?4.3:0),freeGb=hardware.modelStorageFreeBytes==null?null:hardware.modelStorageFreeBytes/1073741824;
 return {profile,label:p.label,hardware,models,estimatedDownloadGb:requiredGb,storageSufficient:freeGb==null?null:freeGb>=requiredGb+1,notes:[...(freeGb==null?[]:[`Espaço livre para modelos: ${freeGb.toFixed(1)} GB. Downloads estimados: ${requiredGb.toFixed(1)} GB.`,...(freeGb<requiredGb+1?['Espaço insuficiente para este perfil. Liberta espaço ou escolhe um perfil mais leve.']:[])]),...(ram<12?['Pouca RAM: o desempenho poderá ser limitado.']:[]),...(vram===0?['VRAM não confirmada: recomendação conservadora com base na RAM.']:[]),...(profile==='images'||profile==='everything'?['O modelo visual compreende imagens. A geração de imagens necessita de um motor próprio.']:[])]};
}
