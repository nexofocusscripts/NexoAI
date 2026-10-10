import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Executar apenas no runner Windows isolado.');
const port=Number(process.env.NEXO_TEST_CDP_PORT),out=process.env.NEXO_TEST_RESULTS;
assert.ok(port>0&&port<65536);assert.ok(out);
let browser;for(let i=0;i<90;i++){try{browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);break}catch{await new Promise(r=>setTimeout(r,1000))}}
assert.ok(browser,'WebView2 do desktop não abriu.');
try{
 let page;for(let i=0;i<60;i++){page=browser.contexts().flatMap(c=>c.pages())[0];if(page)break;await new Promise(r=>setTimeout(r,500))}assert.ok(page);
 await expect(page.getByRole('heading',{name:'O Nexo adapta-se a ti.'})).toBeVisible({timeout:60000});
 await page.screenshot({path:path.join(out,'first-launch.png'),fullPage:true});
 await page.getByRole('button',{name:'Analisar este computador',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Plano para Programação',exact:true})).toBeVisible({timeout:60000});
 await expect(page.getByRole('button',{name:'Preparar instalação do Ollama',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Entrar no Nexo AI',exact:true})).toBeDisabled();
 await page.screenshot({path:path.join(out,'hardware-and-missing-runtime.png'),fullPage:true});
 await fs.writeFile(path.join(out,'desktop.json'),JSON.stringify({nativeDesktop:true,firstLaunch:true,hardwareDetection:true,missingRuntimeExplained:true,modelDownloadNotExecuted:true},null,2));
 console.log('PASS: instalação real, WebView2 desktop, primeiro arranque, análise do PC e runtime em falta.');
}finally{await browser.close()}
