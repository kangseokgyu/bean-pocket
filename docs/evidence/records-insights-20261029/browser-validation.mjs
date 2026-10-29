import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { schemas, relationTargets } = await import('../../../pwa/data/notion-properties.mjs');
const { createReadRepository } = await import('../../../pwa/data/read-repository.mjs');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = path.join(root, 'dist');
const evidence = path.dirname(fileURLToPath(import.meta.url));
const sources = Object.freeze({
  beans: '11111111-1111-4111-8111-111111111111',
  recipes: '33333333-3333-4333-8333-333333333333',
  steps: '44444444-4444-4444-8444-444444444444',
  records: '55555555-5555-4555-8555-555555555555',
});
const revision = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ids = {
  beans: [
    'b1111111-1111-4111-8111-111111111111',
    'b2222222-2222-4222-8222-222222222222',
    'b3333333-3333-4333-8333-333333333333',
  ],
  recipes: [
    'c1111111-1111-4111-8111-111111111111',
    'c2222222-2222-4222-8222-222222222222',
    'c3333333-3333-4333-8333-333333333333',
  ],
};
const beanValues = ids.beans.map((id, index) => ({
  id,
  name: ['현재 원두 부모 A', '콜롬비아 우일라', '과테말라 안티구아'][index],
  roaster: '검증 로스터리', origin: ['구지', '우일라', '안티구아'][index],
  variety: '아라비카', process: '워시드', tastingNotes: '복숭아, 꿀',
}));
const recipes = ids.recipes.map((id, index) => ({
  id, name: ['V60 · 구지', '오리가미 · 우일라', '칼리타 · 안티구아'][index],
  beanId: ids.beans[index], dripper: ['V60', '오리가미', '칼리타'][index],
  dose: 15, grind: '중간', grinder: '테스트 그라인더', grinderSetting: '24',
  extractionGuide: '', microns: null, temperature: 92 + index, totalWater: 240,
  steps: [
    { name: '뜸', order: 1, seconds: 0, interval: 0, water: 40, cumulativeWater: 40 },
    { name: '1차 푸어', order: 2, seconds: 30, interval: 30, water: 200, cumulativeWater: 240 },
  ],
}));
const makeSnapshot = index => ({ version: 2, recordGeneration: 'bagless-v1',
  bean: { ...beanValues[index] }, recipe: { ...recipes[index], steps: recipes[index].steps.map(step => ({ ...step })) } });
const records = [
  record('d1111111-1111-4111-8111-111111111111', 0, '2026-10-01', 3, '복숭아'),
  record('d1111111-1111-4111-8111-222222222222', 0, '2026-10-03', 4, '꿀'),
  record('d1111111-1111-4111-8111-333333333333', 0, '2026-10-10', 5, '살구, 홍차'),
  record('d2222222-2222-4222-8222-111111111111', 1, '2026-10-04', 2, '시트러스'),
  record('d2222222-2222-4222-8222-222222222222', 1, '2026-10-07', 5, '카라멜'),
  record('d3333333-3333-4333-8333-111111111111', 2, '2026-10-05', 4, '자두'),
];

function record(id, beanIndex, date, rating, cupNote) {
  const snapshot = makeSnapshot(beanIndex);
  if (beanIndex === 0) snapshot.bean.name = '에티오피아 구지 당시 이름';
  return page('records', { id, name: `${date} · ${recipes[beanIndex].name}`,
    beanId: ids.beans[beanIndex], recipeId: ids.recipes[beanIndex], date, rating, cupNote,
    snapshot });
}

function property(type, value, kind, field) {
  if (type === 'title' || type === 'rich_text') {
    const text = field === 'snapshot' ? JSON.stringify(value ?? null) : String(value ?? '');
    return { type, [type]: text ? [{ type: 'text', text: { content: text }, plain_text: text }] : [] };
  }
  if (type === 'relation') {
    const ids = value ? [value] : [];
    return { type, relation: ids.map(id => ({ id })), has_more: false };
  }
  if (type === 'date') return { type, date: value ? { start: value } : null };
  if (type === 'number') return { type, number: value ?? null };
  throw new Error(`Fixture property type is not handled: ${kind}.${field} ${type}`);
}

function page(kind, values) {
  const properties = {};
  for (const [field, [name, type]] of Object.entries(schemas[kind])) {
    properties[name] = property(type, values[field], kind, field);
  }
  return { object: 'page', id: values.id, parent: { type: 'data_source_id', data_source_id: sources[kind] },
    properties, in_trash: false, archived: false, last_edited_time: '2026-10-29T00:00:00.000Z' };
}

const beanPages = beanValues.map(value => page('beans', value));
const recipePages = recipes.map(value => page('recipes', value));
const stepPages = recipes.flatMap((recipe, recipeIndex) => recipe.steps.map(step =>
  page('steps', { ...step, id: `e${recipeIndex + 1}${String(step.order).padStart(6, '0')}-1111-4111-8111-111111111111`,
    recipeId: recipe.id })));

const fixtureRepository = createReadRepository({ dataSources: sources,
  async queryAll() { return []; }, async getPage() { throw Object.assign(new Error('fixture miss'), { httpStatus: 404 }); },
  async queryPage(kind) { return { items: kind === 'records' ? records : [], nextCursor: null, hasMore: false, complete: true }; },
});
const fixturePage = await fixtureRepository.listRecords();
assert.equal(fixturePage.items.length, records.length, 'the browser fixture must pass the production record decoder');

function relationTarget(kind, field) {
  const target = relationTargets[kind]?.[field];
  return target ? sources[target] : undefined;
}

function dataSourceSchema(kind) {
  const properties = {};
  for (const [field, [name, type]] of Object.entries(schemas[kind])) {
    const relation = type === 'relation' ? { data_source_id: relationTarget(kind, field) } : {};
    properties[name] = { type, [type]: relation };
  }
  return { object: 'data_source', id: sources[kind], properties };
}

function listFor(kind) {
  if (kind === 'beans') return beanPages;
  if (kind === 'recipes') return recipePages;
  if (kind === 'steps') return stepPages;
  return records.filter(row => !row.in_trash && !row.archived)
    .sort((a, b) => b.properties['날짜'].date.start.localeCompare(a.properties['날짜'].date.start));
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === '/bean-pocket/' ? 'index.html'
    : pathname.startsWith('/bean-pocket/') ? pathname.slice('/bean-pocket/'.length) : null;
  const target = relative && path.resolve(dist, relative);
  if (!target || (target !== dist && !target.startsWith(dist + path.sep))) {
    response.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(target);
    const extension = path.extname(target);
    const contentType = extension === '.html' ? 'text/html; charset=utf-8'
      : extension === '.mjs' || extension === '.js' ? 'text/javascript; charset=utf-8'
        : extension === '.css' ? 'text/css; charset=utf-8'
          : extension === '.webmanifest' ? 'application/manifest+json' : 'application/octet-stream';
    response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' }).end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/bean-pocket/`;
const connection = { schemaVersion: 1, revision, token: 'evidence-test-only-token', dataSources: sources };
const fileApi = `
  const files = new Map([
    ['connection.json', ${JSON.stringify(JSON.stringify(connection))}],
    ['submission-journal.json', ${JSON.stringify(JSON.stringify({ schemaVersion: 1, activeConnectionRevision: revision, connectionGuard: null, operations: [] }))}],
  ]);
  const directory = { async getFileHandle(name, options = {}) {
    if (!files.has(name) && options.create !== true) throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
    if (!files.has(name)) files.set(name, '');
    return {
      async getFile() { return { async text() { return files.get(name); } }; },
      async createWritable() {
        let staged = '';
        return { async write(value) { staged = value; }, async close() { files.set(name, staged); }, async abort() {} };
      },
    };
  } };
  const storage = { async getDirectory() { return { async getDirectoryHandle() { return directory; } }; } };
  Object.defineProperty(navigator, 'storage', { configurable: true, value: storage });
  if (navigator.locks) Object.defineProperty(navigator.locks, 'request', { configurable: true,
    value: async (_name, _options, callback) => callback({ name: 'test-only-lock' }) });
`;

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
const pageUnderTest = await context.newPage();
pageUnderTest.setDefaultTimeout(8000);
const consoleErrors = [];
const pageErrors = [];
const badResponses = [];
const requests = [];
const externalRequests = [];
const queryDebug = [];
let keyboardDebug = null;
pageUnderTest.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
pageUnderTest.on('pageerror', error => pageErrors.push(error.message));
pageUnderTest.on('response', response => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });
pageUnderTest.on('request', request => requests.push(request.url()));
await pageUnderTest.addInitScript({ content: fileApi });
await pageUnderTest.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin === new URL(baseUrl).origin || url.origin === 'https://api.notion.com') return route.continue();
  externalRequests.push(url.href);
  return route.abort();
});
await pageUnderTest.route('https://api.notion.com/v1/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  const segments = url.pathname.split('/').filter(Boolean);
  const method = request.method();
  const body = method === 'GET' ? null : request.postDataJSON();
  if (segments[1] === 'data_sources' && segments.length === 3 && method === 'GET') {
    const kind = Object.keys(sources).find(key => sources[key] === segments[2]);
    return kind ? route.fulfill({ status: 200, json: dataSourceSchema(kind) }) : route.fulfill({ status: 404, json: {} });
  }
  if (segments[1] === 'data_sources' && segments[3] === 'query' && method === 'POST') {
    const kind = Object.keys(sources).find(key => sources[key] === segments[2]);
    if (!kind) return route.fulfill({ status: 404, json: {} });
    let rows = listFor(kind);
    if (kind === 'steps' && body?.filter?.property === '레시피') {
      const selected = body.filter.relation?.contains;
      rows = rows.filter(row => row.properties['레시피'].relation.some(item => item.id === selected));
    }
    const pageSize = body?.page_size ?? 20;
    queryDebug.push({ kind, total: rows.length, pageSize, filter: body?.filter ?? null });
    return route.fulfill({ status: 200, json: { object: 'list', results: rows.slice(0, pageSize), has_more: false, next_cursor: null } });
  }
  if (segments[1] === 'pages' && segments.length === 2 && method === 'POST') {
    const kind = Object.keys(sources).find(key => sources[key] === body.parent?.data_source_id);
    if (!kind) return route.fulfill({ status: 404, json: {} });
    const id = 'f1111111-1111-4111-8111-111111111111';
    const properties = Object.fromEntries(Object.entries(body.properties).map(([name, value]) => {
      const type = Object.keys(value)[0];
      return [name, { type, [type]: value[type], ...(type === 'relation' ? { has_more: false } : {}) }];
    }));
    const created = { object: 'page', id, parent: body.parent, properties, in_trash: false,
      archived: false, last_edited_time: '2026-10-29T00:00:00.000Z' };
    if (kind === 'records') records.unshift(created);
    return route.fulfill({ status: 200, json: created });
  }
  if (segments[1] === 'pages' && segments.length === 3 && method === 'GET') {
    const id = segments[2];
    const result = [...beanPages, ...recipePages, ...stepPages, ...records].find(row => row.id === id);
    return result ? route.fulfill({ status: 200, json: result }) : route.fulfill({ status: 404, json: {} });
  }
  if (segments[1] === 'pages' && segments.length === 3 && method === 'PATCH') {
    const row = records.find(item => item.id === segments[2]);
    if (!row) return route.fulfill({ status: 404, json: {} });
    if (body.in_trash === true || body.archived === true) { row.in_trash = true; row.archived = body.archived === true; }
    return route.fulfill({ status: 200, json: row });
  }
  return route.fulfill({ status: 404, json: { message: 'fixture endpoint not found' } });
});

try {
  await pageUnderTest.goto(`${baseUrl}#/records`, { waitUntil: 'networkidle' });
  await pageUnderTest.locator('.record-insight-chart').waitFor();
  await pageUnderTest.locator('.record-card').first().waitFor();
  assert.match(await pageUnderTest.locator('[data-insight-scope]').innerText(), /불러온 기록 6건 기준/);
  const beanCards = pageUnderTest.locator('.record-insight-bean-card');
  assert.equal(await beanCards.count(), 3);
  const beanCard = index => pageUnderTest.locator(`.record-insight-bean-card[data-bean-id="${ids.beans[index]}"]`);
  assert.match(await beanCard(0).innerText(), /에티오피아 구지 당시 이름/);
  assert.doesNotMatch(await beanCard(0).innerText(), /현재 원두 부모 A/);
  assert.match(await beanCard(0).innerText(), /최근 추출 2026-10-10[\s\S]*레시피 V60 · 구지[\s\S]*평가 5\/5/);
  assert.match(await beanCard(1).innerText(), /최근 추출 2026-10-07[\s\S]*레시피 오리가미 · 우일라[\s\S]*평가 5\/5/);
  assert.match(await beanCard(2).innerText(), /최근 추출 2026-10-05[\s\S]*레시피 칼리타 · 안티구아[\s\S]*평가 4\/5/);
  assert.equal(await beanCard(0).getAttribute('aria-pressed'), 'true');
  assert.equal(await pageUnderTest.locator('.record-insight-bean-card[aria-pressed="true"]').count(), 1);
  assert.equal(await pageUnderTest.locator('.rating-chart-axis-label').filter({ hasText: /^[1-5]$/ }).count(), 5);
  assert.equal(await pageUnderTest.locator('.rating-chart-point').count(), 3);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /살구, 홍차/);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /레시피: V60 · 구지/);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /단계별 누적 시간과 물/);

  const initialPoints = await pageUnderTest.locator('.rating-chart-point').evaluateAll(points => points.map(point => ({
    date: point.dataset.date, x: Number(point.getAttribute('cx')), y: Number(point.getAttribute('cy')),
  })));
  assert.deepEqual(initialPoints.map(point => point.date), ['2026-10-01', '2026-10-03', '2026-10-10']);
  assert.ok(initialPoints[0].x < initialPoints[1].x && initialPoints[1].x < initialPoints[2].x);
  assert.ok(initialPoints[2].x - initialPoints[1].x > initialPoints[1].x - initialPoints[0].x,
    'x-axis distances follow elapsed calendar days');
  const svgA11y = await pageUnderTest.locator('.rating-trend-chart').evaluate(svg => ({
    role: svg.getAttribute('role'), labelledby: document.getElementById(svg.getAttribute('aria-labelledby'))?.textContent,
    describedby: svg.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id)?.textContent).join(' '),
  }));
  assert.equal(svgA11y.role, 'img');
  assert.match(svgA11y.labelledby, /날짜별 별점 추이/);
  assert.match(svgA11y.describedby, /2026-10-01/);
  const beanChoice = beanCard(1);
  await beanChoice.focus();
  keyboardDebug = await beanChoice.evaluate(element => ({ active: document.activeElement === element,
    disabled: element.disabled, tabIndex: element.tabIndex, role: element.tagName, pressed: element.getAttribute('aria-pressed') }));
  assert.equal(keyboardDebug.active, true, 'bean cards can receive keyboard focus');
  assert.equal(keyboardDebug.disabled, false);
  assert.ok(keyboardDebug.tabIndex >= 0);
  assert.equal(keyboardDebug.role, 'BUTTON');
  await beanChoice.press('Enter');
  assert.equal(await beanChoice.getAttribute('aria-pressed'), 'true', 'Enter selects the focused bean card');
  await pageUnderTest.waitForFunction(() => document.querySelector('.rating-chart-point')?.dataset.date === '2026-10-04');
  await beanCard(2).focus();
  await beanCard(2).press('Space');
  assert.equal(await beanCard(2).getAttribute('aria-pressed'), 'true', 'Space selects the focused bean card');
  await pageUnderTest.waitForFunction(() => document.querySelector('.rating-chart-point')?.dataset.date === '2026-10-05');
  await beanCard(0).focus();
  await beanCard(0).press('Enter');
  await pageUnderTest.waitForFunction(() => document.querySelector('.rating-chart-point')?.dataset.date === '2026-10-01');

  const filterPicker = pageUnderTest.locator('[data-search-picker][data-option-target="filters"][data-option-kind="recipes"]');
  await filterPicker.locator('[data-action="open-search-picker"]').click();
  await filterPicker.locator(`[data-action="select-search-option"][data-option-id="${ids.recipes[1]}"]`).click();
  await pageUnderTest.waitForFunction(() => document.querySelectorAll('.record-card').length === 2);
  assert.equal(await beanCard(0).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await pageUnderTest.locator('.rating-chart-point').evaluateAll(points => points.map(point => point.dataset.date)),
    ['2026-10-01', '2026-10-03', '2026-10-10']);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /살구, 홍차/);
  await pageUnderTest.locator('[data-action="clear-record-filters"]').click();
  await pageUnderTest.waitForFunction(() => document.querySelectorAll('.record-card').length === 6);

  for (const width of [320, 550, 768, 1024, 1440]) {
    await pageUnderTest.setViewportSize({ width, height: 1200 });
    await pageUnderTest.waitForTimeout(80);
    const metrics = await pageUnderTest.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      chart: document.querySelector('.rating-trend-chart')?.getBoundingClientRect().width,
      insight: document.querySelector('.record-insights')?.getBoundingClientRect().width,
      beanCards: document.querySelectorAll('.record-insight-bean-card').length,
    }));
    assert.ok(metrics.document <= width && metrics.body <= width, `${width}px overflow: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.chart <= metrics.insight + 1, `${width}px chart escapes insights: ${JSON.stringify(metrics)}`);
    assert.equal(metrics.beanCards, 3, `${width}px should show all three recent bean cards`);
    await pageUnderTest.locator('.record-insight-bean-list').scrollIntoViewIfNeeded();
    await pageUnderTest.screenshot({ path: path.join(evidence, `review-fix-records-${width}.png`) });
  }

  await pageUnderTest.locator('[data-action="show-record-form"]').click();
  const entry = pageUnderTest.locator('dialog[data-entry-dialog="records"]');
  await entry.waitFor({ state: 'visible' });
  for (const [kind, id] of [['beans', ids.beans[0]], ['recipes', ids.recipes[0]]]) {
    const picker = entry.locator(`[data-search-picker][data-option-target="form"][data-option-kind="${kind}"]`);
    await picker.locator('[data-action="open-search-picker"]').click();
    await picker.locator(`[data-action="select-search-option"][data-option-id="${id}"]`).click();
  }
  await entry.locator('input[name="date"]').fill('2026-10-28');
  await entry.locator('input[name="rating"][value="5"]').check();
  await entry.locator('textarea[name="cupNote"]').fill('브라우저 확인 컵노트');
  await entry.locator('[data-entry-submit]').click();
  await pageUnderTest.waitForFunction(() => document.querySelector('[data-insight-scope]')?.textContent.includes('불러온 기록 7건 기준'));
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /브라우저 확인 컵노트/);
  assert.equal(await pageUnderTest.locator('.record-card').count(), 7);

  await pageUnderTest.locator('.record-card').filter({ hasText: '2026-10-28' }).locator('[data-action="delete-record"]').click();
  const deleteDialog = pageUnderTest.locator('#delete-confirm-dialog');
  await deleteDialog.waitFor({ state: 'visible' });
  await deleteDialog.locator('[data-action="confirm-delete"]').click();
  await pageUnderTest.waitForFunction(() => document.querySelectorAll('.record-card').length === 6 &&
    document.querySelector('[data-insight-scope]')?.textContent.includes('불러온 기록 6건 기준'));
  assert.doesNotMatch(await pageUnderTest.locator('.record-insight-best').innerText(), /브라우저 확인 컵노트/);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(badResponses, []);
  assert.deepEqual(externalRequests, []);
  const origins = [...new Set(requests.map(url => new URL(url).origin))];
  assert.ok(origins.every(origin => origin === new URL(baseUrl).origin || origin === 'https://api.notion.com'), origins.join(', '));
  assert.ok(requests.some(url => url.startsWith('https://api.notion.com/v1/')));
  console.log(`PASS: production build ${await pageUnderTest.locator('#build-version').innerText()}; widths 320/550/768/1024/1440 show all three bean summary cards without overflow; Enter and Space selection synchronize the chart; snapshot bean name and latest date/recipe/rating summaries; fixed 1–5 chart with true date spacing and text alternative; recipe filter isolation; create/delete dialogs; no console/page errors, failed responses, or unmocked external requests (${requests.length} requests, all Notion calls intercepted).`);
} catch (error) {
  await pageUnderTest.screenshot({ path: path.join(evidence, 'review-fix-browser-failure.png') }).catch(() => {});
  console.error(JSON.stringify({
    failure: error.message,
    selectedBean: await pageUnderTest.locator('.record-insight-bean-card[aria-pressed="true"]').innerText().catch(() => ''),
    chartDates: await pageUnderTest.locator('.rating-chart-point').evaluateAll(points => points.map(point => point.dataset.date)).catch(() => []),
    overflow: await pageUnderTest.evaluate(() => [...document.querySelectorAll('body *')].map(element => {
      const box = element.getBoundingClientRect();
      return { tag: element.tagName, id: element.id, className: typeof element.className === 'string' ? element.className : '',
        left: Math.round(box.left), right: Math.round(box.right), width: Math.round(box.width),
        clientWidth: element.clientWidth, scrollWidth: element.scrollWidth };
    }).filter(item => item.right > innerWidth + 1 || item.left < -1 || item.scrollWidth > item.clientWidth + 2)
      .sort((left, right) => right.right - left.right).slice(0, 20)).catch(() => []),
    title: await pageUnderTest.title().catch(() => ''),
    body: await pageUnderTest.locator('body').innerText().catch(() => ''),
    consoleErrors, pageErrors, badResponses, externalRequests, queryDebug, keyboardDebug, requests,
  }, null, 2));
  throw error;
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
