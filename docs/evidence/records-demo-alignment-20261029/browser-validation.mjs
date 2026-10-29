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
    'c4444444-4444-4444-8444-444444444444',
  ],
};
const beanValues = ids.beans.map((id, index) => ({
  id,
  name: ['현재 원두 부모 A', '콜롬비아 우일라', '과테말라 안티구아'][index],
  roaster: '검증 로스터리', origin: ['구지', '우일라', '안티구아'][index],
  variety: '아라비카', process: '워시드', tastingNotes: '복숭아, 꿀',
}));
const recipes = ids.recipes.map((id, index) => ({
  id, name: ['V60 · 구지', '오리가미 · 우일라', '칼리타 · 안티구아', '칼리타 · 구지'][index],
  beanId: ids.beans[index === 3 ? 0 : index], dripper: ['V60', '오리가미', '칼리타', '칼리타'][index],
  dose: 15, grind: '중간', grinder: '테스트 그라인더', grinderSetting: '24',
  extractionGuide: '', microns: null, temperature: 92 + index, totalWater: 240,
  steps: [
    { name: '뜸', order: 1, seconds: 0, interval: 0, water: 40, cumulativeWater: 40 },
    { name: '1차 푸어', order: 2, seconds: 30, interval: 30, water: 200, cumulativeWater: 240 },
  ],
}));
const makeSnapshot = (index, recipe = recipes[index]) => ({ version: 2, recordGeneration: 'bagless-v1',
  bean: { ...beanValues[index] }, recipe: { ...recipe, steps: recipe.steps.map(step => ({ ...step })) } });
const records = [
  record('d1111111-1111-4111-8111-111111111111', 0, '2026-10-01', 3, '복숭아'),
  record('d1111111-1111-4111-8111-222222222222', 0, '2026-10-03', 4, '꿀'),
  record('d1111111-1111-4111-8111-444444444444', 0, '2026-10-06', 2, '자몽', recipes[3]),
  record('d1111111-1111-4111-8111-333333333333', 0, '2026-10-10', 5, '살구, 홍차'),
  record('d2222222-2222-4222-8222-111111111111', 1, '2026-10-04', 2, '시트러스'),
  record('d2222222-2222-4222-8222-222222222222', 1, '2026-10-07', 5, '카라멜'),
  record('d3333333-3333-4333-8333-111111111111', 2, '2026-10-05', 4, '자두'),
];

function record(id, beanIndex, date, rating, cupNote, recipe = recipes[beanIndex]) {
  const snapshot = makeSnapshot(beanIndex, recipe);
  if (beanIndex === 0) snapshot.bean.name = '에티오피아 구지 당시 이름';
  return page('records', { id, name: `${date} · ${recipe.name}`,
    beanId: ids.beans[beanIndex], recipeId: recipe.id, date, rating, cupNote,
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
const referencePage = await context.newPage();
referencePage.setDefaultTimeout(8000);
referencePage.on('console', message => { if (message.type() === 'error') consoleErrors.push(`demo: ${message.text()}`); });
referencePage.on('pageerror', error => pageErrors.push(`demo: ${error.message}`));
referencePage.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin === new URL(baseUrl).origin) return route.continue();
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
  await referencePage.goto(`${baseUrl}records-demo.html`, { waitUntil: 'networkidle' });
  await pageUnderTest.locator('.record-insight-chart').waitFor();
  await referencePage.locator('.demo-layout').waitFor();
  assert.equal(await pageUnderTest.locator('.record-management').evaluate(details => details.open), false,
    'legacy search and record management start collapsed below the comparison section');
  assert.match(await pageUnderTest.locator('[data-insight-scope]').innerText(), /불러온 기록 7건/);
  const beanCards = pageUnderTest.locator('.record-insight-bean-card');
  assert.equal(await beanCards.count(), 3);
  const beanCard = index => pageUnderTest.locator(`.record-insight-bean-card[data-bean-id="${ids.beans[index]}"]`);
  assert.match(await beanCard(0).innerText(), /에티오피아 구지 당시 이름/);
  assert.doesNotMatch(await beanCard(0).innerText(), /현재 원두 부모 A/);
  assert.match(await beanCard(0).innerText(), /최근 2026-10-10[\s\S]*5\/5[\s\S]*레시피 V60 · 구지/);
  assert.match(await beanCard(1).innerText(), /최근 2026-10-07[\s\S]*5\/5[\s\S]*레시피 오리가미 · 우일라/);
  assert.match(await beanCard(2).innerText(), /최근 2026-10-05[\s\S]*4\/5[\s\S]*레시피 칼리타 · 안티구아/);
  assert.equal(await beanCard(0).getAttribute('aria-pressed'), 'true');
  assert.equal(await pageUnderTest.locator('.record-insight-bean-card[aria-pressed="true"]').count(), 1);
  assert.match(await pageUnderTest.locator('.record-insight-selected-bean').innerText(), /기록 표본[\s\S]*4건[\s\S]*평균 평가[\s\S]*3\.5점/);
  assert.match(await pageUnderTest.locator('.record-insight-selected-bean').innerText(), /에티오피아 구지 당시 이름/);
  assert.deepEqual(await pageUnderTest.locator('.record-insight-comparison-table thead th').allInnerTexts(),
    ['추출일', '레시피', '기록 당시 조건 · 분쇄 · 온도 · 도징 · 물', '평가', '컵노트']);
  assert.equal(await pageUnderTest.locator('.record-insight-comparison-table tbody tr').count(), 4);
  assert.equal(await pageUnderTest.locator('.rating-chart-axis-label').filter({ hasText: /^[1-5]$/ }).count(), 5);
  assert.equal(await pageUnderTest.locator('.rating-chart-point').count(), 4);
  assert.deepEqual(await pageUnderTest.locator('.rating-chart-point-label').evaluateAll(labels => labels.map(label => label.textContent)),
    ['3점', '4점', '2점', '5점']);
  assert.ok(await pageUnderTest.locator('.rating-chart-point-label').evaluateAll(labels =>
    labels.every(label => label.getBBox().y >= 0 && label.getBBox().y + label.getBBox().height <= 230)),
  'visible rating labels stay inside the SVG viewBox');
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /살구, 홍차/);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /V60 · 구지/);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /단계별 누적 시간과 물/);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /92℃/);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /240g/);

  const initialPoints = await pageUnderTest.locator('.rating-chart-point').evaluateAll(points => points.map(point => ({
    date: point.dataset.date, x: Number(point.getAttribute('cx')), y: Number(point.getAttribute('cy')),
  })));
  assert.deepEqual(initialPoints.map(point => point.date), ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-10']);
  assert.ok(initialPoints[0].x < initialPoints[1].x && initialPoints[1].x < initialPoints[2].x &&
    initialPoints[2].x < initialPoints[3].x);
  assert.ok(initialPoints[2].x - initialPoints[1].x > initialPoints[1].x - initialPoints[0].x &&
    initialPoints[3].x - initialPoints[2].x > initialPoints[2].x - initialPoints[1].x,
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

  const comparisonFilter = pageUnderTest.locator('[data-insight-recipe-filter]');
  await comparisonFilter.selectOption(ids.recipes[3]);
  await pageUnderTest.waitForFunction(() => document.querySelectorAll('.record-insight-comparison-table tbody tr').length === 1);
  assert.match(await pageUnderTest.locator('.record-insight-comparison-table tbody').innerText(), /칼리타 · 구지/);
  assert.deepEqual(await pageUnderTest.locator('.rating-chart-point').evaluateAll(points => points.map(point => point.dataset.date)),
    ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-10']);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /살구, 홍차/);
  await comparisonFilter.selectOption('');
  const comparisonDates = () => pageUnderTest.locator('.record-insight-comparison-table tbody tr')
    .evaluateAll(rows => rows.map(row => row.querySelector('td').textContent));
  const comparisonSort = pageUnderTest.locator('[data-insight-comparison-sort]');
  await comparisonSort.selectOption('date-asc');
  assert.deepEqual(await comparisonDates(), ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-10']);
  await comparisonSort.selectOption('rating-desc');
  assert.deepEqual(await comparisonDates(), ['2026-10-10', '2026-10-03', '2026-10-01', '2026-10-06']);
  assert.deepEqual(await pageUnderTest.locator('.rating-chart-point').evaluateAll(points => points.map(point => point.dataset.date)),
    ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-10']);

  await pageUnderTest.locator('.record-management > summary').click();
  await pageUnderTest.locator('.record-card').first().waitFor();
  const filterPicker = pageUnderTest.locator('[data-search-picker][data-option-target="filters"][data-option-kind="recipes"]');
  await filterPicker.locator('[data-action="open-search-picker"]').click();
  await filterPicker.locator(`[data-action="select-search-option"][data-option-id="${ids.recipes[1]}"]`).click();
  await pageUnderTest.waitForFunction(() => document.querySelectorAll('.record-card').length === 2);
  assert.equal(await beanCard(0).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await pageUnderTest.locator('.rating-chart-point').evaluateAll(points => points.map(point => point.dataset.date)),
    ['2026-10-01', '2026-10-03', '2026-10-06', '2026-10-10']);
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /살구, 홍차/);
  await pageUnderTest.locator('[data-action="clear-record-filters"]').click();
  await pageUnderTest.waitForFunction(() => document.querySelectorAll('.record-card').length === 7);
  await pageUnderTest.locator('.record-management > summary').click();

  for (const width of [320, 550, 768, 1024, 1440]) {
    await pageUnderTest.setViewportSize({ width, height: 1200 });
    await referencePage.setViewportSize({ width, height: 1200 });
    await pageUnderTest.waitForTimeout(80);
    const metrics = await pageUnderTest.evaluate(() => {
      const layout = document.querySelector('.records-demo-layout');
      const sidebar = layout.querySelector('.record-insight-sidebar').getBoundingClientRect();
      const content = layout.querySelector('.record-insights-content').getBoundingClientRect();
      const table = document.querySelector('.record-insight-comparison-table-region');
      const rating = document.querySelector('.record-insight-comparison-table tbody tr td:nth-child(4) .record-insight-rating');
      const note = document.querySelector('.record-insight-comparison-table tbody tr td:nth-child(5)');
      const cards = document.querySelector('.record-insight-comparison-cards');
      return {
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      chart: document.querySelector('.rating-trend-chart')?.getBoundingClientRect().width,
      insight: layout.getBoundingClientRect().width,
      beanCards: document.querySelectorAll('.record-insight-bean-card').length,
      sidebarTop: sidebar.top, sidebarLeft: sidebar.left, contentTop: content.top, contentLeft: content.left,
      columns: getComputedStyle(layout).gridTemplateColumns,
      tableDisplay: getComputedStyle(table).display, cardsDisplay: getComputedStyle(cards).display,
      comparisonRows: document.querySelectorAll('.record-insight-comparison-table tbody tr').length,
      ratingRight: rating.getBoundingClientRect().right, noteLeft: note.getBoundingClientRect().left,
    }; });
    assert.ok(metrics.document <= width && metrics.body <= width, `${width}px overflow: ${JSON.stringify(metrics)}`);
    assert.ok(metrics.chart <= metrics.insight + 1, `${width}px chart escapes insights: ${JSON.stringify(metrics)}`);
    assert.equal(metrics.beanCards, 3, `${width}px should show all three recent bean cards`);
    if (width <= 920) assert.ok(metrics.sidebarTop < metrics.contentTop, `${width}px stacks sidebar before content: ${JSON.stringify(metrics)}`);
    else assert.ok(metrics.sidebarLeft < metrics.contentLeft, `${width}px places sidebar left of content: ${JSON.stringify(metrics)}`);
    if (width <= 720) {
      assert.equal(metrics.tableDisplay, 'none', `${width}px hides the desktop table`);
      assert.equal(metrics.cardsDisplay, 'grid', `${width}px shows equivalent mobile comparison cards`);
    } else {
      assert.notEqual(metrics.tableDisplay, 'none', `${width}px shows the comparison table`);
      assert.equal(metrics.cardsDisplay, 'none', `${width}px hides mobile comparison cards`);
      assert.ok(metrics.ratingRight <= metrics.noteLeft + 1,
        `${width}px rating stars and score fit before cup notes: ${JSON.stringify(metrics)}`);
    }
    assert.equal(metrics.comparisonRows, 4);
    await pageUnderTest.evaluate(() => window.scrollTo(0, 0));
    await referencePage.evaluate(() => window.scrollTo(0, 0));
    await referencePage.screenshot({ path: path.join(evidence, `demo-${width}.png`), fullPage: true });
    await pageUnderTest.screenshot({ path: path.join(evidence, `production-${width}.png`), fullPage: true });
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
  await pageUnderTest.waitForFunction(() => document.querySelector('[data-insight-scope]')?.textContent.includes('불러온 기록 8건'));
  assert.match(await pageUnderTest.locator('.record-insight-best').innerText(), /브라우저 확인 컵노트/);
  assert.equal(await pageUnderTest.locator('.record-card').count(), 8);

  await pageUnderTest.locator('.record-management > summary').click();
  await pageUnderTest.locator('.record-card').filter({ hasText: '2026-10-28' }).locator('[data-action="delete-record"]').click();
  const deleteDialog = pageUnderTest.locator('#delete-confirm-dialog');
  await deleteDialog.waitFor({ state: 'visible' });
  await deleteDialog.locator('[data-action="confirm-delete"]').click();
  await pageUnderTest.waitForFunction(() => document.querySelectorAll('.record-card').length === 7 &&
    document.querySelector('[data-insight-scope]')?.textContent.includes('불러온 기록 7건'));
  assert.doesNotMatch(await pageUnderTest.locator('.record-insight-best').innerText(), /브라우저 확인 컵노트/);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(badResponses, []);
  assert.deepEqual(externalRequests, []);
  const origins = [...new Set(requests.map(url => new URL(url).origin))];
  assert.ok(origins.every(origin => origin === new URL(baseUrl).origin || origin === 'https://api.notion.com'), origins.join(', '));
  assert.ok(requests.some(url => url.startsWith('https://api.notion.com/v1/')));
  console.log(`PASS: production build ${await pageUnderTest.locator('#build-version').innerText()}; paired demo/production captures at 320/550/768/1024/1440px; desktop sidebar/main and mobile order/table-card breakpoints; selected summary and mean; rating labels and fixed 1–5 date-spaced chart; all three recipe/sort controls isolated from trend/best; Enter/Space bean selection; collapsed legacy list, server recipe filter, create/delete; no overflow, console/page errors, failed responses, or unmocked external requests (${requests.length} requests, all Notion calls intercepted).`);
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
