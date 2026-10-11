import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function verified(url,sha,max){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error('Runtime HTTP '+r.status);const chunks=[];let n=0;for await(const c of r.body){n+=c.length;if(n>max)throw Error('Runtime demasiado grande');chunks.push(c)}const b=Buffer.concat(chunks);if(digest(b)!==sha)throw Error('Checksum oficial inválido');return b}
const python=path.join(root,'src-tauri/resources/python');
const archive=await verified('https://www.python.org/ftp/python/3.13.16/python-3.13.16-embed-amd64.zip','97dae5274cc54867065e8d5a3226e48c35017ed332a0fdb0e27d5b5821961297',15000000);
await fs.mkdir(python,{recursive:true});let expanded=0;
for(const [name,b] of Object.entries(unzipSync(archive))){if(!/^[a-zA-Z0-9_.-]+$/.test(name)||name.includes('..'))throw Error('Entrada Python inválida');expanded+=b.length;if(expanded>50000000)throw Error('Runtime expandido demasiado grande');await fs.writeFile(path.join(python,name),b)}
const hashes={};for(const name of (await fs.readdir(python)).filter(n=>n!=='nexo-runtime.json').sort())hashes[name]=digest(await fs.readFile(path.join(python,name)));
await fs.writeFile(path.join(python,'nexo-runtime.json'),JSON.stringify({version:'3.13.16',hashes},null,2));
const luaSource=path.join(root,'native/vendor/lua-5.4.9');
if(!await fs.stat(path.join(luaSource,'src/lua.h')).catch(()=>null)){
 const cache=path.join(root,'.nexo-build');await fs.mkdir(cache,{recursive:true});const file=path.join(cache,'lua.tar.gz');
 await fs.writeFile(file,await verified('https://www.lua.org/ftp/lua-5.4.9.tar.gz','2335b6c582a52654f94612bf10d2f4672805d05329aa6568b1d8cd9e5c6fb8e6',1000000));
 const names=execFileSync('tar',['-tzf',file],{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/);if(names.some(n=>!n.startsWith('lua-5.4.9/')||n.includes('..')||n.includes('\\')))throw Error('Entrada Lua inválida');
 await fs.mkdir(path.dirname(luaSource),{recursive:true});execFileSync('tar',['-xzf',file,'-C',path.dirname(luaSource)],{windowsHide:true});
}
console.log('Python 3.13.16 e fonte Lua 5.4.9 verificados.');
