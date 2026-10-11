import path from 'node:path';import fs from 'node:fs/promises';import {csharpRuntime} from '../src/modules/csharp-runtime.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Preparação destinada ao runner descartável do GitHub.');
const data=path.join(process.env.RUNNER_TEMP,'nexo-csharp'),runtime=csharpRuntime(data),plan=await runtime.prepare();runtime.install(plan.id);
for(let i=0;i<900;i++){const job=runtime.jobs()[0];if(job.status==='failed')throw Error(job.error);if(job.status==='completed'){await fs.appendFile(process.env.GITHUB_ENV,'NEXO_CSHARP_TEST_RUNTIME='+runtime.directory+'\n');console.log('Runtime C# oficial preparado para os testes isolados.');process.exit(0)}await new Promise(r=>setTimeout(r,1000))}throw Error('Tempo limite de preparação C#.');
