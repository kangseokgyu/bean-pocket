const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/recipe-header-edit-20261105');
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
  name: '아주 긴 레시피 제목 에티오피아 시다마 천천히 붓는 향긋한 커피 '.repeat(3),
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
window.submissions = [];
view.bind({ getState: () => ({}), submit: async (action, payload) => { window.submissions.push({action, payload}); return {status: 'succeeded'}; } });
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
  const dist = path.resolve(root, 'dist');
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/fixture') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      return response.end(fixtureHtml(`/recipes/${recipeId}`, baseData));
    }
    if (url.pathname === '/favicon.ico') return response.writeHead(204).end();
    const file = path.resolve(dist, `.${url.pathname}`);
    if (!file.startsWith(dist + path.sep)) return response.writeHead(400).end();
    try { response.setHeader('Content-Type', contentType(file)); response.end(await fs.readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const results = [];
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
      const edit = page.getByRole('button', { name: `${recipe.name} 수정`, exact: true });
      const remove = page.locator('.recipe-header-actions [data-action="delete-recipe"]');
      await edit.waitFor();
      assert.equal(await page.locator('.recipe-card-actions [data-action="edit-recipe"]').count(), 0);
      assert.deepEqual(await page.locator('.recipe-header-actions button').evaluateAll(nodes => nodes.map(node => node.dataset.action)), ['edit-recipe', 'delete-recipe']);
      const a = await edit.boundingBox(), b = await remove.boundingBox();
      assert.equal(a.width, 46); assert.equal(a.height, 46);
      assert.equal(b.width, 46); assert.equal(b.height, 46);
      assert.equal(a.x + a.width, b.x); assert.equal(a.y, b.y);
      const styles = await edit.evaluate(node => { const s = getComputedStyle(node); return {color: s.color, background: s.backgroundColor, margin: s.margin, padding: s.padding}; });
      assert.equal(styles.background, 'rgba(0, 0, 0, 0)');
      assert.equal(styles.margin, '0px');
      assert.deepEqual(styles, await remove.evaluate(node => { const s = getComputedStyle(node); return {color: s.color, background: s.backgroundColor, margin: s.margin, padding: s.padding}; }));
      assert.equal(await page.locator('.recipe-header-actions').evaluate(node => getComputedStyle(node).gap), '0px');
      assert.ok(await page.locator('.recipe-card h3').evaluate(node => node.getBoundingClientRect().right <= node.nextElementSibling.getBoundingClientRect().left));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await edit.hover();
      assert.equal(await edit.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(240, 240, 237)');
      await edit.click();
      await page.getByRole('status').filter({ hasText: '레시피 수정 기능을 준비 중입니다.' }).waitFor();
      await page.keyboard.press('Tab');
      assert.equal(await remove.evaluate(node => node === document.activeElement && node.matches(':focus-visible')), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await edit.evaluate(node => node === document.activeElement && node.matches(':focus-visible')), true);
      assert.equal(await edit.evaluate(node => getComputedStyle(node).outlineWidth), '3px');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      assert.equal(await page.locator('.app-status').textContent(), '레시피 수정 기능을 준비 중입니다.');
      await page.screenshot({path: path.join(evidence, `recipe-header-${width}.png`), fullPage: true});
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
      const dialog = page.locator('#delete-confirm-dialog');
      await dialog.waitFor({state:'visible'});
      await dialog.getByRole('button', {name: '취소', exact:true}).click();
      assert.equal(await page.evaluate(() => window.submissions.length), 0);
      await remove.click();
      await dialog.getByRole('button', {name: '삭제', exact:true}).click();
      await page.waitForFunction(() => window.submissions.length === 1);
      assert.deepEqual(await page.evaluate(() => window.submissions[0]), {action:'delete-recipe', payload:{id:recipeId}});
      assert.deepEqual(errors, []);
      results.push({width, edit:a, delete:b, gap:0, overflow:false, keyboard:true, deleteDispatch:true, pageErrors:errors});
      await page.close();
    }
    await fs.writeFile(path.join(evidence, 'browser-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
