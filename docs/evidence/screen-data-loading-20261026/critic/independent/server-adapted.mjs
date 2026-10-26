import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
const port = Number(process.env.SCREEN_DATA_LOADING_PORT ?? 4271);
const html = String.raw`<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/pwa/styles.css"><link rel="icon" href="data:,"><title>Screen loading fake fixture</title></head>
<body><header class="site-header"><h1>Screen loading fixture</h1><div class="header-tools" id="connection-tools"></div></header>
<main class="page"><section id="app-root" class="bean-section"></section></main>
<script type="module">
import { createAppView } from '/pwa/ui/view.mjs';
import { createAppController } from '/pwa/ui/controller.mjs';
import { NotionClient } from '/pwa/data/notion-client.mjs';
import { createReadRepository } from '/pwa/data/read-repository.mjs';
import { createCommands } from '/pwa/commands/index.mjs';
import { createSubmissionState } from '/pwa/state/submission-state.mjs';
import { memoryPlatform, fakePwaNotion, testConnection } from '/test/fixtures/pwa-environment.mjs';

const native = memoryPlatform();
const fake = fakePwaNotion();
const view = createAppView(document);
let lastScreen = null;
const renderData = view.renderData;
view.renderData = data => { lastScreen = data; renderData(data); };

function textProperty(page, name, type) {
  const property = page.properties[name];
  return property?.[type]?.map(item => item.plain_text ?? item.text?.content ?? '').join('') ?? '';
}
function matches(row, filter) {
  if (!filter) return true;
  if (Array.isArray(filter.and)) return filter.and.every(item => matches(row, item));
  if (Array.isArray(filter.or)) return filter.or.some(item => matches(row, item));
  const property = row.properties[filter.property];
  if (filter.title?.contains !== undefined) return textProperty(row, filter.property, 'title').includes(filter.title.contains);
  if (filter.relation?.contains !== undefined) return property?.relation?.some(item => item.id === filter.relation.contains) ?? false;
  return true;
}
function sortValue(row, sort) {
  if (sort.timestamp === 'last_edited_time') return row.last_edited_time;
  const property = row.properties[sort.property];
  if (property?.type === 'title') return textProperty(row, sort.property, 'title');
  if (property?.type === 'date') return property.date?.start ?? '';
  return '';
}
fake.intercept = ({ pathname, method, body }) => {
  const match = pathname.match(/^\/v1\/data_sources\/([^/]+)\/query$/);
  if (!match || method !== 'POST') return null;
  const sourceId = match[1];
  const rows = fake.rows.filter(row => row.parent.data_source_id === sourceId && !row.archived && !row.in_trash && matches(row, body.filter));
  for (const sort of [...(body.sorts ?? [])].reverse()) {
    rows.sort((left, right) => {
      const order = String(sortValue(left, sort)).localeCompare(String(sortValue(right, sort)), 'ko', { numeric: true });
      return sort.direction === 'descending' ? -order : order;
    });
  }
  const size = body.page_size ?? 20;
  const start = Number(body.start_cursor ?? 0);
  const results = rows.slice(start, start + size);
  const hasMore = start + size < rows.length;
  return Response.json({ object: 'list', results, has_more: hasMore,
    next_cursor: hasMore ? String(start + size) : null, request_status: { type: 'complete' } });
};

const app = createAppController({
  view,
  state: createSubmissionState(native),
  file: { async readConnection() { return native.files.has('connection.json') ? JSON.parse(native.files.get('connection.json')) : null; } },
  makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources,
    connectionRevision: connection.revision, fetchImpl: fake.fetch }),
  makeRepository: createReadRepository,
  makeCommands: options => createCommands(options),
});
app.bind();
const initialized = await app.initialize();
const startupCalls = fake.calls.map(({ pathname, method, body }) => ({ pathname, method, body }));

async function seed() {
  const bean = await app.submit('beans', { name: 'Screen fixture Ethiopia', origin: 'Fake only · Sidama',
    tastingNotes: 'Peach' });
  const recipe = await app.submit('recipes', { name: 'Screen fixture V60', dose: 15, totalWater: 250,
    temperature: 93, dripper: 'V60', steps: [
      { time: '0:00', water: 50 }, { time: '0:30', water: 100 }, { time: '1:10', water: 100 },
    ] });
  const record = await app.submit('records', { beanId: bean.value.id, recipeId: recipe.value.id,
    date: '2026-10-26', rating: 5, cupNote: 'fake seed record' });
  const source = fake.rows.find(row => row.id === record.value.id);
  for (let index = 2; index <= 25; index++) {
    const copy = structuredClone(source);
    copy.id = 'dddddddd-dddd-4ddd-8ddd-' + String(index).padStart(12, '0');
    copy.last_edited_time = '2026-10-' + String(index).padStart(2, '0') + 'T00:00:00.000Z';
    copy.properties['날짜'].date.start = '2026-10-' + String(index).padStart(2, '0');
    copy.properties['컵노트'].rich_text = [{ type: 'text', text: { content: 'fake paged record ' + index } }];
    fake.rows.push(copy);
  }
  await app.refresh();
  return { bean: bean.value.id, recipe: recipe.value.id, record: record.value.id };
}

window.fixture = { app, view, fake, native, startupCalls, initialized,
  seed, getLastScreen: () => lastScreen, getSourceIds: () => testConnection().dataSources };
window.fixtureReady = true;
</script></body></html>`;

const contentTypes = new Map([
  ['.mjs', 'text/javascript; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.json', 'application/json; charset=utf-8'],
]);

const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/health') { response.end('ok'); return; }
    if (pathname === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); return; }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    const body = await readFile(file);
    response.setHeader('Content-Type', contentTypes.get(path.extname(file)) ?? 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log('fake-only fixture listening on 127.0.0.1:' + port));
