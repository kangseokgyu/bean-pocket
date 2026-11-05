import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'https://kangseokgyu.github.io/bean-pocket/';
const files = ['index.html', 'ui/view.mjs', 'styles.css', 'app.mjs', 'manifest.webmanifest', 'sw.js'];
const results = [];
for (const file of files) {
  const response = await fetch(`${base}${file}?verify=recipe-header-${Date.now()}`, {cache: 'no-store'});
  assert.equal(response.status, 200, file);
  const actual = Buffer.from(await response.arrayBuffer());
  const expected = await readFile(`dist/${file}`);
  assert.ok(actual.equals(expected), `public bytes match local build: ${file}`);
  results.push({file, status: response.status, sha256:createHash('sha256').update(actual).digest('hex')});
}
await writeFile('docs/evidence/recipe-header-edit-20261105/public-results.json', JSON.stringify({base, verifiedAt:new Date().toISOString(), results}, null, 2));
console.log(JSON.stringify(results));
