import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPages } from '../scripts/build-pages.mjs';
import { checkPages } from '../scripts/check-pages.mjs';

const modules = ['commands/index.mjs', 'ui/controller.mjs', 'ui/view.mjs', 'platform/app-lifecycle.mjs', 'platform/update-coordinator.mjs'];

test('server-page demo records mark their generated v2 snapshot valid', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const recordBranch = app.match(/if \(kind === 'records'\) \{([\s\S]*?)\n    \}\n    item\.id/);
  assert.ok(recordBranch, 'the demo record creation branch must remain identifiable');
  assert.match(recordBranch[1], /snapshot:\s*createSnapshot\(bean,\s*recipe\)/);
  assert.match(recordBranch[1], /snapshotStatus:\s*'valid'/);
});

test('public save updates the spinner icon with pending, success, and restored states', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const setter = app.match(/function setActionButton\(button, state, label\) \{[\s\S]*?\n\}/);
  assert.ok(setter, 'public save feedback uses one action-state setter');
  assert.match(setter[0], /button\.dataset\.state\s*=\s*state/);
  assert.match(setter[0], /icon\.dataset\.state\s*=\s*state/);

  const submit = app.match(/function bindForm\([\s\S]*?\n\}\n\nasync function saveData/);
  assert.ok(submit);
  assert.match(submit[0], /setActionButton\(submitButton,\s*'saving'/);
  assert.match(submit[0], /setActionButton\(submitButton,\s*'success'/);
  assert.match(submit[0], /setActionButton\(submitButton,\s*'idle'/);
});

test('public save keeps actual success feedback visible before closing the dialog', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const submit = app.match(/function bindForm\([\s\S]*?\n\}\n\nasync function saveData/);
  assert.ok(submit);
  const successIndex = submit[0].indexOf("setActionButton(submitButton, 'success'");
  const holdIndex = submit[0].indexOf('await new Promise(resolve => setTimeout(resolve, FORM_SUCCESS_HOLD_MS));', successIndex);
  const closeIndex = submit[0].indexOf('dialog.close()', successIndex);
  const unlockIndex = submit[0].indexOf('saving = false;', holdIndex);

  assert.ok(successIndex >= 0, 'success follows a resolved save');
  assert.ok(holdIndex > successIndex && holdIndex < closeIndex, 'the success state paints before the dialog closes');
  assert.ok(unlockIndex > holdIndex, 'submit and cancel stay locked through visible success feedback');
  assert.match(app, /const FORM_SUCCESS_HOLD_MS = 1000;/);
});

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-release-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, 'pwa');
  const outputDir = path.join(root, 'dist');
  await cp(new URL('../pwa/', import.meta.url), sourceDir, { recursive: true });
  return { root, sourceDir, outputDir };
}

test('product commands, UI and lifecycle ship byte-for-byte and all affect the release version', async t => {
  const f = await fixture(t);
  let version = await buildPages(f);
  for (const file of modules) {
    assert.deepEqual(await readFile(path.join(f.outputDir, file)), await readFile(path.join(f.sourceDir, file)));
    assert.ok((await readFile(path.join(f.outputDir, 'sw.js'), 'utf8')).includes('./' + file));
    await writeFile(path.join(f.sourceDir, file), 'export const fixture = true;\n');
    const next = await buildPages(f);
    assert.notEqual(next, version);
    version = next;
    await writeFile(path.join(f.outputDir, file), "fetch('https://example.invalid');");
    await assert.rejects(checkPages(f.outputDir), /외부 URL/);
  }
});

test('commands/UI directory symlinks cannot bypass the source boundary', async t => {
  for (const directory of ['commands', 'ui']) {
    const f = await fixture(t);
    const outside = path.join(f.root, 'outside');
    await cp(path.join(f.sourceDir, directory), outside, { recursive: true });
    await rm(path.join(f.sourceDir, directory), { recursive: true });
    await symlink(outside, path.join(f.sourceDir, directory));
    await assert.rejects(buildPages(f), /심볼릭|symlink/);
  }
});

test('release checker rejects activation moved outside the handshake, aliases and removed guards', async t => {
  const f = await fixture(t);
  await buildPages(f);
  const file = path.join(f.outputDir, 'sw.js');
  const original = await readFile(file, 'utf8');
  const mutations = [
    source => source.replace('await self.skipWaiting();', '') + '\nself.skipWaiting();\n',
    source => source + "\nself['skipWaiting']();\n",
    source => source + '\nconst activateNow = self.skipWaiting.bind(self); activateNow();\n',
    source => source.replace(/if \(!sameClients\(ids,[^\n]+\)\) return;/, ''),
    source => source.slice(0, source.indexOf("\n\n")) + `
const APP_REQUESTS = APP_FILES.map(file => new Request(new URL(file, self.registration.scope), { cache: 'reload' }));
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_REQUESTS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name))))));
self['skip' + 'Waiting']();
`,
  ];
  for (const mutate of mutations) {
    const changed = mutate(original);
    assert.notEqual(changed, original, 'the fixture must actually change the worker');
    await writeFile(file, changed);
    await assert.rejects(checkPages(f.outputDir), /업데이트|원본|skipWaiting/);
  }
  await writeFile(file, original);
  assert.equal(await checkPages(f.outputDir), true);
});


test('SVG namespace is allowed only in UI element creation, never as a request URL', async t => {
  const f = await fixture(t);
  await buildPages(f);
  await checkPages(f.outputDir);
  const target = path.join(f.outputDir, 'ui/view.mjs');
  const original = await readFile(target, 'utf8');
  for (const extra of [
    "fetch('http://www.w3.org/2000/svg');",
    "document.createElementNS('https://example.invalid', 'svg');",
  ]) {
    await writeFile(target, original + '\n' + extra);
    await assert.rejects(checkPages(f.outputDir), /외부 URL/);
  }
  await writeFile(target, original);
  const otherModule = path.join(f.outputDir, 'ui/controller.mjs');
  await writeFile(otherModule, (await readFile(otherModule, 'utf8')) + "\ndocument.createElementNS('http://www.w3.org/2000/svg', 'svg');");
  await assert.rejects(checkPages(f.outputDir), /외부 URL/);
});
