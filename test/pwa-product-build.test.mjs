import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildPages } from '../scripts/build-pages.mjs';
import { checkPages } from '../scripts/check-pages.mjs';

const controllerModules = ['cache', 'search', 'loader', 'record-insights'].map(name => `ui/controller/${name}.mjs`);
const modules = [...controllerModules, 'commands/index.mjs', 'ui/controller.mjs', 'ui/records-insights.mjs', 'ui/records-insights-view.mjs',
  'ui/interactions/events.mjs', 'ui/interactions/pull-to-refresh.mjs',
  'ui/interactions/search-picker.mjs', 'ui/interactions/status-toast.mjs',
  'ui/forms/record-form.mjs', 'ui/screens/brew.mjs', 'ui/screens/records.mjs',
  'ui/shared/date.mjs', 'ui/shared/route.mjs',
  'ui/view.mjs', 'ui/forms/bean-form.mjs', 'ui/forms/recipe-form.mjs', 'ui/screens/beans.mjs',
  'ui/screens/home.mjs', 'ui/screens/recipes.mjs', 'ui/shared/buttons.mjs', 'ui/shared/dialogs.mjs', 'ui/shared/dom.mjs',
  'ui/shared/favorite-button.mjs', 'ui/shared/form-fields.mjs', 'ui/shared/icons.mjs',
  'ui/shared/recipe-presentation.mjs', 'ui/shared/record-card.mjs', 'platform/app-lifecycle.mjs', 'platform/update-coordinator.mjs'];

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

test('PWA view and controller import closures are acyclic and present in the published precache', async t => {
  const f = await fixture(t);
  await buildPages(f);
  await checkPages(f.outputDir);
  const worker = await readFile(path.join(f.outputDir, 'sw.js'), 'utf8');
  async function importClosure(entry) {
    const visited = new Set();
    const active = new Set();
    async function visit(file) {
      assert.ok(!active.has(file), `circular import: ${[...active, file].join(' -> ')}`);
      if (visited.has(file)) return;
      active.add(file);
      const source = await readFile(path.join(f.outputDir, file), 'utf8');
      for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
        assert.ok(!dependency.startsWith('../'), `${file} must resolve within the PWA output`);
        assert.ok(worker.includes(`./${dependency}`), `${dependency} must be precached`);
        await visit(dependency);
      }
      active.delete(file);
      visited.add(file);
    }
    await visit(entry);
    return visited;
  }
  const viewModules = await importClosure('ui/view.mjs');
  for (const file of ['ui/interactions/events.mjs', 'ui/interactions/pull-to-refresh.mjs',
    'ui/interactions/search-picker.mjs', 'ui/interactions/status-toast.mjs',
    'ui/forms/bean-form.mjs', 'ui/forms/recipe-form.mjs', 'ui/forms/record-form.mjs',
    'ui/screens/beans.mjs', 'ui/screens/brew.mjs', 'ui/screens/home.mjs', 'ui/screens/records.mjs', 'ui/screens/recipes.mjs',
    'ui/shared/buttons.mjs', 'ui/shared/date.mjs', 'ui/shared/dialogs.mjs', 'ui/shared/dom.mjs',
    'ui/shared/favorite-button.mjs', 'ui/shared/form-fields.mjs', 'ui/shared/icons.mjs',
    'ui/shared/recipe-presentation.mjs', 'ui/shared/record-card.mjs', 'ui/shared/route.mjs']) {
    assert.ok(viewModules.has(file), `${file} must be reachable from the view facade`);
  }
  const controllerImports = await importClosure('ui/controller.mjs');
  for (const file of controllerModules) {
    assert.ok(controllerImports.has(file), `${file} must be reachable from the controller facade`);
  }
});

test('production records insights resolve domain logic inside the Pages bundle', async t => {
  const f = await fixture(t);
  await buildPages(f);
  const insights = await readFile(path.join(f.outputDir, 'ui/records-insights.mjs'), 'utf8');
  assert.match(insights, /from ['"]\.\.\/domain\.mjs['"]/);
  assert.doesNotMatch(insights, /from ['"]\.\.\/\.\.\/lib\//);
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


test('SVG namespace is allowed only for literal elements in the icon module, never as a request URL', async t => {
  const f = await fixture(t);
  await buildPages(f);
  await checkPages(f.outputDir);
  const target = path.join(f.outputDir, 'ui/shared/icons.mjs');
  const original = await readFile(target, 'utf8');
  assert.match(original,
    /document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'circle'\)/);
  for (const extra of [
    "fetch('http://www.w3.org/2000/svg');",
    "document.createElementNS('https://example.invalid', 'svg');",
  ]) {
    await writeFile(target, original + '\n' + extra);
    await assert.rejects(checkPages(f.outputDir), /외부 URL/);
  }
  await writeFile(target, original);
  const viewModule = path.join(f.outputDir, 'ui/view.mjs');
  const originalView = await readFile(viewModule, 'utf8');
  await writeFile(viewModule, originalView + "\ndocument.createElementNS('http://www.w3.org/2000/svg', 'svg');");
  await assert.rejects(checkPages(f.outputDir), /외부 URL/);
  await writeFile(viewModule, originalView + "\ndocument.createElementNS('http://www.w3.org/2000/svg', 'circle');");
  await assert.rejects(checkPages(f.outputDir), /외부 URL/);
  await writeFile(viewModule, originalView);
  const otherModule = path.join(f.outputDir, 'ui/controller.mjs');
  const originalOtherModule = await readFile(otherModule, 'utf8');
  await writeFile(otherModule, originalOtherModule + "\ndocument.createElementNS('http://www.w3.org/2000/svg', 'svg');");
  await assert.rejects(checkPages(f.outputDir), /외부 URL/);

  await writeFile(otherModule, originalOtherModule);
  const insightsView = path.join(f.outputDir, 'ui/records-insights-view.mjs');
  const originalInsightsView = await readFile(insightsView, 'utf8');
  assert.match(originalInsightsView,
    /document\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', name\)/);
  for (const extra of [
    "fetch('http://www.w3.org/2000/svg');",
    "document.createElementNS('https://example.invalid', 'svg');",
    "const SVG_NS = 'https://example.invalid';",
    "const SVG_NS = 'http://www.w3.org/2000/svg';\nfetch(SVG_NS);",
    "fetch('https://example.invalid/external.svg');",
  ]) {
    await writeFile(insightsView, originalInsightsView + '\n' + extra);
    await assert.rejects(checkPages(f.outputDir), /외부 URL/);
  }
  await writeFile(insightsView, originalInsightsView);
  assert.equal(await checkPages(f.outputDir), true);
});
