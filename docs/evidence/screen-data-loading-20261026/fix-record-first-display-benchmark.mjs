import { performance } from 'node:perf_hooks';
import { NotionClient } from '../../../pwa/data/notion-client.mjs';
import { createReadRepository } from '../../../pwa/data/read-repository.mjs';
import { createAppController } from '../../../pwa/ui/controller.mjs';
import { encodeProperties, schemas, relationTargets } from '../../../pwa/data/notion-properties.mjs';
import { createSnapshot, validateRecipe } from '../../../lib/domain.mjs';

const SOURCES = Object.freeze({
  beans: 'a1111111-1111-4111-8111-111111111111',
  recipes: 'a3333333-3333-4333-8333-333333333333',
  steps: 'a4444444-4444-4444-8444-444444444444',
  records: 'a5555555-5555-4555-8555-555555555555',
});
function rawPage(kind, id, fields) {
  const properties = Object.fromEntries(Object.entries(encodeProperties(kind, fields)).map(([name, typed]) => {
    const [type, value] = Object.entries(typed)[0];
    return [name, { type, [type]: structuredClone(value), ...(type === 'relation' ? { has_more: false } : {}) }];
  }));
  return { object: 'page', id, parent: { type: 'data_source_id', data_source_id: SOURCES[kind] },
    archived: false, in_trash: false, last_edited_time: '2026-10-18T10:00:00.000Z', properties };
}
function beanPage(id, name) {
  return rawPage('beans', id, { name, roaster: 'Synthetic', origin: 'Synthetic', variety: '',
    process: 'Washed', tastingNotes: 'Synthetic' });
}
function recipePage(id) {
  return rawPage('recipes', id, { name: 'V60', beanId: beans[0]?.id ?? id,
    dripper: 'V60', dose: 15, grind: 'Medium', grinder: 'Synthetic', grinderSetting: '20',
    microns: null, temperature: 93, totalWater: 250 });
}
function baglessSnapshot() {
  const recipe = validateRecipe({ name: 'V60', beanId: beans[0].id, dripper: 'V60', dose: 15,
    grind: 'Medium', grinder: 'Synthetic', grinderSetting: '20', microns: null,
    temperature: 93, totalWater: 250,
    steps: [{ name: 'Bloom', time: '0:00', water: 50 }, { name: 'Pour', time: '0:30', water: 100 },
      { name: 'Finish', time: '1:10', water: 100 }] });
  return createSnapshot({ id: beans[0].id, name: beans[0].properties['원두 이름'].title[0].text.content,
    roaster: 'Synthetic', origin: 'Synthetic', variety: '', process: 'Washed', tastingNotes: 'Synthetic' }, recipe);
}

const id = (number, prefix) => `${prefix}aaaaaaa-aaaa-4aaa-8aaa-${String(number).padStart(12, '0')}`;
const beans = Array.from({ length: 60 }, (_, index) => beanPage(id(index + 1, 'a'), `Bean ${String(index).padStart(3, '0')}`));
const recipes = Array.from({ length: 40 }, (_, index) => recipePage(id(index + 1, 'b')));
const records = Array.from({ length: 1000 }, (_, index) => {
  const snapshot = structuredClone(baglessSnapshot());
  snapshot.bean.id = beans[index % 40].id;
  snapshot.bean.name = beans[index % 40].properties['원두 이름'].title[0].text.content;
  snapshot.recipe.id = recipes[index % 40].id;
  return rawPage('records', id(index + 1, 'd'), {
    name: `Record ${index}`, beanId: snapshot.bean.id, recipeId: snapshot.recipe.id,
    date: '2026-10-26', rating: 5, cupNote: 'synthetic', snapshot,
  });
});
const rows = { beans, recipes, records };
const parentPages = new Map([...beans, ...recipes].map(page => [page.id, page]));
const calls = [];
const startedAt = performance.now();
let latest;
let first = null;

const fetchImpl = async (url, options = {}) => {
  const pathname = new URL(url).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  calls.push({ pathname, body, atMs: performance.now() - startedAt });
  await new Promise(resolve => setTimeout(resolve, 100));
  if (options.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  const parts = pathname.split('/');
  let data;
  if (parts[2] === 'data_sources') {
    const kind = Object.keys(SOURCES).find(name => SOURCES[name] === parts[3]);
    if (parts[4] !== 'query') {
      data = { object: 'data_source', id: SOURCES[kind], properties: Object.fromEntries(
        Object.entries(schemas[kind]).map(([field, [name, type]]) => [name, {
          type, [type]: type === 'relation' ? { data_source_id: SOURCES[relationTargets[kind][field]] } : {},
        }])) };
    } else {
      const start = Number(body.start_cursor ?? 0);
      const end = start + body.page_size;
      data = { object: 'list', results: rows[kind].slice(start, end), has_more: end < rows[kind].length,
        next_cursor: end < rows[kind].length ? String(end) : null };
    }
  } else data = parentPages.get(parts[3]);
  return Response.json(data);
};

const connection = { schemaVersion: 1, revision: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  token: 'fake-only', dataSources: SOURCES };
const context = { inspect: async () => ({ initialized: true, blocked: false }),
  readJournal: async () => ({ operations: [], activeConnectionRevision: connection.revision, connectionGuard: null }) };
const app = createAppController({
  view: { currentRoute: () => '/records', setState() {}, showConnection() {}, showStatus() {}, finishStartup() {},
    renderData(data) {
      latest = data;
      if (first === null) first = { ms: performance.now() - startedAt, requests: calls.length,
        rows: data.records.length, beanNameStatus: data.records[0]?.beanNameStatus,
        recipeNameStatus: data.records[0]?.recipeNameStatus,
        snapshotBeanName: data.records[0]?.snapshot?.bean?.name };
    } },
  state: { withWriteLock: async action => action(context) },
  file: { readConnection: async () => connection },
  makeClient: value => new NotionClient(value.token, { dataSources: SOURCES,
    connectionRevision: value.revision, fetchImpl }),
  makeRepository: createReadRepository,
  makeCommands: () => ({}),
});

const initialized = await app.initialize();
const deadline = Date.now() + 30000;
while (latest?.records.some(record => record.beanNameStatus === 'loading' || record.recipeNameStatus === 'loading') &&
    Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
const result = {
  conditions: { delayMs: 100, beans: 60, recipes: 40, records: 1000, route: '/records',
    network: 'in-process fake transport only', metric: 'initialize start to first renderData callback', runs: 1 },
  criticBaseline: { ms: 6112, requests: 58 },
  criticOriginal: { ms: 28872, requests: 84 },
  fixed: { initialized, first, settledMs: performance.now() - startedAt, totalRequests: calls.length,
    firstPageLiveNames: latest?.records?.slice(0, 20).every(record =>
      record.beanNameStatus === 'live' && record.recipeNameStatus === 'live'), calls },
};
console.log(JSON.stringify(result, null, 2));
