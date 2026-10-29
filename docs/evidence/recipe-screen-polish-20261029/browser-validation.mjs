import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = path.join(root, 'dist');
const evidence = path.dirname(fileURLToPath(import.meta.url));
const beanId = '11111111-1111-4111-8111-111111111111';
const recipeId = '33333333-3333-4333-8333-333333333333';
const missingRecipeId = '33333333-3333-4333-8333-333333333334';
const longName = `V60 · 구지 내추럴 ${'레시피 이름 '.repeat(9)}긴이름검증`; 
const longGuide = `${'뜸 40초 후 중앙에서 바깥 방향으로 천천히 붓고, 물줄기를 유지하며 단계를 이어갑니다. '.repeat(8)}\n${'공백없는가이드검증'.repeat(24)}`;
const steps = [
  { id: '44444444-4444-4444-8444-444444444441', name: '뜸', order: 1, seconds: 40, interval: 40, water: 45, cumulativeWater: 45 },
  { id: '44444444-4444-4444-8444-444444444442', name: '1차 붓기', order: 2, seconds: 80, interval: 40, water: 100, cumulativeWater: 145 },
  { id: '44444444-4444-4444-8444-444444444443', name: '2차 붓기', order: 3, seconds: 150, interval: 70, water: 105, cumulativeWater: 250 },
];
const recipe = {
  id: recipeId, name: longName, beanId, dripper: 'Hario V60', dose: 15,
  grind: '중간보다 가늘게', grinder: 'Comandante', grinderSetting: '24클릭', microns: 450,
  temperature: 93, totalWater: 250, extractionGuide: longGuide, stats: { count: 2, average: 4.5 },
  validationStatus: 'ready', steps,
};
const missingRecipe = {
  id: missingRecipeId, name: '누락값 확인 레시피', beanId, dripper: '', dose: 0,
  grind: '', grinder: '', grinderSetting: '', microns: null, temperature: 0, totalWater: null,
  stats: { count: 0, average: null }, validationStatus: 'error', steps: [],
};
const fixtureData = {
  beans: [{ id: beanId, name: '에티오피아 구지', origin: '구지', roaster: '검증 로스터', variety: '74110', process: '내추럴', tastingNotes: '살구, 홍차' }],
  bags: [],
  recipes: [recipe, missingRecipe],
  records: [{
    id: '66666666-6666-4666-8666-666666666666', beanId, beanResolution: 'relation', recipeId,
    date: '2026-10-29', rating: 5, cupNote: '살구, 홍차', snapshotStatus: 'valid',
    snapshot: { version: 2, recordGeneration: 'bagless-v1', bean: { id: beanId, name: '에티오피아 구지' },
      recipe: { ...recipe, name: '시즌 기록 당시 레시피', extractionGuide: '교반 없이 천천히 붓기', steps: steps.map(step => ({ ...step })) } },
  }],
  screen: { complete: true, hasMore: false },
};
const fixture = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>레시피 화면 브라우저 검증</title></head>
<body><main class="page"><header class="site-header"><span class="eyebrow">BEAN POCKET</span><div class="header-tools"><span id="connection-tools"></span></div></header><section id="app-root" class="bean-section" aria-label="나의 커피 노트"></section></main>
<script type="module">
import { createAppView } from '/ui/view.mjs';
const view = createAppView(document);
window.fixtureMutations = [];
view.bind({ getState: () => ({ pending: false, frozen: false, unresolved: false }), setDirty() {},
  async submit(...args) { window.fixtureMutations.push(args); return { status: 'succeeded' }; } });
view.showConnection({ connected: true });
view.renderData(${JSON.stringify(fixtureData)});
view.renderRoute('/recipes');
</script></body></html>`;
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.webmanifest', 'application/manifest+json'],
]);
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/fixture') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fixture);
    return;
  }
  if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
  const file = path.resolve(dist, `.${decodeURIComponent(pathname)}`);
  if (!file.startsWith(dist + path.sep)) { response.writeHead(400).end(); return; }
  try {
    response.writeHead(200, { 'content-type': contentTypes.get(path.extname(file)) ?? 'application/octet-stream' });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  const consoleErrors = [];
  const externalRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).origin !== baseUrl) externalRequests.push(request.url()); });
  await page.goto(`${baseUrl}/fixture`);
  await page.locator('.recipe-summary-card').first().waitFor();
  assert.equal(await page.locator('.recipe-summary-card').count(), 2);

  const results = [];
  for (const width of [320, 390, 768, 1440]) {
    await page.locator('.recipe-summary-card').first().waitFor();
    await page.locator('.recipe-guide-preview').first().waitFor();
    await page.setViewportSize({ width, height: 1000 });
    const listCard = page.locator('.recipe-summary-card').first();
    const listMetrics = await page.evaluate(() => ({
      viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
      previewClamp: getComputedStyle(document.querySelector('.recipe-guide-preview')).webkitLineClamp,
      previewHeight: document.querySelector('.recipe-guide-preview').getBoundingClientRect().height,
      previewLineHeight: parseFloat(getComputedStyle(document.querySelector('.recipe-guide-preview')).lineHeight),
      longTitle: document.querySelector('.recipe-summary-card h3').getBoundingClientRect().width,
    }));
    assert.ok(listMetrics.document <= width && listMetrics.body <= width, `${width}px list overflow: ${JSON.stringify(listMetrics)}`);
    assert.equal(listMetrics.previewClamp, '2');
    assert.ok(listMetrics.previewHeight <= listMetrics.previewLineHeight * 2 + 2, `${width}px preview exceeds two lines: ${JSON.stringify(listMetrics)}`);
    const listBox = await listCard.boundingBox();
    assert.ok(listBox.x >= 0 && listBox.x + listBox.width <= width + 1, `${width}px card escapes viewport: ${JSON.stringify(listBox)}`);
    await page.screenshot({ path: path.join(evidence, `recipe-list-${width}.png`), fullPage: true });

    const metricBox = await listCard.locator('.recipe-primary-metrics').boundingBox();
    await page.mouse.click(metricBox.x + metricBox.width / 2, metricBox.y + metricBox.height / 2);
    await page.locator('.recipe-card:not(.recipe-summary-card)').waitFor();
    assert.equal(new URL(page.url()).hash, `#/recipes/${recipeId}`, 'clicking the card metric navigates through the full-card link');
    const detailCard = page.locator('.recipe-card:not(.recipe-summary-card)');
    assert.equal(await detailCard.locator('.recipe-primary-metrics .recipe-metric').count(), 4);
    assert.equal(await detailCard.locator('.recipe-conditions').count(), 1);
    assert.equal(await detailCard.locator('.recipe-steps-section .steps-table').count(), 1);
    assert.equal(await detailCard.locator('.recipe-extraction-guide').count(), 1);
    assert.equal(await detailCard.locator('.recipe-records .recipe-record-item').count(), 1);
    const detailMetrics = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth, body: document.body.scrollWidth,
      card: (() => { const { left, right } = document.querySelector('.recipe-card:not(.recipe-summary-card)').getBoundingClientRect(); return { left, right }; })(),
      guide: (() => { const node = document.querySelector('.recipe-extraction-guide > p'); return { width: node.clientWidth, scroll: node.scrollWidth }; })(),
    }));
    assert.ok(detailMetrics.document <= width && detailMetrics.body <= width, `${width}px detail overflow: ${JSON.stringify(detailMetrics)}`);
    assert.ok(detailMetrics.card.left >= 0 && detailMetrics.card.right <= width + 1, `${width}px detail card escapes viewport: ${JSON.stringify(detailMetrics)}`);
    assert.ok(detailMetrics.guide.scroll <= detailMetrics.guide.width + 1, `${width}px guide overflows its box: ${JSON.stringify(detailMetrics)}`);
    await page.screenshot({ path: path.join(evidence, `recipe-detail-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: '레시피 목록으로 돌아가기', exact: true }).click();
    results.push({ width, listNoOverflow: true, twoLinePreview: true, detailNavigation: true, detailNoOverflow: true });
  }

  await page.setViewportSize({ width: 320, height: 900 });
  const missingCard = page.locator('.recipe-summary-card').filter({ hasText: '누락값 확인 레시피' });
  await missingCard.waitFor();
  const missingMetrics = await missingCard.locator('.recipe-metric').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.dataset.metric, node.querySelector('dd').textContent])));
  assert.deepEqual(missingMetrics, { dose: '0g', water: '—', temperature: '0℃' });
  assert.equal(await missingCard.locator('.recipe-step-count').textContent(), '0단계');
  assert.equal(await missingCard.locator('.recipe-guide-preview').count(), 0);
  assert.match(await missingCard.innerText(), /레시피 단계 확인에 실패했습니다\./);
  await missingCard.locator('.recipe-card-link').click();
  const missingDetail = page.locator('.recipe-card:not(.recipe-summary-card)');
  await missingDetail.waitFor();
  assert.equal(await missingDetail.locator('.recipe-conditions').count(), 0);
  assert.equal(await missingDetail.locator('.recipe-steps-section').innerText().then(text => text.includes('레시피 단계 확인에 실패했습니다.')), true);
  assert.equal(await missingDetail.locator('.recipe-extraction-guide').count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(evidence, 'recipe-missing-steps-guide-320.png'), fullPage: true });
  results.push({ missingStepsAndGuide: true, zeroAndMissingValues: true, errorStatusVisible: true });

  await page.setViewportSize({ width: 390, height: 900 });
  await page.locator('.tabs [data-route="/recipes"]').click();
  await page.locator('.recipe-summary-card').first().waitFor();
  const mainCard = page.locator('.recipe-summary-card').first();
  await mainCard.locator('[data-action="delete-recipe"]').click();
  const deleteDialog = page.locator('#delete-confirm-dialog');
  await deleteDialog.waitFor({ state: 'visible' });
  assert.match(await deleteDialog.innerText(), /레시피를 삭제할까요\?/);
  assert.match(await deleteDialog.innerText(), /추출 기록에서 사용 중인 레시피/);
  await page.screenshot({ path: path.join(evidence, 'recipe-delete-dialog-390.png'), fullPage: true });
  await deleteDialog.locator('[data-action="cancel-delete"]').click();
  await deleteDialog.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.recipe-summary-card').count(), 2, 'cancel leaves fixture recipes unchanged');

  await mainCard.locator('.recipe-card-link').click();
  await page.locator('[data-action="copy-recipe"]').click();
  const copyDialog = page.locator('dialog[data-entry-dialog="recipes"]');
  await copyDialog.waitFor({ state: 'visible' });
  assert.equal(await copyDialog.locator('[name="name"]').inputValue(), `${longName} 복사`);
  assert.equal(await copyDialog.locator('[name="extractionGuide"]').inputValue(), longGuide);
  await page.screenshot({ path: path.join(evidence, 'recipe-copy-dialog-390.png'), fullPage: true });
  await copyDialog.locator('[data-action="cancel-form"]').click();
  await copyDialog.waitFor({ state: 'hidden' });

  await page.locator('.tabs [data-route="/recipes"]').click();
  await page.locator('.recipe-summary-card').first().waitFor();
  await page.locator('.recipe-summary-card').first().locator('.recipe-card-link').click();
  await page.locator('[data-action="new-record"]').click();
  const recordDialog = page.locator('dialog[data-entry-dialog="records"]');
  await recordDialog.waitFor({ state: 'visible' });
  assert.equal(await recordDialog.locator('select[name="recipeId"]').inputValue(), recipeId);
  await page.screenshot({ path: path.join(evidence, 'recipe-record-dialog-390.png'), fullPage: true });
  await recordDialog.locator('[data-action="cancel-form"]').click();
  await recordDialog.waitFor({ state: 'hidden' });

  assert.deepEqual(await page.evaluate(() => window.fixtureMutations), [], 'no create or delete request was submitted');
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(externalRequests, [], 'the browser used only the local isolated fixture');
  results.push({ deleteDialogCancel: true, copyPreservesGuide: true, recordPrefillsRecipe: true, fakeMutations: 0,
    pageErrors: pageErrors.length, consoleErrors: consoleErrors.length, externalRequests: externalRequests.length });
  await writeFile(path.join(evidence, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log(`PASS: isolated fake Notion-shaped fixture; 320/390/768/1440px list and detail; 2-line guide preview; long title/guide at 320px; missing steps/guide and 0/missing values; full-card detail navigation; delete modal cancel; copy keeps guide; record form preselects recipe; zero fake writes; no external requests or browser errors.`);
} catch (error) {
  if (browser) {
    const pages = browser.contexts().flatMap(context => context.pages());
    await pages[0]?.screenshot({ path: path.join(evidence, 'browser-failure.png'), fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
