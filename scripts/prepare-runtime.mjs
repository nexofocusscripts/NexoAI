import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = '24.21.0';
const base = `https://nodejs.org/dist/v${version}/`;
async function download(relative) {
  const response = await fetch(base + relative, {signal: AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error(`Download Node falhou: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const sums = (await download('SHASUMS256.txt')).toString('utf8');
const expected = sums.split(/\r?\n/).find(line => /\swin-x64\/node\.exe$/.test(line))?.split(/\s+/)[0];
if (!/^[a-f0-9]{64}$/.test(expected || '')) throw new Error('Checksum oficial Node não encontrado.');
const target = path.join(root, 'src-tauri/resources/node.exe');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const existing = await fs.readFile(target).catch(() => null);
if (existing && digest(existing) === expected) {
  console.log(`Node ${version} x64 já verificado.`);
} else {
  const bytes = await download('win-x64/node.exe');
  if (digest(bytes) !== expected) throw new Error('Checksum do runtime não corresponde ao oficial.');
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, bytes);
  console.log(`Node ${version} x64 preparado e checksum verificado.`);
}
