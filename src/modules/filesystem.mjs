import fs from 'node:fs/promises';
import path from 'node:path';
import {inside} from '../core.mjs';

// Reject existing symbolic links and junctions, including the project root.
// This is a filesystem boundary; process isolation requires a separate OS sandbox.
export async function projectPath(root, relative='.') {
  const target=inside(root,relative);
  const base=path.resolve(root);
  const parts=path.relative(base,target).split(path.sep).filter(Boolean);
  let current=base;
  for(const part of [null,...parts]) {
    if(part!==null)current=path.join(current,part);
    try {
      const st=await fs.lstat(current);
      if(st.isSymbolicLink())throw Error('Ligações simbólicas e junctions são bloqueadas.');
    } catch(error) { if(error.code!=='ENOENT')throw error; }
  }
  return target;
}
