import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error('PAGEERROR', error.message); });
  page.on('console', message => { if (message.type() === 'error') console.error('CONSOLE', message.text()); });
  page.on('response', response => { if (response.status() >= 400) console.error('HTTP', response.status(), response.url()); });
  await page.goto('http://127.0.0.1:4194/');
  await page.waitForSelector('[data-action="favorite-item"]', { timeout: 5000 });
  for (const route of ['/beans', '/recipes']) {
    await page.evaluate(route => window.preview.view.renderRoute(route), route);
    const favorite = page.locator('[data-action="favorite-item"]').first();
    assert.equal(await page.locator('[data-action="favorite-filter"]').count(), 0);
    assert.equal(await page.getByText(/checkbox 속성/).count(), 0);
    const styles = await page.evaluate(() => {
      const read = node => { const s = getComputedStyle(node); return ['width', 'height', 'padding', 'backgroundColor', 'borderWidth', 'borderColor'].map(key => [key, s[key]]); };
      return { favorite: read(document.querySelector('[data-action="favorite-item"]')), trash: read(document.querySelector('.entity-delete')) };
    });
    assert.deepEqual(styles.favorite, styles.trash, 'star and trash button boxes must match');
    await page.screenshot({ path: new URL(`.${route}-390.png`.replace('./', ''), import.meta.url).pathname, fullPage: true });
    const second = page.locator('[data-action="favorite-item"]').nth(1);
    const id = await second.getAttribute('data-id');
    await favorite.click();
    await second.click();
    assert.equal(await page.locator('[data-action="favorite-item"]').first().getAttribute('data-id'), id, 'new favorite must move to top');
    assert.equal(await page.locator('[data-action="favorite-item"]').first().getAttribute('aria-pressed'), 'true');
    results.push({ route, styles, toggleReorders: true });
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('./browser-results.json', import.meta.url), JSON.stringify({ viewport: 390, results, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, routes: results.map(result => result.route) }));
} finally { await browser.close(); }
