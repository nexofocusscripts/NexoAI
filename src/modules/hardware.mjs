import os from 'node:os';
import {execFile} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const resources=process.env.NEXO_DESKTOP==='1'?path.dirname(process.execPath):fileURLToPath(new URL('../../src-tauri/resources/',import.meta.url));
const run=(command,args)=>new Promise(resolve=>execFile(command,args,{windowsHide:true,timeout:15000,maxBuffer:1048576},(error,stdout)=>resolve(error?null:stdout)));
const windowsProbe=`$ErrorActionPreference='Stop';$cpu=Get-CimInstance Win32_Processor;$system=Get-CimInstance Win32_ComputerSystem;$windows=Get-CimInstance Win32_OperatingSystem;$gpu=Get-CimInstance Win32_VideoController;$disks=Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3';[ordered]@{cpu=@($cpu|Select-Object Name,NumberOfCores,NumberOfLogicalProcessors);ramBytes=[double]$system.TotalPhysicalMemory;windows=($windows|Select-Object Caption,Version,BuildNumber,OSArchitecture);gpu=@($gpu|Select-Object Name,AdapterRAM,DriverVersion,PNPDeviceID);storage=@($disks|Select-Object DeviceID,Size,FreeSpace,FileSystem)}|ConvertTo-Json -Depth 5 -Compress`;
export async function detectHardware({execute=run,platform=os.platform()}={}){
  const result={platform,release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model||null,threads:os.cpus().length,ramGb:os.totalmem()/1073741824,gpu:[],storage:[],windows:null,errors:[]};
  if(platform!=='win32')return result;
  const probe=await execute('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',windowsProbe]);
  if(probe){try{
    const data=JSON.parse(probe.replace(/^\uFEFF/,''));
    result.cpu=data.cpu.map(x=>x.Name).join(' / ');result.threads=data.cpu.reduce((n,x)=>n+x.NumberOfLogicalProcessors,0);result.cores=data.cpu.reduce((n,x)=>n+x.NumberOfCores,0);
    result.ramGb=data.ramBytes/1073741824;result.windows=data.windows;
    result.gpu=data.gpu.map(x=>({name:x.Name,driver:x.DriverVersion,vramGb:null,vramSource:null,adapterRamReportedBytes:x.AdapterRAM}));
    result.storage=data.storage.map(x=>({drive:x.DeviceID,totalBytes:x.Size,freeBytes:x.FreeSpace,fileSystem:x.FileSystem}));
  }catch{result.errors.push('Resposta de inventário Windows inválida.');}}else result.errors.push('Inventário Windows indisponível.');
  const dxgi=await execute(path.join(resources,'nexo-hardware.exe'),[]);
  if(dxgi)try{for(const adapter of JSON.parse(dxgi)){
    if(typeof adapter.name!=='string'||!Number.isSafeInteger(adapter.dedicatedBytes)||adapter.dedicatedBytes<0||!Number.isSafeInteger(adapter.sharedBytes)||adapter.sharedBytes<0)throw Error('DXGI inválido');
    let gpu=result.gpu.find(g=>g.name===adapter.name);if(!gpu){gpu={name:adapter.name};result.gpu.push(gpu)}
    Object.assign(gpu,{vramGb:adapter.dedicatedBytes>0?adapter.dedicatedBytes/1073741824:null,vramSource:adapter.dedicatedBytes>0?'DXGI':null,sharedMemoryGb:adapter.sharedBytes/1073741824,vendorId:adapter.vendorId,deviceId:adapter.deviceId});
  }}catch{result.errors.push('Memória gráfica DXGI indisponível.');}
  const nvidia=await execute('nvidia-smi',['--query-gpu=name,memory.total','--format=csv,noheader,nounits']);
  if(nvidia)for(const line of nvidia.trim().split(/\r?\n/)){
    const match=line.match(/^(.*),\s*(\d+(?:\.\d+)?)$/);if(!match)continue;
    const name=match[1].trim(),memory=Number(match[2])/1024;let gpu=result.gpu.find(x=>x.name===name);
    if(!gpu){gpu={name};result.gpu.push(gpu);}Object.assign(gpu,{vramGb:memory,vramSource:'nvidia-smi'});
  }
  return result;
}
