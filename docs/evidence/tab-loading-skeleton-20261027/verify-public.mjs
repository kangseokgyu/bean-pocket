import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [root, output] = process.argv.slice(2);
const base = 'https://kangseokgyu.github.io/bean-pocket/';
async function files(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(path.join(directory, entry.name), prefix + entry.name + '/')
    : [prefix + entry.name]));
  return nested.flat();
}
const results = await Promise.all((await files(path.join(root, 'dist'))).map(async file => {
  const local = await readFile(path.join(root, 'dist', file));
  const response = await fetch(base + file + '?verification=tab-skeleton', { cache: 'no-store' });
  const remote = Buffer.from(await response.arrayBuffer());
  return { file, status: response.status, match: local.equals(remote),
    sha256: createHash('sha256').update(remote).digest('hex') };
}));
await writeFile(output, JSON.stringify({ base, files: results }, null, 2) + '\n');
console.log(JSON.stringify({ files: results.length, passed: results.filter(row => row.status === 200 && row.match).length,
  failures: results.filter(row => row.status !== 200 || !row.match) }));
if (results.some(row => row.status !== 200 || !row.match)) process.exitCode = 1;
