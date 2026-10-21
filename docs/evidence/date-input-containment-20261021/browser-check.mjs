import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const { chromium, webkit } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = new URL('../../../', import.meta.url);
const html = `<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/pwa/styles.css"><main class="page"><header class="site-header"><span class="eyebrow">BEAN POCKET</span></header><section id="app-root" class="bean-section"></section></main><script type="module">
import { createAppView } from '/pwa/ui/view.mjs';
const view = createAppView(document);
view.renderData({beans: [], bags: [], recipes: [], records: []});
view.renderRoute(location.hash.slice(1));
if (location.hash === '#/bags') view.showBagForm();
view.setState({frozen: false, pending: false, unresolved: false});
</script></html>`;
const server = createServer(async (req, res) => {
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end(html); return; }
  if (!['/pwa/styles.css', '/pwa/ui/view.mjs'].includes(req.url)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', req.url.endsWith('.css') ? 'text/css' : 'text/javascript');
  res.end(await readFile(new URL(req.url.slice(1), root)));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let failures = 0;
try {
  for (const [engine, type] of Object.entries({webkit, chromium})) {
    const browser = await type.launch({headless: true, ...(engine === 'chromium' ? {channel: 'chrome'} : {})});
    try {
      for (const width of [320, 390, 430, 768]) {
        const page = await browser.newPage({viewport: {width, height: 844}, isMobile: true, deviceScaleFactor: 1, locale: 'ko-KR'});
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        for (const route of ['/records/new', '/bags']) {
          await page.goto(`http://127.0.0.1:${server.address().port}/#${route}`);
          const date = page.locator('input[type="date"]');
          await date.waitFor({state: 'visible'});
          for (const value of ['', '2026-10-21']) {
            await date.fill(value);
            const result = await date.evaluate(el => {
              const rect = el.getBoundingClientRect();
              const parent = el.parentElement.getBoundingClientRect();
              const peer = el.closest('fieldset').querySelector('select').getBoundingClientRect();
              return {width: rect.width, parentWidth: parent.width, left: rect.left, right: rect.right, parentLeft: parent.left, parentRight: parent.right, peerWidth: peer.width, boxSizing: getComputedStyle(el).boxSizing, appearance: getComputedStyle(el).appearance, scrollWidth: document.documentElement.scrollWidth, viewport: innerWidth, type: el.type, value: el.value};
            });
            try {
              assert.ok(result.left >= result.parentLeft - 1 && result.right <= result.parentRight + 1, 'date input stays within its label');
              assert.ok(Math.abs(result.width - result.peerWidth) <= 1, 'date input matches adjacent select width');
              assert.ok(result.scrollWidth <= result.viewport, 'no horizontal page overflow');
              assert.equal(result.appearance, 'none', 'date input uses app sizing instead of the iOS native control appearance');
              assert.equal(result.type, 'date');
              assert.equal(result.value, value);
              assert.deepEqual(errors, []);
              console.log('PASS', engine, width, route, value || 'empty', JSON.stringify(result));
            } catch (error) { failures++; console.log('FAIL', engine, width, route, value || 'empty', error.message, JSON.stringify(result)); }
          }
          if (engine === 'webkit' && width === 390 && route === '/records/new') await page.screenshot({path: new URL(`webkit-${process.env.CHECK_STAGE || 'check'}.png`, import.meta.url).pathname, fullPage: true});
        }
        await page.close();
      }
    } finally { await browser.close(); }
  }
} finally { server.close(); }
assert.equal(failures, 0, `${failures} layout checks failed`);
