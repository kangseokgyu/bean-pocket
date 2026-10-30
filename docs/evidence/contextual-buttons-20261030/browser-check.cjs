const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.CONTEXTUAL_BUTTONS_PLAYWRIGHT_MODULE || 'playwright');

const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/contextual-buttons-20261030');
const beanId = '11111111-1111-4111-8111-111111111111';
const recipeId = '33333333-3333-4333-8333-333333333333';
const bean = {
  id: beanId,
  name: '에티오피아 시다마',
  origin: '시다마 · 벤사',
  roaster: 'Bean Pocket Roastery',
  variety: '74110',
  process: '워시드',
  tastingNotes: '복숭아 · 자스민 · 꿀',
};
const recipe = {
  id: recipeId,
  name: '시다마 V60',
  beanId,
  dripper: 'V60',
  dose: 15,
  grind: '중간보다 가늘게',
  grinder: 'Comandante',
  grinderSetting: '24클릭',
  microns: 450,
  temperature: 93,
  totalWater: 250,
  extractionGuide: '교반 없이 천천히 붓습니다.\n목표 추출 완료 시간: 2분 30초',
  stats: { count: 2, average: 4.5 },
  steps: [
    { id: '44444444-4444-4444-8444-444444444444', name: '뜸', seconds: 0, interval: 0, water: 50, cumulativeWater: 50 },
    { id: '55555555-5555-4555-8555-555555555555', name: '붓기', seconds: 150, interval: 40, water: 200, cumulativeWater: 250 },
  ],
};
const records = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    beanId,
    beanResolution: 'relation',
    recipeId,
    date: '2026-10-28',
    rating: 5,
    cupNote: '복숭아와 꿀의 단맛이 선명합니다.',
    snapshotStatus: 'valid',
    snapshot: {
      version: 1,
      recordGeneration: 'bagless-v1',
      id: recipeId,
      beanId,
      name: recipe.name,
      dripper: recipe.dripper,
      dose: recipe.dose,
      temperature: recipe.temperature,
      totalWater: recipe.totalWater,
      steps: [{ name: '뜸', seconds: 0, water: 50, cumulativeWater: 50 }],
    },
  },
  {
    id: '77777777-7777-4777-8777-777777777777',
    beanId,
    beanResolution: 'relation',
    recipeId,
    date: '2026-10-24',
    rating: 4,
    cupNote: '자스민 향이 은은합니다.',
    snapshotStatus: 'valid',
    snapshot: {
      version: 1,
      recordGeneration: 'bagless-v1',
      id: recipeId,
      beanId,
      name: recipe.name,
      dripper: recipe.dripper,
      dose: recipe.dose,
      temperature: recipe.temperature,
      totalWater: recipe.totalWater,
      steps: [{ name: '뜸', seconds: 0, water: 50, cumulativeWater: 50 }],
    },
  },
];
const baseData = { beans: [bean], bags: [], recipes: [recipe], records };

function fixtureData(scenario, buildRecordsInsights) {
  if (scenario === 'brew-options') {
    return {
      ...baseData,
      screen: { route: '/brew/bean', hasMore: true, nextCursor: 'next', complete: false },
    };
  }
  if (scenario === 'records-loading') {
    const recordInsights = buildRecordsInsights(records, [bean], beanId, [recipe]);
    return {
      ...baseData,
      recordInsights: { ...recordInsights, hasMore: true, loading: true, status: 'loading' },
      screen: { route: '/records', hasMore: true, nextCursor: 'next', complete: false },
    };
  }
  return baseData;
}

function fixtureHtml(route, data) {
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>Bean Pocket 버튼 검증</title></head>
<body><main class="page"><header class="site-header"><img class="brand-logo" src="/icons/bp-logo.png" alt="Bean Pocket" width="60" height="36"><div class="header-tools"><span id="connection-tools"></span></div></header><section id="app-root" class="bean-section" aria-label="나의 커피 노트"></section></main>
<script type="module">
import { createAppView } from '/ui/view.mjs';
const view = createAppView(document);
view.bind(new Proxy({}, { get: () => () => {} }));
view.showConnection({ connected: true });
view.renderData(${JSON.stringify(data)});
view.renderRoute(${JSON.stringify(route)});
if (${data.screen?.route === '/records'}) {
  view.setState({ pending: true });
  view.clearStatus();
}
</script></body></html>`;
}

function contentType(file) {
  return new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
  ]).get(path.extname(file)) ?? 'application/octet-stream';
}

async function main() {
  await fs.mkdir(evidence, { recursive: true });
  const { buildRecordsInsights } = await import(path.join(root, 'pwa/ui/records-insights.mjs'));
  const scenarios = {
    bean: { route: `/beans/${beanId}`, data: fixtureData('bean', buildRecordsInsights) },
    recipe: { route: `/recipes/${recipeId}`, data: fixtureData('recipe', buildRecordsInsights) },
    brew: { route: `/brew/bean?selectedBeanId=${beanId}&q=sidama`, data: fixtureData('brew-options', buildRecordsInsights) },
    records: { route: '/records', data: fixtureData('records-loading', buildRecordsInsights) },
  };
  const dist = path.resolve(root, 'dist');
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/fixture') {
      const scenario = scenarios[url.searchParams.get('scenario')];
      if (!scenario) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(fixtureHtml(scenario.route, scenario.data));
      return;
    }
    if (url.pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    const file = path.resolve(dist, `.${url.pathname}`);
    if (!file.startsWith(dist + path.sep)) { response.writeHead(400).end(); return; }
    try {
      response.setHeader('Content-Type', contentType(file));
      response.end(await fs.readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });
    const port = server.address().port;
    const results = [];

    for (const [size, width, height] of [['desktop', 1440, 980], ['mobile', 390, 900]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/fixture?scenario=bean`);
      const back = page.getByRole('button', { name: '원두 목록으로', exact: true });
      await back.waitFor();
      assert.equal(await back.getAttribute('data-route'), '/beans');
      assert.equal(await back.getAttribute('aria-label'), '원두 목록으로');
      assert.equal(await back.evaluate(node => node.textContent), '원두 목록으로');
      assert.equal(await back.evaluate(node => node.classList.contains('button--back')), true);
      assert.ok((await back.boundingBox()).height >= 44);
      assert.equal(await page.locator('.bean-detail-card .record-card').count(), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(evidence, `bean-detail-${size}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      results.push({ scenario: `bean-detail-${size}`, backLabel: '원두 목록으로', hitTargetMin: 44, records: 2, overflow: false });
      await page.close();
    }

    const recipePage = await browser.newPage({ viewport: { width: 1440, height: 980 } });
    const recipeErrors = [];
    recipePage.on('pageerror', error => recipeErrors.push(error.message));
    await recipePage.goto(`http://127.0.0.1:${port}/fixture?scenario=recipe`);
    const primary = recipePage.getByRole('button', { name: '이 레시피로 추출 기록', exact: true });
    const secondary = recipePage.getByRole('button', { name: '이 레시피 복사', exact: true });
    await primary.waitFor();
    assert.equal(await primary.getAttribute('data-action'), 'new-record');
    assert.equal(await primary.evaluate(node => node.classList.contains('button--primary')), true);
    assert.equal(await secondary.getAttribute('data-action'), 'copy-recipe');
    const primaryColor = await primary.evaluate(node => getComputedStyle(node).backgroundColor);
    const warmColor = await secondary.evaluate(node => getComputedStyle(node).backgroundColor);
    assert.equal(primaryColor, 'rgb(34, 75, 60)');
    assert.equal(warmColor, 'rgb(255, 253, 248)');
    await recipePage.screenshot({ path: path.join(evidence, 'direction-warm-outline-1440.png'), fullPage: true });
    await recipePage.addStyleTag({ content: `#app-root .button.button--secondary { background:#e8eee7; border-color:#b7c5b7; color:#224b3c; } #app-root .button.button--secondary:hover:not(:disabled) { background:#dfe9df; border-color:#9eafa0; }` });
    await recipePage.screenshot({ path: path.join(evidence, 'direction-soft-sage-1440.png'), fullPage: true });
    assert.equal(await recipePage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(recipeErrors, []);
    results.push({ scenario: 'direction-comparison', primaryColor, warmSecondaryColor: warmColor, sageSecondaryColor: 'rgb(232, 238, 231)', overflow: false, pageErrors: 0 });

    await recipePage.setViewportSize({ width: 390, height: 900 });
    await recipePage.goto(`http://127.0.0.1:${port}/fixture?scenario=recipe`);
    const focusedBack = recipePage.getByRole('button', { name: '레시피 목록으로 돌아가기', exact: true });
    await focusedBack.waitFor();
    for (let count = 0; count < 12 && !(await focusedBack.evaluate(node => node === document.activeElement)); count++) {
      await recipePage.keyboard.press('Tab');
    }
    assert.equal(await focusedBack.evaluate(node => node === document.activeElement), true);
    assert.equal(await focusedBack.evaluate(node => node.matches(':focus-visible')), true);
    await recipePage.screenshot({ path: path.join(evidence, 'recipe-detail-keyboard-focus-mobile.png'), fullPage: true });
    results.push({ scenario: 'keyboard-focus', target: '레시피 목록으로 돌아가기', focusVisible: true });
    await recipePage.close();

    const brewPage = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const brewErrors = [];
    brewPage.on('pageerror', error => brewErrors.push(error.message));
    await brewPage.goto(`http://127.0.0.1:${port}/fixture?scenario=brew`);
    const clear = brewPage.getByRole('button', { name: '검색어 지우기', exact: true });
    const moreOptions = brewPage.locator('.page-load-more');
    await clear.waitFor();
    assert.equal(await clear.isVisible(), true);
    assert.equal(await clear.getAttribute('data-action'), 'clear-brew-search');
    assert.ok((await clear.boundingBox()).height >= 44);
    assert.equal(await moreOptions.getAttribute('data-action'), 'more-options');
    assert.ok((await moreOptions.boundingBox()).height >= 44);
    assert.equal(await brewPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await brewPage.screenshot({ path: path.join(evidence, 'brew-search-pagination-mobile.png'), fullPage: true });
    assert.deepEqual(brewErrors, []);
    results.push({ scenario: 'brew-search-pagination-mobile', clearHitTargetMin: 44, paginationHitTargetMin: 44, overflow: false });
    await brewPage.close();

    const recordsPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const recordErrors = [];
    recordsPage.on('pageerror', error => recordErrors.push(error.message));
    await recordsPage.goto(`http://127.0.0.1:${port}/fixture?scenario=records`);
    const disabledMore = recordsPage.locator('.record-insights-more');
    await disabledMore.waitFor();
    assert.equal(await disabledMore.isDisabled(), true);
    assert.equal(await disabledMore.getAttribute('data-action'), 'load-more-insights');
    assert.equal(await disabledMore.evaluate(node => node.textContent), '불러오는 중…');
    assert.ok((await disabledMore.boundingBox()).height >= 44);
    const listMore = recordsPage.locator('.page-load-more').first();
    assert.equal(await listMore.getAttribute('data-action'), 'load-more');
    assert.ok((await listMore.boundingBox()).width >= 300);
    assert.equal(await recordsPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await recordsPage.screenshot({ path: path.join(evidence, 'records-insights-disabled-pagination-desktop.png'), fullPage: true });
    assert.deepEqual(recordErrors, []);
    results.push({ scenario: 'records-insights-disabled-pagination', disabled: true, paginationWidthMin: 300, overflow: false });
    await recordsPage.close();

    await fs.writeFile(path.join(evidence, 'browser-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
