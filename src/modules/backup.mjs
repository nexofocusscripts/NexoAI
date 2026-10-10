import fs from 'node:fs/promises';import path from 'node:path';
import {projectPath} from './filesystem.mjs';
async function walk(dir,base=dir){await projectPath(base,path.relative(base,dir).replaceAll('\\','/')||'.');let o=Object.create(null);for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['node_modules','.git','.nexo'].includes(e.name))continue;if(e.isSymbolicLink())throw Error('Backup contém ligação simbólica.');let r=path.relative(base,path.join(dir,e.name)).replaceAll('\\','/'),p=await projectPath(base,r);if(e.isDirectory())Object.assign(o,await walk(p,base));else if(e.isFile()){let s=await fs.stat(p);if(s.size>=2_000_000)throw Error('Ficheiro demasiado grande para backup seguro.');o[r]=(await fs.readFile(p)).toString('base64')}}return o}
export async function exportProject(root){return{format:'nexo-project-v1',createdAt:new Date().toISOString(),files:await walk(root)}}
export async function importProject(root,bundle){
  if(bundle?.format!=='nexo-project-v1'||!bundle.files||typeof bundle.files!=='object'||Array.isArray(bundle.files))throw Error('Backup inválido');
  const entries=Object.entries(bundle.files),planned=[];let bytes=0;
  if(entries.length>10000)throw Error('Backup demasiado grande.');
  for(const [rel,b64] of entries){
    if(typeof b64!=='string'||b64.length>2700000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(b64))throw Error('Conteúdo inválido no backup.');
    const p=await projectPath(root,rel);if(p===path.resolve(root))throw Error('Backup contém caminho inválido');
    const content=Buffer.from(b64,'base64');bytes+=content.length;if(bytes>100000000)throw Error('Backup demasiado grande.');planned.push({rel,content});
  }
  for(const {rel,content} of planned){const p=await projectPath(root,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,content)}
  return{files:entries.length};
}
