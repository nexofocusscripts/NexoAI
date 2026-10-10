import fs from 'node:fs/promises';
import path from 'node:path';
import {updateService} from '../src/modules/updater.mjs';
const tag=process.env.NEXO_RELEASE_TAG;
if(!/^v\d+\.\d+\.\d+$/.test(tag||''))throw Error('Tag de versão inválida.');
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Este teste destina-se ao runner Windows isolado do GitHub.');
const base=path.join(process.env.RUNNER_TEMP,'nexo-release-validation');await fs.mkdir(base,{recursive:true});
const infoResponse=await fetch(`https://api.github.com/repos/nexofocusscripts/NexoAI/releases/tags/${tag}`,{headers:{accept:'application/vnd.github+json','user-agent':'NexoAI-release-validation'}});
if(!infoResponse.ok)throw Error(`Release HTTP ${infoResponse.status}`);
const release=await infoResponse.json(),asset=release.assets.find(a=>a.name===`Atualizacao-Nexo-AI-${tag.slice(1)}.nexoupdate`);
if(!asset)throw Error('Pacote assinado ausente.');
const response=await fetch(asset.browser_download_url);if(!response.ok)throw Error(`Pacote HTTP ${response.status}`);
const chunks=[];let total=0;for await(const chunk of response.body){total+=chunk.length;if(total>110000000)throw Error('Pacote demasiado grande.');chunks.push(chunk)}
const file=path.join(base,'release.nexoupdate');await fs.writeFile(file,Buffer.concat(chunks));
const service=updateService(base,'0.0.0'),preview=await service.prepareLocal(file);
if(preview.version!==tag.slice(1))throw Error('A assinatura pertence a outra versão.');
const plan=await service.consume(preview.id);await fs.copyFile(path.join(plan.directory,'setup.exe'),path.join(base,'setup.exe'));
await fs.writeFile(path.join(base,'signature.json'),JSON.stringify({version:preview.version,signatureVerified:preview.signatureVerified,sha256:preview.sha256},null,2));
console.log('Pacote público verificado e instalador preparado.');
