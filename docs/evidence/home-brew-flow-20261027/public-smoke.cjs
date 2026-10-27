const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const output = process.argv[2];
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failed.push({ url: response.url(), status: response.status() }); });
    await page.goto('https://kangseokgyu.github.io/bean-pocket/#/home', { waitUntil: 'networkidle' });
    await page.getByText('Notion 연결 정보를 입력해 주세요.', { exact: true }).waitFor({ state: 'visible', timeout: 20000 });
    const build = await page.locator('#build-version').textContent();
    const screenshot = path.join(output, 'public-home-390.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const result = { url: page.url(), build, errors, failed, overflow, connectedFlow: 'Verified separately using fake Notion; live Notion not used.' };
    await fs.writeFile(path.join(output, 'public-browser.json'), JSON.stringify(result, null, 2) + '\n');
    assert.equal(build, '3a88d931f566');
    assert.equal(errors.length, 0);
    assert.equal(failed.length, 0);
    assert.equal(overflow, false);
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
