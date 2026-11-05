import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const results = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4207/');
  await page.waitForSelector('.entity-favorite');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/beans', '/recipes']) {
      await page.evaluate(route => window.preview.view.renderRoute(route), route);
      const boxes = await page.locator('.entity-card-header:has(.entity-favorite)').evaluateAll(headers => headers.map(header => {
        const favorite = header.querySelector('.entity-favorite').getBoundingClientRect();
        const trash = header.querySelector('.entity-delete').getBoundingClientRect();
        return { gap: trash.left - favorite.right, favoriteWidth: favorite.width, favoriteHeight: favorite.height, trashWidth: trash.width, trashHeight: trash.height, icons: [...header.querySelectorAll(".entity-favorite svg, .entity-delete svg")].map(icon => ({ width: icon.getBoundingClientRect().width, height: icon.getBoundingClientRect().height })), aligned: favorite.top === trash.top };
      }));
      assert.ok(boxes.length > 0);
      for (const box of boxes) {
        assert.equal(box.gap, 0, `${route} at ${width}px must have adjacent button boxes`);
        assert.equal(box.favoriteWidth, 30);
        assert.equal(box.trashWidth, 30);
        assert.equal(box.favoriteHeight, 30);
        assert.equal(box.trashHeight, 30);
        for (const icon of box.icons) assert.deepEqual(icon, { width: 22, height: 22 });
        assert.equal(box.aligned, true);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const favorite = page.locator('.entity-favorite').first();
      const id = await favorite.getAttribute('data-id');
      const pressed = await favorite.getAttribute('aria-pressed');
      await favorite.click();
      assert.notEqual(await page.locator(`.entity-favorite[data-id="${id}"]`).getAttribute('aria-pressed'), pressed);
      if (width === 390) await page.screenshot({ path: new URL(`.${route}-390.png`, import.meta.url).pathname, fullPage: true });
      results.push({ width, route, boxes, favoriteToggle: true });
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('./browser-results.json', import.meta.url), JSON.stringify({ results, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, cases: results.length }));
} finally { await browser.close(); }
