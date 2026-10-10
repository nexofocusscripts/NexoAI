import fs from 'node:fs/promises';
import path from 'node:path';
export async function availableSpace(directory){
 let target=path.resolve(directory);
 for(;;){try{const stat=await fs.statfs(target);return Number(stat.bavail)*Number(stat.bsize)}catch(error){if(error.code!=='ENOENT')throw error;const parent=path.dirname(target);if(parent===target)throw error;target=parent}}
}
export async function requireSpace(directory,bytes){
 const free=await availableSpace(directory);
 if(free<bytes+1073741824)throw Error(`Espaço insuficiente: são necessários ${(bytes/1073741824).toFixed(1)} GB e 1 GB de reserva; disponíveis ${(free/1073741824).toFixed(1)} GB.`);
 return free;
}
