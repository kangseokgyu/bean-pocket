import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const [root, output] = process.argv.slice(2);
assert.ok(root && output, 'usage: node script.mjs dist-directory output-json');
const base = 'https://kangseokgyu.github.io/bean-pocket/';
async function list(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? list(join(directory, entry.name))
    : [join(directory, entry.name)]));
  return nested.flat();
}
const results = [];
for (const path of (await list(root)).sort()) {
  const file = relative(root, path).split('\\').join('/');
  const response = await fetch(`${base}${file}?verify=favorite-${Date.now()}`, { cache: 'no-store' });
  assert.equal(response.status, 200, file);
  const actual = Buffer.from(await response.arrayBuffer());
  const expected = await readFile(path);
  assert.ok(actual.equals(expected), `public bytes match local build: ${file}`);
  results.push({ file, status: response.status, sha256: createHash('sha256').update(actual).digest('hex') });
}
const html = await readFile(join(root, 'index.html'), 'utf8');
const version = html.match(/build[^\n]{0,100}/gi);
const report = { base, verifiedAt: new Date().toISOString(), version, results };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ base, files: results.length, version }));
