import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { buildPages } from '../scripts/build-pages.mjs';
import { checkPages } from '../scripts/check-pages.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(projectRoot, 'pwa');
const expectedFiles = [
  'app.mjs',
  'commands/index.mjs',
  'data/notion-client.mjs',
  'data/notion-properties.mjs',
  'data/read-repository.mjs',
  'domain.mjs',
  'icons/bp-logo.png',
  'icons/favicon-bp-ivory.png',
  'icons/home-brew.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'index.html',
  'manifest.webmanifest',
  'platform/app-lifecycle.mjs',
  'platform/connection-file.mjs',
  'platform/update-coordinator.mjs',
  'records-demo.css',
  'records-demo.html',
  'records-demo.mjs',
  'state/submission-state.mjs',
  'styles.css',
  'sw.js',
  'ui/controller.mjs',
  'ui/view.mjs',
];

async function makeTempDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bean-pocket-pages-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function pngHeader(size) {
  const png = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12);
  png.writeUInt32BE(size, 16);
  png.writeUInt32BE(size, 20);
  png[24] = 8;
  png[25] = 6;
  return png;
}

async function writeSourceFixture(sourceDir) {
  await mkdir(path.join(sourceDir, 'icons'), { recursive: true });
  await mkdir(path.join(sourceDir, 'data'), { recursive: true });
  await mkdir(path.join(sourceDir, 'platform'), { recursive: true });
  await mkdir(path.join(sourceDir, 'state'), { recursive: true });
  await mkdir(path.join(sourceDir, 'commands'), { recursive: true });
  await mkdir(path.join(sourceDir, 'ui'), { recursive: true });
  const files = {
    'commands/index.mjs': 'export const commands = {};',
    'ui/controller.mjs': 'export const controller = {};',
    'ui/view.mjs': 'export const view = {};',
    'platform/app-lifecycle.mjs': 'export const lifecycle = {};',
    'platform/update-coordinator.mjs': 'export const coordinator = {};',
    'state/submission-state.mjs': 'export const state = {};',
    'data/read-repository.mjs': 'export const repository = {};',
    'platform/connection-file.mjs': 'export const storage = {};',
    'data/notion-client.mjs': 'export class NotionClient {}',
    'data/notion-properties.mjs': 'export const schemas = {};',
    'index.html': '<!doctype html><html lang="ko"><head><link rel="stylesheet" href="./styles.css"><link rel="manifest" href="./manifest.webmanifest"><script type="module" src="./app.mjs"></script></head><body><h1>원두 목록</h1><p>Notion 연결 전입니다</p><ul id="bean-list"></ul><a href="./records-demo.html">추출 기록 데모</a><p>빌드 <span id="build-version">__BUILD_VERSION__</span></p></body></html>',
    'records-demo.html': '<!doctype html><html lang="ko"><head><link rel="stylesheet" href="./records-demo.css"><script type="module" src="./records-demo.mjs"></script></head><body><h1>추출 기록 데모</h1><p>샘플 기록입니다.</p><a href="./index.html">기록 화면</a></body></html>',
    'records-demo.css': 'body { color: #203d32; }',
    'records-demo.mjs': 'export const demoRecords = [];',
    'app.mjs': "const registrationPromise = navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(() => undefined); void registrationPromise.then(registration => lifecycle.start(registration));",
    'styles.css': 'body { color: #224b3c; }',
    'manifest.webmanifest': JSON.stringify({
      start_url: './',
      scope: './',
      icons: [
        { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    }),
    'sw.js': await readFile(path.join(sourceRoot, 'sw.js'), 'utf8'),
  };
  for (const [name, contents] of Object.entries(files)) await writeFile(path.join(sourceDir, name), contents);
  await writeFile(path.join(sourceDir, 'icons/bp-logo.png'), pngHeader(256));
  await writeFile(path.join(sourceDir, 'icons/favicon-bp-ivory.png'), pngHeader(32));
  await writeFile(path.join(sourceDir, 'icons/home-brew.png'), pngHeader(1254));
  await writeFile(path.join(sourceDir, 'icons/icon-192.png'), pngHeader(192));
  await writeFile(path.join(sourceDir, 'icons/icon-512.png'), pngHeader(512));
}

async function buildFixture(t) {
  const root = await makeTempDirectory(t);
  const sourceDir = path.join(root, 'pwa');
  const outputDir = path.join(root, 'dist');
  await writeSourceFixture(sourceDir);
  await writeFile(path.join(sourceDir, '.env.local'), 'NOTION_TOKEN=ntn_secret_0123456789abcdef');
  const version = await buildPages({ sourceDir, outputDir });
  return { root, sourceDir, outputDir, version };
}

async function buildProductionFixture(t) {
  const root = await makeTempDirectory(t);
  const outputDir = path.join(root, 'dist');
  await buildPages({ sourceDir: sourceRoot, outputDir });
  return { root, outputDir };
}

function makeCacheStorage() {
  const stores = new Map();
  const deleted = [];
  return {
    stores,
    deleted,
    async open(name) {
      if (!stores.has(name)) {
        stores.set(name, {
          files: [],
          matchCalls: [],
          async addAll(files) { this.files.push(...files); },
          async match(request) { this.matchCalls.push(request.url); return { cached: request.url }; },
        });
      }
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
}

class TestRequest {
  constructor(input, options = {}) {
    this.url = String(input);
    this.cache = options.cache ?? 'default';
  }
}

async function loadWorker(workerSource, scope, cacheStorage, networkCalls) {
  const listeners = new Map();
  const scopeUrl = new URL(scope);
  const self = {
    location: { origin: scopeUrl.origin },
    registration: { scope },
    clients: { async matchAll() { return []; } },
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  vm.runInNewContext(workerSource, {
    self,
    caches: cacheStorage,
    URL,
    Request: TestRequest,
    Promise,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    fetch: async request => { networkCalls.push(request.url); return { network: request.url }; },
  });
  return listeners;
}

async function dispatchLifecycle(listeners, type) {
  let pending;
  listeners.get(type)({ waitUntil(value) { pending = value; } });
  await pending;
}

async function dispatchFetch(listeners, url, method = 'GET') {
  let response;
  listeners.get('fetch')({
    request: { url, method },
    respondWith(value) { response = value; },
  });
  return response === undefined ? { intercepted: false } : { intercepted: true, response: await response };
}

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(directory, relativePath));
    else files.push(relativePath);
  }
  return files.sort();
}

test('Pages 빌드는 토큰 없는 하위 경로 PWA와 정확한 허용 목록을 만든다', async t => {
  const { outputDir, version } = await buildFixture(t);
  assert.equal(await checkPages(outputDir), true);
  assert.deepEqual(await listFiles(outputDir), expectedFiles);

  const html = await readFile(path.join(outputDir, 'index.html'), 'utf8');
  const app = await readFile(path.join(outputDir, 'app.mjs'), 'utf8');
  const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.webmanifest'), 'utf8'));
  const worker = await readFile(path.join(outputDir, 'sw.js'), 'utf8');
  assert.match(html, /원두 목록/);
  assert.match(html, /연결 전/);
  assert.match(version, /^[a-f0-9]{12}$/);
  assert.match(html, new RegExp(version));
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/app\.mjs"/);
  assert.match(html, /href="\.\/records-demo\.html"/, '실제 기록 화면에 작은 데모 진입점이 있어야 한다');
  assert.doesNotMatch(html, /<li\b[^>]*>\s*[^<]/i, '예시 원두가 없어야 한다');
  assert.match(app, /new URL\('\.\/sw\.js', import\.meta\.url\)/);
  assert.match(app, /\.then\(registration => lifecycle\.start\(registration\)\)/);
  assert.doesNotMatch(app, /\/api\//i);
  assert.deepEqual([manifest.start_url, manifest.scope], ['./', './']);
  assert.equal(manifest.version, undefined);
  assert.ok(manifest.icons.every(icon => icon.src.startsWith('./')));
  assert.match(worker, /cache\.addAll/);
  assert.match(worker, new RegExp(version));
  assert.doesNotMatch(worker, /location\.reload|clients\.claim/i);
  assert.equal(worker, (await readFile(path.join(sourceRoot, 'sw.js'), 'utf8')).replaceAll('__BUILD_VERSION__', version));
  const demoHtml = await readFile(path.join(outputDir, 'records-demo.html'), 'utf8');
  assert.match(demoHtml, /href="\.\/records-demo\.css"/);
  assert.match(demoHtml, /src="\.\/records-demo\.mjs"/);
  assert.match(worker, /\.\/records-demo\.html/);
  assert.match(worker, /\.\/records-demo\.css/);
  assert.match(worker, /\.\/records-demo\.mjs/);
  assert.doesNotMatch(`${html}\n${app}\n${worker}`, /https?:\/\//i);
});

test('검사기는 공개 데모 자산의 외부 URL과 루트 절대 경로를 거부한다', async t => {
  const external = await buildFixture(t);
  const scriptPath = path.join(external.outputDir, 'records-demo.mjs');
  const script = await readFile(scriptPath, 'utf8');
  await writeFile(scriptPath, `${script}\nfetch('https://example.test/data');\n`);
  await assert.rejects(checkPages(external.outputDir), /외부 URL/);

  const absolute = await buildFixture(t);
  const demoHtmlPath = path.join(absolute.outputDir, 'records-demo.html');
  const demoHtml = await readFile(demoHtmlPath, 'utf8');
  await writeFile(demoHtmlPath, demoHtml.replace('./records-demo.css', '/records-demo.css'));
  await assert.rejects(checkPages(absolute.outputDir), /절대 경로/);
});

test('검사기는 누락 파일과 허용 목록 밖 산출물을 거부한다', async t => {
  const { outputDir } = await buildFixture(t);
  await rm(path.join(outputDir, 'app.mjs'));
  await assert.rejects(checkPages(outputDir), /app\.mjs/);

  const complete = await buildFixture(t);
  await writeFile(path.join(complete.outputDir, '.env.local'), 'NOTION_TOKEN=private-value');
  await assert.rejects(checkPages(complete.outputDir), /\.env\.local/);
});

test('검사기는 루트 절대 경로와 허용 파일 안의 비밀값을 거부한다', async t => {
  const absolutePath = await buildFixture(t);
  const htmlPath = path.join(absolutePath.outputDir, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  await writeFile(htmlPath, html.replace('./styles.css', '/styles.css'));
  await assert.rejects(checkPages(absolutePath.outputDir), /절대 경로/);

  const secret = await buildFixture(t);
  const appPath = path.join(secret.outputDir, 'app.mjs');
  const app = await readFile(appPath, 'utf8');
  await writeFile(appPath, `${app}\nconst accidental = 'ntn_secret_0123456789abcdef';\n`);
  await assert.rejects(checkPages(secret.outputDir), /비밀|토큰|secret/i);
});

test('검사기는 Service Worker가 API 경로를 앱 캐시에 넣는 변경을 거부한다', async t => {
  const { outputDir } = await buildFixture(t);
  const workerPath = path.join(outputDir, 'sw.js');
  const worker = await readFile(workerPath, 'utf8');
  await writeFile(workerPath, worker.replace('./styles.css', './api/records'));
  await assert.rejects(checkPages(outputDir), /API 경로|허용된 앱 파일/);
});

test('검사기는 scope별 캐시 namespace가 빠진 Service Worker를 거부한다', async t => {
  const { outputDir } = await buildProductionFixture(t);
  const workerPath = path.join(outputDir, 'sw.js');
  const worker = await readFile(workerPath, 'utf8');
  await writeFile(workerPath, worker.replace(/const CACHE_PREFIX = .*;\n/, "const CACHE_PREFIX = 'bean-pocket-shell-';\n"));
  await assert.rejects(checkPages(outputDir), /scope|namespace|캐시/);
});

test('검사기는 HTTP 캐시를 우회하지 않는 Service Worker precache를 거부한다', async t => {
  const { outputDir } = await buildProductionFixture(t);
  const workerPath = path.join(outputDir, 'sw.js');
  const worker = await readFile(workerPath, 'utf8');
  await writeFile(workerPath, worker.replace("{ cache: 'reload' }", '{}'));
  await assert.rejects(checkPages(outputDir), /HTTP 캐시를 우회/);
});

test('빌더는 필수 소스 누락과 소스 심볼릭 링크를 거부한다', async t => {
  const missing = await buildFixture(t);
  await rm(path.join(missing.sourceDir, 'app.mjs'));
  await assert.rejects(
    buildPages({ sourceDir: missing.sourceDir, outputDir: path.join(missing.root, 'missing-dist') }),
    /app\.mjs/,
  );

  const linked = await buildFixture(t);
  const linkedApp = path.join(linked.sourceDir, 'app.mjs');
  const replacement = path.join(linked.root, 'outside.mjs');
  await writeFile(replacement, 'export {};');
  await rm(linkedApp);
  await symlink(replacement, linkedApp);
  await assert.rejects(
    buildPages({ sourceDir: linked.sourceDir, outputDir: path.join(linked.root, 'linked-dist') }),
    /심볼릭 링크|symlink/i,
  );
});

test('빌더는 symlink 부모 경로로 소스를 출력 경로로 지정해도 원본을 보존한다', async t => {
  const root = await makeTempDirectory(t);
  const sourceDir = path.join(root, 'pwa');
  const aliasDir = path.join(root, 'alias');
  await writeSourceFixture(sourceDir);
  const original = await readFile(path.join(sourceDir, 'index.html'));
  await symlink(root, aliasDir, 'dir');

  const failure = await buildPages({ sourceDir, outputDir: path.join(aliasDir, 'pwa') }).then(
    () => null,
    error => error,
  );
  const preserved = await readFile(path.join(sourceDir, 'index.html')).catch(() => null);
  assert.equal(preserved?.toString('utf8'), original.toString('utf8'), '중첩 경로를 거부할 때 원본 소스가 그대로 있어야 한다');
  assert.ok(failure, '실제 경로가 겹치는 sourceDir/outputDir는 거부해야 한다');
});

test('검사기는 산출물 심볼릭 링크와 잘못된 dist 루트를 거부한다', async t => {
  const linked = await buildFixture(t);
  const target = path.join(linked.root, 'outside.txt');
  await writeFile(target, 'private');
  await symlink(target, path.join(linked.outputDir, 'private.txt'));
  await assert.rejects(checkPages(linked.outputDir), /심볼릭 링크|symlink/i);

  const root = await makeTempDirectory(t);
  const outside = path.join(root, 'outside');
  await writeFile(outside, 'not a directory');
  const linkedOutput = path.join(root, 'dist');
  await symlink(outside, linkedOutput);
  await assert.rejects(buildPages({ sourceDir: linked.sourceDir, outputDir: linkedOutput }), /심볼릭 링크|symlink/i);
});

test('실제 PWA 소스에는 API 호출이나 외부 요청이 없고 하위 경로 자원만 쓴다', async t => {
  const root = await makeTempDirectory(t);
  const outputDir = path.join(root, 'dist');
  await buildPages({ sourceDir: sourceRoot, outputDir });
  const html = await readFile(path.join(outputDir, 'index.html'), 'utf8');
  const app = await readFile(path.join(outputDir, 'app.mjs'), 'utf8');
  const worker = await readFile(path.join(outputDir, 'sw.js'), 'utf8');
  assert.doesNotMatch(`${html}\n${app}\n${worker}`, /\/api\/|https?:\/\//i);
  assert.doesNotMatch(worker, /location\.reload|clients\.claim/i);
  assert.match(worker, /function requestSafeApply\(/);
  assert.match(worker, /sameClients\(/);
  assert.doesNotMatch(await readFile(path.join(outputDir, 'index.html'), 'utf8'), /ntn_secret_/i);
});

test('Service Worker install·activate·fetch는 scope를 격리하고 앱 파일만 다룬다', async t => {
  const { outputDir } = await buildProductionFixture(t);
  const workerSource = await readFile(path.join(outputDir, 'sw.js'), 'utf8');
  const cacheStorage = makeCacheStorage();
  const networkCalls = [];
  const scopeA = 'https://example.test/repo/a/';
  const scopeB = 'https://example.test/repo/b/';
  const workerA = await loadWorker(workerSource, scopeA, cacheStorage, networkCalls);
  const workerB = await loadWorker(workerSource, scopeB, cacheStorage, networkCalls);
  await dispatchLifecycle(workerA, 'install');
  await dispatchLifecycle(workerB, 'install');

  const currentNames = await cacheStorage.keys();
  assert.equal(currentNames.length, 2);
  const [cacheA, cacheB] = currentNames;
  const staleA = `${cacheA}-old`;
  const staleB = `${cacheB}-old`;
  cacheStorage.stores.set(staleA, { files: [], matchCalls: [] });
  cacheStorage.stores.set(staleB, { files: [], matchCalls: [] });
  cacheStorage.stores.set('unrelated-app-cache', { files: [], matchCalls: [] });

  await dispatchLifecycle(workerA, 'activate');
  const remaining = await cacheStorage.keys();
  assert.ok(remaining.includes(staleB), 'scope A의 업데이트가 scope B의 구 캐시를 지우면 안 된다');
  assert.ok(remaining.includes(cacheB), 'scope B의 현재 캐시를 보존해야 한다');
  assert.ok(remaining.includes('unrelated-app-cache'));
  assert.ok(!remaining.includes(staleA), '자기 scope의 이전 버전 캐시는 정리해야 한다');
  assert.notEqual(cacheA, cacheB, '같은 출처의 서로 다른 scope는 별도 namespace를 사용해야 한다');

  const appFiles = ['./', './index.html', './app.mjs', './commands/index.mjs', './ui/controller.mjs', './ui/view.mjs', './data/notion-client.mjs', './data/notion-properties.mjs', './data/read-repository.mjs', './domain.mjs', './platform/app-lifecycle.mjs', './platform/connection-file.mjs', './platform/update-coordinator.mjs', './state/submission-state.mjs', './styles.css', './records-demo.html', './records-demo.mjs', './records-demo.css', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/bp-logo.png', './icons/favicon-bp-ivory.png', './icons/home-brew.png'];
  assert.deepEqual(cacheStorage.stores.get(cacheA).files.map(request => [request.url, request.cache]),
    appFiles.map(file => [new URL(file, scopeA).href, 'reload']));
  assert.deepEqual(cacheStorage.stores.get(cacheB).files.map(request => [request.url, request.cache]),
    appFiles.map(file => [new URL(file, scopeB).href, 'reload']));
  assert.ok(!appFiles.includes('./sw.js'));

  for (const [url, method] of [
    ['https://cdn.example.test/app.js', 'GET'],
    ['https://api.notion.com/v1/pages', 'GET'],
    [`${scopeA}app.mjs`, 'POST'],
    [`${scopeA}app.mjs?cacheBust=1`, 'GET'],
  ]) {
    assert.deepEqual(await dispatchFetch(workerA, url, method), { intercepted: false }, `${method} ${url}`);
  }
  const served = await dispatchFetch(workerA, `${scopeA}app.mjs`);
  assert.equal(served.intercepted, true);
  assert.equal(networkCalls.length, 0, '캐시된 앱 파일은 네트워크를 호출하지 않는다');
  assert.deepEqual(cacheStorage.stores.get(cacheA).matchCalls, [`${scopeA}app.mjs`]);
});

test('빌드 hash는 같은 소스에서 재현되고 소스 변경 시 바뀐다', async t => {
  const { root, sourceDir } = await buildFixture(t);
  const repeated = await buildPages({ sourceDir, outputDir: path.join(root, 'dist-again') });
  assert.match(repeated, /^[a-f0-9]{12}$/);

  await writeFile(path.join(sourceDir, 'styles.css'), 'body { color: #224b3c; }\n/* revised */');
  const changed = await buildPages({ sourceDir, outputDir: path.join(root, 'dist-changed') });
  assert.notEqual(changed, repeated);
});


test('BP logo is supplied byte-for-byte, cached offline, and changes the build version', async t => {
  const { sourceDir, outputDir, version } = await buildFixture(t);
  const logoPath = 'icons/bp-logo.png';
  assert.deepEqual(await readFile(path.join(outputDir, logoPath)), await readFile(path.join(sourceDir, logoPath)));
  const worker = await readFile(path.join(outputDir, 'sw.js'), 'utf8');
  assert.ok(worker.includes('./icons/bp-logo.png'));
  await writeFile(path.join(sourceDir, logoPath), pngHeader(128));
  assert.notEqual(await buildPages({ sourceDir, outputDir }), version);
});

test('homepage brew illustration ships byte-for-byte, is cached offline, and changes the build version', async t => {
  const { sourceDir, outputDir, version } = await buildFixture(t);
  const imagePath = 'icons/home-brew.png';
  assert.deepEqual(await readFile(path.join(outputDir, imagePath)), await readFile(path.join(sourceDir, imagePath)));
  const worker = await readFile(path.join(outputDir, 'sw.js'), 'utf8');
  assert.ok(worker.includes('./icons/home-brew.png'));
  await writeFile(path.join(sourceDir, imagePath), pngHeader(512));
  assert.notEqual(await buildPages({ sourceDir, outputDir }), version);
});
