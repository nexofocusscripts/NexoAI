import test from 'node:test';
import assert from 'node:assert/strict';
import {detectHardware} from '../src/modules/hardware.mjs';
test('Windows inventory keeps unknown VRAM explicit and exact storage bytes',async()=>{
  const result=await detectHardware({platform:'win32',execute:async command=>command==='powershell.exe'?JSON.stringify({cpu:[{Name:'CPU',NumberOfCores:8,NumberOfLogicalProcessors:16}],ramBytes:34359738368,windows:{Caption:'Windows 11',BuildNumber:'1'},gpu:[{Name:'AMD GPU',AdapterRAM:4294967295}],storage:[{DeviceID:'C:',Size:1000000000000,FreeSpace:400000000000}]}):null});
  assert.equal(result.ramGb,32);assert.equal(result.threads,16);assert.equal(result.gpu[0].vramGb,null);assert.equal(result.storage[0].freeBytes,400000000000);
});
test('NVIDIA VRAM comes from driver rather than 32-bit CIM AdapterRAM',async()=>{
  const result=await detectHardware({platform:'win32',execute:async command=>command==='nvidia-smi'?'NVIDIA RTX, 24576\r\n':null});
  assert.equal(result.gpu[0].vramGb,24);assert.equal(result.gpu[0].vramSource,'nvidia-smi');assert.ok(result.errors.length);
});
