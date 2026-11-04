import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const pwaVariant = process.argv.includes('--dist') ? 'dist' : 'pwa';
const pwaRoot = path.resolve(root, pwaVariant);
const harnessFiles = new Map([
  ['/recipe-flow-harness.html', 'docs/evidence/recipe-exploration-20261104/recipe-flow-harness.html'],
  ['/recipe-flow-harness.mjs', 'docs/evidence/recipe-exploration-20261104/recipe-flow-harness.mjs'],
  ['/pwa/recipe-flow-harness.mjs', 'docs/evidence/recipe-exploration-20261104/recipe-flow-harness.mjs'],
]);

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/favicon.ico') return response.writeHead(204).end();
  let relativeFile = harnessFiles.get(url.pathname);
  if (!relativeFile && url.pathname.startsWith('/pwa/')) {
    const pwaPath = path.resolve(pwaRoot, url.pathname.slice('/pwa/'.length));
    if (pwaPath === pwaRoot || pwaPath.startsWith(`${pwaRoot}${path.sep}`)) relativeFile = path.relative(root, pwaPath);
  } else if (!relativeFile && url.pathname.startsWith('/icons/')) {
    const iconPath = path.resolve(pwaRoot, url.pathname.slice(1));
    if (iconPath.startsWith(`${pwaRoot}${path.sep}`)) relativeFile = path.relative(root, iconPath);
  } else if (!relativeFile && url.pathname === '/lib/domain.mjs') {
    relativeFile = pwaVariant === 'dist' ? 'dist/domain.mjs' : 'lib/domain.mjs';
  }
  else if (!relativeFile && url.pathname === '/') relativeFile = harnessFiles.get('/recipe-flow-harness.html');
  if (!relativeFile) return response.writeHead(404).end('not found');
  try {
    const body = await readFile(path.join(root, relativeFile));
    response.writeHead(200, { 'content-type': contentType(relativeFile) }).end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

const chromeExecutable = process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ headless: true, executablePath: chromeExecutable });
const viewportResults = [];

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const ids = {
    bean: '11111111-1111-4111-8111-111111111111',
    earlier: '66666666-6666-4666-8666-666666666666',
    source: '77777777-7777-4777-8777-777777777777',
    result: '88888888-8888-4888-8888-888888888888',
  };

  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1,
      isMobile: width < 600, hasTouch: width < 600, serviceWorkers: 'block' });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const failedResponses = [];
    const failedRequests = [];
    page.on('pageerror', () => pageErrors.push('page-error'));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push({ status: response.status(), path: new URL(response.url()).pathname });
    });
    page.on('requestfailed', request => failedRequests.push(`${new URL(request.url()).pathname}:${request.failure()?.errorText}`));
    try {
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('form[data-form="brews"]').waitFor({ timeout: 8000 });
    const assertNoHorizontalOverflow = async phase => {
      const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(layout.scrollWidth <= layout.width + 1, `horizontal overflow at ${phase}, viewport ${width}px`);
    };

    const recipeFields = {
      name: 'V60 · 조정 1', dose: '18', grind: '중간보다 가늘게', grinderSetting: '25',
      temperature: '90', totalWater: '260',
    };
    for (const [name, value] of Object.entries(recipeFields)) {
      await page.locator(`form[data-form="brews"] [name="${name}"]`).fill(value);
    }
    const stages = page.locator('form[data-form="brews"] .brew-stage-row');
    await stages.nth(0).locator('[name="stepName"]').fill('뜸');
    await stages.nth(0).locator('[name="water"]').fill('60');
    await stages.nth(1).locator('[name="time"]').fill('0:35');
    await stages.nth(1).locator('[name="water"]').fill('100');
    await stages.nth(2).locator('[name="time"]').fill('1:20');
    await stages.nth(2).locator('[name="water"]').fill('100');
    assert.match(await page.locator('[data-brew-changes]').textContent(), /원두량.*분쇄도.*물 온도.*총 물 양/);
    assert.match(await page.locator('[data-brew-stage-total]').textContent(), /260g/);
    await page.locator('input[name="rating"]').fill('4.3');
    await page.locator('input[name="date"]').fill('2026-11-04');
    await page.locator('textarea[name="cupNote"]').fill('복숭아, 꿀');
    await assertNoHorizontalOverflow('brew preparation');
    await page.screenshot({ path: path.join(evidenceDir, `recipe-prepare-${width}.png`), fullPage: true });
    await page.locator('[data-entry-submit]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/records?compareSourceRecordId='));
    const comparison = page.locator('[data-brew-condition-comparison]');
    await comparison.waitFor();
    assert.equal(await comparison.getAttribute('data-compare-left-id'), ids.source);
    assert.equal(await comparison.getAttribute('data-compare-right-id'), ids.result);
    assert.equal(await page.locator('[data-compare-field="dose"]').getAttribute('data-changed'), 'true');
    assert.match(await page.locator('[data-compare-field="dose"]').textContent(), /15 g.*18 g/);
    assert.match(await comparison.textContent(), /복숭아, 꿀/);
    await assertNoHorizontalOverflow('condition comparison');
    await page.screenshot({ path: path.join(evidenceDir, `recipe-compare-${width}.png`), fullPage: true });

    const recordManagementSummary = page.locator('.record-management > summary');
    await recordManagementSummary.click();
    assert.equal(await page.locator('.record-management').getAttribute('open'), '',
      'the record actions are available after opening the record management disclosure');
    await page.locator(`button[data-action="replay-record"][data-record-id="${ids.result}"]`).click();
    await page.waitForFunction(() => location.hash.startsWith('#/brew/run?recordId='));
    assert.equal(await page.locator('input[name="dose"]').inputValue(), '18');
    assert.equal(await page.locator('input[name="temperature"]').inputValue(), '90');
    assert.equal(await page.locator('.brew-stage-row').nth(0).locator('[name="water"]').inputValue(), '60');
    await page.goBack();
    await page.waitForFunction(() => location.hash.startsWith('#/records?compareSourceRecordId='));

    const leftSelect = page.locator('select[data-insight-compare-left]');
    const rightSelect = page.locator('select[data-insight-compare-right]');
    assert.equal(await leftSelect.inputValue(), ids.source);
    assert.equal(await rightSelect.inputValue(), ids.result);
    await leftSelect.selectOption(ids.earlier);
    assert.equal(await page.locator('[data-brew-condition-comparison]').getAttribute('data-compare-left-id'), ids.earlier);
    assert.equal(await page.locator('[data-compare-field="dose"]').getAttribute('data-changed'), 'true');
    await leftSelect.selectOption(ids.source);

    await page.locator(`button[data-action="set-best-record"][data-record-id="${ids.result}"]`).click();
    assert.equal(await page.locator('.record-insight-best-record').getAttribute('data-insight-record-id'), ids.earlier,
      'the calculated highest rating remains separate from the user-selected best');
    await page.locator(`button[data-action="save-shared-recipe"][data-record-id="${ids.result}"]`).click();
    await page.waitForFunction(() => Boolean(window.__flowSharedRecipe));
    const shared = await page.evaluate(() => ({ dose: window.__flowSharedRecipe.dose,
      temperature: window.__flowSharedRecipe.temperature, totalWater: window.__flowSharedRecipe.totalWater,
      firstStageWater: window.__flowSharedRecipe.steps[0].water }));
    assert.deepEqual(shared, { dose: 18, temperature: 90, totalWater: 260, firstStageWater: 60 });

    await page.evaluate(beanId => { location.hash = `/beans/${beanId}`; }, ids.bean);
    await page.waitForFunction(() => location.hash.startsWith('#/beans/'));
    const best = page.locator('.bean-user-best');
    await best.waitFor();
    assert.match(await best.textContent(), /사용자 베스트 추출/);
    assert.match(await best.textContent(), /4\.3\/5/);
    assert.match(await best.textContent(), /복숭아, 꿀/);
    await assertNoHorizontalOverflow('bean best detail');
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedResponses, []);
    await page.screenshot({ path: path.join(evidenceDir, `recipe-best-${width}.png`), fullPage: true });
    viewportResults.push({ viewport: `${width}x900`, adjusted: true, rated: true, replayed: true,
      comparedArbitraryPair: true, bestPersisted: true, sharedTemplateSaved: true,
      horizontalOverflow: false, pageErrors: pageErrors.length, failedResponses: failedResponses.length });
    } catch (error) {
      let diagnostics = {};
      try {
        diagnostics = await page.evaluate(() => ({ title: document.title, hash: location.hash,
          appRootPresent: Boolean(document.querySelector('#app-root')),
          appContentCount: document.querySelectorAll('.app-content').length,
          formCount: document.querySelectorAll('form[data-form="brews"]').length,
          stylesheetsLoaded: [...document.styleSheets].filter(sheet => sheet.href).length }));
      } catch {}
      const screenshot = path.join(evidenceDir, `recipe-flow-failure-${width}.png`);
      try { await page.screenshot({ path: screenshot, fullPage: true }); } catch {}
      console.error(JSON.stringify({ viewport: `${width}x900`, error: error.message,
        diagnostics, pageErrors, consoleErrors, failedResponses, failedRequests,
        screenshot: path.basename(screenshot) }));
      throw error;
    } finally {
    await context.close();
    }
  }

  console.log(JSON.stringify({ browser: 'Chrome', version: browser.version(), scenarios: viewportResults }));
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
