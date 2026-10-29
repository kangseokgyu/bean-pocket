import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const evidence = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(evidence, '../../../dist');
const contentTypes = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
  '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (!pathname.startsWith('/bean-pocket/')) { response.writeHead(404).end(); return; }
  const relative = decodeURIComponent(pathname.slice('/bean-pocket/'.length)) || 'index.html';
  const file = path.resolve(dist, relative);
  if (!file.startsWith(dist + path.sep)) { response.writeHead(404).end(); return; }
  try {
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream' });
    response.end(contents);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/bean-pocket/`;
let browser;
try {
  for (const name of ['records-demo.html', 'records-demo.css', 'records-demo.mjs']) {
    assert.equal((await fetch(base + name)).status, 404, `${name} must be removed`);
  }
  const picker = await (await fetch(base + 'brew-picker-demo.html')).text();
  assert.ok(picker.includes('href="./index.html#/records"'));
  assert.ok(!picker.includes('records-demo.html'));
  browser = await chromium.launch({ headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('requestfailed', request => failures.push(request.failure()?.errorText));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.goto(base + '#/records', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#app-root')?.children.length > 0);
  const cancelConnection = page.getByRole('button', { name: /취소/ });
  if (await cancelConnection.isVisible()) await cancelConnection.click();
  for (const width of [320, 550, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.demo-entry-link, a[href*="records-demo.html"]').count(), 0);
    assert.equal(await page.locator('#connection-tools button').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, `records-${width}.png`) });
  }
  assert.deepEqual(failures, []);
  console.log('PASS: records demo HTML/CSS/module return 404; app boots at #/records; no retired entry link; connection control remains; 320/550/1440px no overflow; no console/page/network failures; other picker links to production records. Isolated Chrome without real Notion data.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
