const { readdir, readFile, writeFile, mkdir } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const dist = path.resolve(process.argv[2]);
  const evidence = path.resolve(process.argv[3]);
  const base = 'https://kangseokgyu.github.io/bean-pocket/';
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const version = html.match(/id="build-version">([^<]+)/)[1];
  async function list(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.map(e => e.isDirectory() ? list(path.join(dir, e.name), prefix + e.name + '/') : prefix + e.name))).flat();
  }
  const files = await list(dist);
  const results = [];
  for (let i = 0; i < files.length; i += 5) {
    results.push(...await Promise.all(files.slice(i, i + 5).map(async file => {
      const response = await fetch(base + file + '?verify=' + version, { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200, file);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.deepEqual(bytes, await readFile(path.join(dist, file)), file + ' differs');
      return { file, status: response.status, identicalToLocalBuild: true, sha256: createHash('sha256').update(bytes).digest('hex') };
    })));
  }
  await mkdir(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const response = await page.goto(base + '?verify=' + version);
    assert.equal(response.status(), 200);
    await page.locator('#build-version').waitFor();
    await page.waitForFunction(() => !document.querySelector('.startup-loading')?.checkVisibility());
    assert.equal(await page.locator('#build-version').innerText(), version);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: path.join(evidence, 'public-390.png'), fullPage: true });
    const report = { url: base, version, files: results, browserErrors: errors, realNotionWriteVerified: false, iphoneVerified: false };
    await writeFile(path.join(evidence, 'public.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ url: base, version, filesMatched: results.length, browserErrors: errors }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
