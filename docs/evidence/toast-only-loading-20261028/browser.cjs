const { chromium, webkit } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../../..');
const out = __dirname;
const fixture = `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/pwa/styles.css">
<main class="page"><header class="site-header"><div id="connection-tools"></div></header><div id="app-root"></div></main>
<script type="module">
import { createAppView } from '/pwa/ui/view.mjs';
import { createAppController } from '/pwa/ui/controller.mjs';
const revision = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const connection = { token: 'fake-only', revision, dataSources: {
  beans: '11111111-1111-4111-8111-111111111111', recipes: '22222222-2222-4222-8222-222222222222',
  steps: '33333333-3333-4333-8333-333333333333', records: '44444444-4444-4444-8444-444444444444',
} };
let releaseConnectionRead;
let releaseInitialRead;
let releaseRefreshRead;
const connectionGate = new Promise(resolve => { releaseConnectionRead = resolve; });
const initialReadGate = new Promise(resolve => { releaseInitialRead = resolve; });
const refreshReadGate = new Promise(resolve => { releaseRefreshRead = resolve; });
const context = { async inspect() { return { initialized: true, blocked: false }; },
  async readJournal() { return { operations: [], activeConnectionRevision: revision, connectionGuard: null }; } };
const view = createAppView(document);
view.renderRoute('/beans');
let screenReads = 0;
const app = createAppController({ view,
  state: { withWriteLock: action => action(context) },
  file: { async readConnection() { window.connectionReadStarted = true; await connectionGate; return connection; } },
  makeClient: () => ({ async verify() { return true; } }),
  makeRepository: () => ({ async listBeans() {
    screenReads++;
    if (screenReads === 1) { window.initialReadStarted = true; await initialReadGate; }
    else if (screenReads === 2) { window.refreshReadStarted = true; await refreshReadGate; }
    return { items: [], nextCursor: null, hasMore: false, complete: true };
  } }),
  makeCommands: () => ({}),
});
window.app = app;
window.releaseConnectionRead = releaseConnectionRead;
window.releaseInitialRead = releaseInitialRead;
window.releaseRefreshRead = releaseRefreshRead;
window.initialization = app.initialize();
window.fixtureReady = true;
</script>`;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(fixture);
      return;
    }
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
    response.end(await fs.readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});

async function runCase(browserType, engine, width) {
  const browser = await browserType.launch(engine === 'chromium'
    ? { headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }
    : { headless: true });
  const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const checks = [];
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.fixtureReady && window.connectionReadStarted);
    const status = page.locator('.app-status');
    await status.waitFor({ state: 'visible' });
    const startup = await status.evaluate(element => ({
      message: element.querySelector('.status-message').textContent,
      role: element.getAttribute('role'),
      ariaBusy: element.getAttribute('aria-busy'),
      parentIsBody: element.parentElement === document.body,
      insideInertSurface: !!element.closest('[inert]'),
      pageInert: document.querySelector('.page').inert,
      overlayCount: document.querySelectorAll('.startup-loading').length,
    }));
    assert.deepEqual(startup, {
      message: '저장된 연결 확인 중', role: 'status', ariaBusy: 'true',
      parentIsBody: true, insideInertSurface: false, pageInert: true, overlayCount: 0,
    });
    assert.equal(await page.locator('.connection-toggle').isDisabled(), true);
    checks.push('startup toast remains accessible while connection controls and page are locked');
    if (engine === 'chromium' && width === 390) {
      await page.screenshot({ path: path.join(out, 'startup-390.png'), fullPage: true });
    }

    await page.evaluate(() => window.releaseConnectionRead());
    await page.waitForFunction(() => window.initialReadStarted);
    await page.waitForFunction(() => document.querySelector('.app-status')?.dataset.state === 'loading');
    assert.equal(await status.isVisible(), true);
    assert.equal(await status.textContent(), '화면을 불러오는 중…');
    assert.equal(await status.getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('.startup-loading').count(), 0);
    assert.equal(await page.locator('.page').evaluate(element => element.inert), false);
    assert.equal(await page.locator('.tabs button').first().isDisabled(), true);
    checks.push('initial screen read uses the pending toast without an overlay and keeps controls disabled');
    await page.evaluate(() => window.releaseInitialRead());
    await page.waitForFunction(() => document.querySelector('.app-status')?.dataset.state === 'loaded');
    assert.equal(await status.textContent(), '화면을 불러왔습니다.');
    assert.equal(await status.getAttribute('aria-busy'), 'false');
    assert.equal(await status.locator('.status-icon').getAttribute('data-state'), 'success');
    assert.equal(await page.locator('.tabs button').first().isDisabled(), false);
    checks.push('startup completion replaces pending toast with success and releases controls');

    await page.evaluate(() => { window.refresh = window.app.refresh(); });
    await page.waitForFunction(() => window.refreshReadStarted);
    await page.waitForFunction(() => document.querySelector('.app-status')?.dataset.state === 'loading');
    assert.equal(await status.isVisible(), true);
    assert.equal(await status.textContent(), '화면을 불러오는 중…');
    assert.equal(await status.getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('.startup-loading').count(), 0);
    assert.equal(await page.locator('.tabs button').first().isDisabled(), true);
    checks.push('refresh pending state uses only the toast and prevents duplicate navigation');
    await page.evaluate(() => window.releaseRefreshRead());
    await page.evaluate(() => window.refresh);
    await page.waitForFunction(() => document.querySelector('.app-status')?.dataset.state === 'loaded');
    assert.equal(await status.getAttribute('aria-busy'), 'false');
    assert.equal(await page.locator('.tabs button').first().isDisabled(), false);
    assert.equal(await page.locator('.startup-loading').count(), 0);
    checks.push('refresh completion clears pending lock without creating an overlay');
    assert.deepEqual(errors, []);
    return { engine, width, checks, errors };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    for (const [engine, browserType] of Object.entries({ chromium, webkit })) {
      for (const width of [390, 768]) results.push(await runCase(browserType, engine, width));
    }
    const report = { cases: results.length, results };
    await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify({ results, error: String(error) }, null, 2) + '\n');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})();
