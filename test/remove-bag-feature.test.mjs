import test from 'node:test';
import assert from 'node:assert/strict';
import { NotionClient as ServerNotionClient, NotionRepository as ServerNotionRepository, readDataSources } from '../lib/notion.mjs';
import { encodeProperties, schemas, relationTargets } from '../pwa/data/notion-properties.mjs';
import { NotionClient as PwaNotionClient } from '../pwa/data/notion-client.mjs';
import { createReadRepository } from '../pwa/data/read-repository.mjs';
import { createConnectionFile } from '../pwa/platform/connection-file.mjs';

const uuid = value => `${value.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
const SOURCES = Object.freeze({ beans: uuid(1), recipes: uuid(2), steps: uuid(3), records: uuid(4) });
const LEGACY_BAGS_SOURCE = uuid(5);
const LEGACY_SOURCES = Object.freeze({ ...SOURCES, bags: LEGACY_BAGS_SOURCE });
const REVISION = uuid(10);
const IDS = Object.freeze({ bean: uuid(101), recipe: uuid(102), step: uuid(103), record: uuid(104), bag: uuid(105) });
const TOKEN = 'synthetic-token-only';

function dataSource(kind, id) {
  const properties = Object.fromEntries(Object.entries(schemas[kind] ?? {}).map(([key, [name, type]]) => [name, {
    type,
    ...(type === 'relation' ? { relation: { data_source_id: SOURCES[relationTargets[kind]?.[key]] ?? LEGACY_BAGS_SOURCE } } : {}),
  }]));
  return { object: 'data_source', id, properties };
}

function wrappedProperties(kind, values) {
  return Object.fromEntries(Object.entries(encodeProperties(kind, values)).map(([name, encoded]) => {
    const [type, value] = Object.entries(encoded)[0];
    return [name, { type, [type]: structuredClone(value), ...(type === 'relation' ? { has_more: false } : {}) }];
  }));
}

function page(kind, id, values, sourceId = SOURCES[kind]) {
  return {
    object: 'page', id,
    parent: { type: 'data_source_id', data_source_id: sourceId },
    archived: false, in_trash: false,
    last_edited_time: '2026-10-26T00:00:00.000Z',
    properties: wrappedProperties(kind, values),
  };
}

function legacyBagPage(beanId) {
  return {
    object: 'page', id: IDS.bag,
    parent: { type: 'data_source_id', data_source_id: LEGACY_BAGS_SOURCE },
    archived: false, in_trash: false,
    last_edited_time: '2026-10-26T00:00:00.000Z',
    properties: {
      '봉지 이름': { type: 'title', title: [{ plain_text: 'old bag' }] },
      '원두': { type: 'relation', relation: [{ id: beanId }], has_more: false },
      '로스팅 날짜': { type: 'date', date: { start: '2026-10-01' } },
    },
  };
}

function historyPages(bagRelation = 'valid') {
  const recipe = {
    id: IDS.recipe, name: 'legacy recipe', dripper: 'V60', dose: 15,
    temperature: 93, totalWater: 250,
    steps: [{ id: IDS.step, name: 'pour', recipeId: IDS.recipe, order: 1, seconds: 0, interval: 0, water: 250, cumulativeWater: 250 }],
  };
  const recipePage = page('recipes', IDS.recipe, { ...recipe, steps: undefined });
  const recordPage = page('records', IDS.record, {
    name: 'legacy record', recipeId: IDS.recipe, date: '2026-10-20', rating: 4,
    cupNote: 'kept', snapshot: { version: 1, ...recipe },
  });
  delete recordPage.properties['원두'];
  if (bagRelation === 'valid') {
    recordPage.properties['원두 봉지'] = { type: 'relation', relation: [{ id: IDS.bag }], has_more: false };
  } else if (bagRelation === 'damaged') {
    recordPage.properties['원두 봉지'] = { type: 'rich_text', rich_text: 'malformed legacy property' };
  } else {
    delete recordPage.properties['원두 봉지'];
  }
  return {
    beans: [page('beans', IDS.bean, { name: 'old bean' })],
    bags: [legacyBagPage(IDS.bean)],
    recipes: [recipePage],
    steps: [page('steps', IDS.step, recipe.steps[0])],
    records: [recordPage],
  };
}

function memoryConnectionStorage(content) {
  const state = { content, writes: 0 };
  const storage = {
    async getDirectory() {
      return {
        async getDirectoryHandle() {
          return {
            async getFileHandle() {
              return {
                async getFile() { return { async text() { return state.content; } }; },
                async createWritable() {
                  state.writes++;
                  throw new Error('readConnection must not write');
                },
              };
            },
          };
        },
      };
    },
  };
  return { storage, state };
}

test('server environment exposes only four required data sources and ignores the old bags variable', () => {
  const env = Object.fromEntries(Object.entries(SOURCES).map(([kind, id]) => [`NOTION_${kind.toUpperCase()}_DATA_SOURCE_ID`, id]));
  env.NOTION_BAGS_DATA_SOURCE_ID = LEGACY_BAGS_SOURCE;
  assert.deepEqual(readDataSources(env), SOURCES);
  assert.deepEqual(Object.keys(readDataSources({})).sort(), ['beans', 'recipes', 'records', 'steps']);
});

test('server Notion adapter ignores an extra legacy bags source key', async () => {
  const calls = [];
  const client = new ServerNotionClient(TOKEN, {
    dataSources: LEGACY_SOURCES,
    fetchImpl: async (url, options) => {
      const parsed = new URL(url);
      calls.push({ url: parsed, method: options.method });
      return parsed.pathname.includes('/query')
        ? Response.json({ object: 'list', results: [], has_more: false })
        : Response.json({ object: 'data_source', id: parsed.pathname.split('/').at(-1), properties: {} });
    },
  });
  await client.verify();
  assert.deepEqual(calls.map(call => call.url.pathname.split('/').at(-1)), Object.values(SOURCES));
});

test('PWA Notion client ignores an extra legacy bags source key during verification', async () => {
  const calls = [];
  const client = new PwaNotionClient(TOKEN, {
    dataSources: LEGACY_SOURCES, connectionRevision: REVISION,
    fetchImpl: async url => {
      const parsed = new URL(url);
      const id = parsed.pathname.split('/').at(-1);
      calls.push(parsed);
      const kind = Object.keys(LEGACY_SOURCES).find(key => LEGACY_SOURCES[key] === id);
      return Response.json(dataSource(kind, id));
    },
  });
  await client.verify();
  assert.deepEqual(calls.map(url => url.pathname.split('/').at(-1)), Object.values(SOURCES));
});

test('PWA read repository queries only four sources and omits bags from its model', async () => {
  const queriedKinds = [];
  const repository = createReadRepository({
    dataSources: LEGACY_SOURCES,
    async queryAll(kind) { queriedKinds.push(kind); return []; },
    async getPage() { throw new Error('no recipe pages in empty data'); },
  });
  const data = await repository.readAll();
  assert.deepEqual(queriedKinds, ['beans', 'recipes', 'steps', 'records']);
  assert.equal(Object.hasOwn(data, 'bags'), false);
});

test('legacy connection data with a bags key is read without rewriting it', async () => {
  const revision = REVISION;
  const content = JSON.stringify({ schemaVersion: 1, revision, token: TOKEN, dataSources: LEGACY_SOURCES });
  const fs = memoryConnectionStorage(content);
  const connection = await createConnectionFile({ storage: fs.storage }).readConnection();
  assert.deepEqual(connection.dataSources, SOURCES);
  assert.equal(fs.state.content, content);
  assert.equal(fs.state.writes, 0);
});

test('old bag create/archive and record bagId input never reach the network', async () => {
  const calls = [];
  const client = new PwaNotionClient(TOKEN, {
    dataSources: LEGACY_SOURCES, connectionRevision: REVISION,
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method });
      return Response.json({ object: 'page', id: IDS.record, properties: {}, parent: { type: 'data_source_id', data_source_id: SOURCES.records } });
    },
  });
  await assert.rejects(client.createPage('bags', { name: 'old bag', beanId: IDS.bean }));
  await assert.rejects(client.archivePage('bags', IDS.bag));
  await assert.rejects(client.createPage('records', {
    name: 'old record', beanId: IDS.bean, recipeId: IDS.recipe, bagId: null,
    date: '2026-10-20', rating: 4, snapshot: { version: 2, recordGeneration: 'bagless-v1' },
  }));
  assert.equal(calls.length, 0);
});

test('bag-only legacy evidence does not resolve a bean in the PWA repository', async () => {
  const pages = historyPages('valid');
  const queriedKinds = [];
  const repository = createReadRepository({
    dataSources: LEGACY_SOURCES,
    async queryAll(kind) { queriedKinds.push(kind); return pages[kind]; },
    async getPage(id) { return pages.recipes.find(item => item.id === id); },
  });
  const data = await repository.readAll();
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].beanId, null);
  assert.equal(data.records[0].beanResolution, 'needs-confirmation');
  assert.equal(data.records[0].rating, 4);
  assert.equal(data.records[0].snapshotStatus, 'valid');
  assert.equal(Object.hasOwn(data.records[0], 'bagId'), false);
  assert.deepEqual(queriedKinds, ['beans', 'recipes', 'steps', 'records']);
});

test('bag-only legacy evidence does not resolve a bean in the server repository', async () => {
  const pages = historyPages('valid');
  const queries = [];
  const serverRepository = new ServerNotionRepository({
    dataSources: LEGACY_SOURCES,
    async queryAll(id) {
      const kind = Object.keys(LEGACY_SOURCES).find(key => LEGACY_SOURCES[key] === id);
      queries.push(kind);
      return pages[kind];
    },
  });
  const data = await serverRepository.all();
  assert.equal(data.records[0].beanId, null);
  assert.equal(data.records[0].beanResolution, 'needs-confirmation');
  assert.equal(data.records[0].rating, 4);
  assert.equal(Object.hasOwn(data.records[0], 'bagId'), false);
  assert.deepEqual(queries, ['beans', 'recipes', 'steps', 'records']);
  assert.equal(Object.hasOwn(data, 'bags'), false);
});

test('missing or malformed legacy bag properties do not exclude PWA history', async () => {
  for (const bagRelation of ['missing', 'damaged']) {
    const pages = historyPages(bagRelation);
    const repository = createReadRepository({
      dataSources: LEGACY_SOURCES,
      async queryAll(kind) { return pages[kind]; },
      async getPage(id) { return pages.recipes.find(item => item.id === id); },
    });
    const data = await repository.readAll();
    assert.equal(data.records.length, 1);
    assert.equal(data.records[0].beanId, null);
    assert.equal(data.records[0].beanResolution, 'needs-confirmation');
    assert.equal(data.records[0].rating, 4);
  }
});

test('missing or malformed legacy bag properties do not exclude server history', async () => {
  for (const bagRelation of ['missing', 'damaged']) {
    const pages = historyPages(bagRelation);
    const repository = new ServerNotionRepository({
      dataSources: LEGACY_SOURCES,
      async queryAll(id) {
        const kind = Object.keys(LEGACY_SOURCES).find(key => LEGACY_SOURCES[key] === id);
        return pages[kind];
      },
    });
    const data = await repository.all();
    assert.equal(data.records.length, 1);
    assert.equal(data.records[0].beanId, null);
    assert.equal(data.records[0].beanResolution, 'needs-confirmation');
    assert.equal(data.records[0].rating, 4);
  }
});

test('records model and every record encoding omit the legacy bag relation', () => {
  assert.equal(Object.hasOwn(schemas.records, 'bagId'), false);
  const properties = encodeProperties('records', {
    name: 'record', beanId: IDS.bean, recipeId: IDS.recipe, bagId: IDS.bag,
    date: '2026-10-20', rating: 4, snapshot: { version: 1 },
  });
  assert.equal(Object.hasOwn(properties, '원두 봉지'), false);
});

test('domain record model contains no bag field', async () => {
  const { validateRecord } = await import('../lib/domain.mjs');
  const record = validateRecord({ date: '2026-10-26', rating: 4 }, { id: IDS.recipe }, { id: IDS.bean });
  assert.equal(Object.hasOwn(record, 'bagId'), false);
});
