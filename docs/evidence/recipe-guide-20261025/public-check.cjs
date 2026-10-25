const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const base = 'https://kangseokgyu.github.io/bean-pocket/';
  const dist = path.resolve('dist');
  const output = path.resolve('docs/evidence/recipe-guide-20261025');
  const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  const version = html.match(/id="build-version">([^<]+)/)[1];
  const results = [];
  for (const file of ['index.html', 'domain.mjs', 'ui/view.mjs', 'data/notion-client.mjs', 'data/notion-properties.mjs', 'commands/index.mjs', 'styles.css', 'sw.js', 'manifest.webmanifest']) {
    const response = await fetch(base + file + '?verify=' + version);
    assert.equal(response.status, 200, file);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, await fs.readFile(path.join(dist, file)), file + ' differs from checked build');
    results.push({ file, status: 200, identicalToLocalBuild: true });
  }
  const browser = await chromium.launch({ headless: true, executablePath: '/Users/kangseokgyu/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    assert.equal((await page.goto(base)).status(), 200);
    await page.locator('#build-version').waitFor();
    await page.waitForFunction(() => !document.querySelector('.startup-loading')?.checkVisibility());
    assert.equal(await page.locator('#build-version').innerText(), version);
    assert.deepEqual(errors, []);
    await fs.mkdir(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'public-390.png'), fullPage: true });
    const report = { url: base, version, results, browserErrors: errors, realNotionSaveVerified: false, iphoneVerified: false };
    await fs.writeFile(path.join(output, 'public.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
