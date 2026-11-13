import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { createBrowserServer } from './server.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const server = createBrowserServer({ candidate: root });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/candidate/pwa/index.html`);
  await page.waitForFunction(() => window.harnessReady || window.harnessError);
  assert.equal(await page.evaluate(() => window.harnessError), undefined);
  await page.evaluate(() => harness.view.renderRoute(`/brew/run?beanId=${harness.bean.id}&recipeId=${harness.recipe.id}`));
  await page.locator('.brew-run-actions').waitFor();
  await page.locator('.startup-overlay').waitFor({ state: 'hidden' });
  for (const width of [390, 320, 700, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const expanded of [false, true]) {
      await page.locator('[data-brew-conditions]').evaluate((node, open) => { node.open = open; }, expanded);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.locator('.brew-run-actions').evaluate(node => {
        const box = node.getBoundingClientRect();
        const form = node.closest('form').getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, formBottom: form.bottom, height: innerHeight, left: box.left, right: box.right, width: innerWidth };
      });
      console.log(JSON.stringify({ width, expanded, ...layout }));
      assert.ok(Math.abs(layout.bottom - layout.formBottom) < 2, 'At the end of the page, actions occupy their natural position at the end of the evaluation form');
      assert.ok(layout.top >= 0 && layout.bottom <= layout.height, 'Actions remain visible at the end of the page');
      assert.ok(layout.left >= 0 && layout.right <= layout.width, 'Actions fit the viewport');
      if (width <= 700) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        const box = await page.locator('.brew-run-actions').boundingBox();
        assert.ok(box.y >= 0 && box.y + box.height <= 844 - 70, 'Actions remain reachable above mobile navigation while scrolling');
      }
    }
  }
  console.log('PASS brew actions follow the form at page end and remain reachable while scrolling');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
