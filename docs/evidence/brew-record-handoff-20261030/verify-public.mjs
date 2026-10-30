import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';

const [distArg, publicUrl] = process.argv.slice(2);
if (!distArg || !publicUrl) throw new Error('Usage: node verify-public.mjs <dist> <public-url>');
const dist = resolve(distArg);
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]));
  return nested.flat();
}
const results = [];
for (const file of (await files(dist)).sort()) {
  const path = relative(dist, file).split('\\').join('/');
  const response = await fetch(new URL(path, publicUrl), { cache: 'no-store' });
  const actual = Buffer.from(await response.arrayBuffer());
  const expected = await readFile(file);
  results.push({ path, status: response.status, matches: response.ok && actual.equals(expected), sha256: createHash('sha256').update(actual).digest('hex') });
}
const root = await fetch(publicUrl, { cache: 'no-store' });
const html = await root.text();
const result = { url: publicUrl, version: html.match(/id="build-version">([^<]+)/)?.[1], rootStatus: root.status, files: results };
console.log(JSON.stringify(result, null, 2));
if (!root.ok || results.some(item => !item.matches)) process.exitCode = 1;
