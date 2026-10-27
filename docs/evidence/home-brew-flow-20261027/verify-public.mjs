import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const [root, output] = process.argv.slice(2);
const hash = value => createHash('sha256').update(value).digest('hex');
async function filesIn(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name), prefix + entry.name + '/')
    : [prefix + entry.name]));
  return groups.flat();
}
const files = await filesIn(root);
const checked = await Promise.all(files.map(async file => {
  const local = await readFile(path.join(root, file));
  const url = new URL(file, 'https://kangseokgyu.github.io/bean-pocket/');
  url.searchParams.set('verify', String(Date.now()));
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const remote = Buffer.from(await response.arrayBuffer());
  return { file, status: response.status, localSha256: hash(local), remoteSha256: hash(remote),
    matches: response.ok && hash(local) === hash(remote) };
}));
const index = await readFile(path.join(root, 'index.html'), 'utf8');
const build = index.match(/id="build-version">([^<]+)/)?.[1] ?? null;
const result = { checkedAt: new Date().toISOString(), url: 'https://kangseokgyu.github.io/bean-pocket/#/home',
  build, allMatch: checked.every(item => item.matches), files: checked };
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ build, allMatch: result.allMatch, fileCount: files.length,
  mismatches: checked.filter(item => !item.matches).map(item => item.file) }));
if (!result.allMatch) process.exitCode = 1;
