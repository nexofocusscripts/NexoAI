import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const development=fileURLToPath(new URL('../../src-tauri/resources/nexo-vault.exe',import.meta.url));
const helper=process.env.NEXO_VAULT_EXE||development;
const run=(mode,input)=>new Promise((resolve,reject)=>{
 const child=spawn(helper,[mode],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{SystemRoot:process.env.SystemRoot,LOCALAPPDATA:process.env.LOCALAPPDATA,USERPROFILE:process.env.USERPROFILE}});let result='';
 const timer=setTimeout(()=>{child.kill();reject(Error('Cofre de credenciais indisponível.'))},10000);
 child.stdout.on('data',d=>{result+=d;if(result.length>65536)child.kill()});child.on('error',()=>{clearTimeout(timer);reject(Error('Cofre de credenciais indisponível.'))});child.on('close',code=>{clearTimeout(timer);code===0?resolve(result):reject(Error('Falha na proteção de credenciais Windows.'))});child.stdin.on('error',()=>{});child.stdin.end(input);
});
const locations=[['search'],['providers','openai'],['providers','anthropic'],['providers','image']];
export async function protectSettings(settings){const value=structuredClone(settings);for(const location of locations){let target=value;for(const part of location)target=target?.[part];if(target?.apiKey&&!target.apiKey.startsWith('dpapi:'))target.apiKey='dpapi:'+await run('encrypt',target.apiKey)}return value}
export async function revealSettings(settings){const value=structuredClone(settings);for(const location of locations){let target=value;for(const part of location)target=target?.[part];if(target?.apiKey?.startsWith('dpapi:'))target.apiKey=await run('decrypt',target.apiKey.slice(6))}return value}
export function publicSettings(settings){const value=structuredClone(settings);for(const location of locations){let target=value;for(const part of location)target=target?.[part];if(target){target.hasApiKey=!!target.apiKey;delete target.apiKey}}return value}
