import test from 'node:test';
import assert from 'node:assert/strict';
import {detectHardware} from '../src/modules/hardware.mjs';
test('DXGI reports 64-bit AMD dedicated memory and keeps Intel shared memory separate',async()=>{const result=await detectHardware({platform:'win32',execute:async command=>command.endsWith('nexo-hardware.exe')?JSON.stringify([{name:'AMD GPU',dedicatedBytes:17179869184,sharedBytes:8589934592,vendorId:4098,deviceId:1},{name:'Intel integrated',dedicatedBytes:0,sharedBytes:17179869184,vendorId:32902,deviceId:2}]):null});assert.equal(result.gpu[0].vramGb,16);assert.equal(result.gpu[0].vramSource,'DXGI');assert.equal(result.gpu[1].vramGb,null);assert.equal(result.gpu[1].sharedMemoryGb,16);});
test('Windows inventory keeps unknown VRAM explicit and exact storage bytes',async()=>{
  const result=await detectHardware({platform:'win32',execute:async command=>command==='powershell.exe'?JSON.stringify({cpu:[{Name:'CPU',NumberOfCores:8,NumberOfLogicalProcessors:16}],ramBytes:34359738368,windows:{Caption:'Windows 11',BuildNumber:'1'},gpu:[{Name:'AMD GPU',AdapterRAM:4294967295}],storage:[{DeviceID:'C:',Size:1000000000000,FreeSpace:400000000000}]}):null});
  assert.equal(result.ramGb,32);assert.equal(result.threads,16);assert.equal(result.gpu[0].vramGb,null);assert.equal(result.storage[0].freeBytes,400000000000);
});
test('NVIDIA VRAM comes from driver rather than 32-bit CIM AdapterRAM',async()=>{
  const result=await detectHardware({platform:'win32',execute:async command=>command==='nvidia-smi'?'NVIDIA RTX, 24576\r\n':null});
  assert.equal(result.gpu[0].vramGb,24);assert.equal(result.gpu[0].vramSource,'nvidia-smi');assert.ok(result.errors.length);
});
