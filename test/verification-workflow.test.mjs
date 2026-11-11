import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
const deployWorkflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('pull requests and main pushes run verification without publishing Pages', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:[\s\S]*branches:\s*\n\s*-\s*main/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build:pages/);
  assert.match(workflow, /npm run check:pages/);
  assert.match(workflow, /npm run test:browser/);
  assert.doesNotMatch(workflow, /deploy-pages|upload-pages-artifact|pages:\s*write|id-token:\s*write/);
});

test('Pages publishing remains manually dispatched', () => {
  assert.match(deployWorkflow, /workflow_dispatch:/);
  assert.doesNotMatch(deployWorkflow, /pull_request:|push:/);
  assert.match(deployWorkflow, /actions\/deploy-pages@/);
});

test('browser runner stays outside Node test auto-discovery', () => {
  assert.equal(packageJson.scripts['test:browser'], 'node scripts/browser/run.mjs');
});
