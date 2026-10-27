const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

(async () => {
  const [version, output] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://kangseokgyu.github.io/bean-pocket/', { waitUntil: 'networkidle' });
    await page.getByText(version, { exact: false }).first().waitFor();
    await page.waitForFunction(() => !document.querySelector('.startup-loading') || document.querySelector('.startup-loading').hidden);
    assert.equal(await page.locator('.card-skeletons').count(), 1);
    assert.equal(await page.locator('.card-skeletons').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: output + '/public-390.png', fullPage: true });
    await fs.writeFile(output + '/public-browser.json', JSON.stringify({ version, width: 390, skeletonPresent: true, cleared: true, noOverflow: true, errors, liveNotion: false }, null, 2) + '\n');
    console.log(JSON.stringify({ version, passed: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
