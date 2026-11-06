import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { PNG } = require(process.env.PNGJS_MODULE ?? '/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pngjs');
const [baseline, candidate] = process.argv.slice(2);
if (!baseline || !candidate) throw new Error('Provide the baseline and candidate screenshot directories.');
const results = [];
for (const file of (await readdir(baseline)).filter(name => name.endsWith('.png')).sort()) {
  const [before, after] = await Promise.all([baseline, candidate].map(dir => readFile(path.join(dir, file)).then(PNG.sync.read)));
  if (before.width !== after.width || before.height !== after.height) {
    results.push({ file, sameDimensions: false, before: [before.width, before.height], after: [after.width, after.height] });
    continue;
  }
  let pixelsChanged = 0;
  const rows = [];
  for (let y = 0; y < before.height; y++) {
    let left = before.width;
    let right = -1;
    let count = 0;
    for (let x = 0; x < before.width; x++) {
      const i = (y * before.width + x) * 4;
      if (before.data.readUInt32BE(i) === after.data.readUInt32BE(i)) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      count++;
    }
    if (!count) continue;
    pixelsChanged += count;
    const previous = rows.at(-1);
    if (previous?.bottom === y - 1) {
      previous.bottom = y;
      previous.left = Math.min(previous.left, left);
      previous.right = Math.max(previous.right, right);
    } else rows.push({ top: y, bottom: y, left, right });
  }
  results.push({ file, sameDimensions: true, pixelsChanged, rows });
}
console.log(JSON.stringify(results, null, 2));
