import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot, validateRecord, validateRecipe } from '../lib/domain.mjs';
import { decodePage, encodeProperties, optionalProperties, relationTargets, schemas } from '../pwa/data/notion-properties.mjs';
import { NotionClient } from '../pwa/data/notion-client.mjs';
import { createReadRepository } from '../pwa/data/read-repository.mjs';

const SOURCES = Object.freeze({
  beans: '11111111-1111-4111-8111-111111111111',
  recipes: '33333333-3333-4333-8333-333333333333',
  steps: '44444444-4444-4444-8444-444444444444',
  records: '55555555-5555-4555-8555-555555555555',
});
const IDS = Object.freeze({
  bean: 'aaaaaaaa-1111-4111-8111-111111111111',
  secondBean: 'aaaaaaaa-1111-4111-8111-222222222222',
  bag: 'bbbbbbbb-2222-4222-8222-111111111111',
  recipe: 'cccccccc-3333-4333-8333-111111111111',
  step: 'dddddddd-4444-4444-8444-111111111111',
  record: 'eeeeeeee-5555-4555-8555-111111111111',
});
const REVISION = '99999999-9999-4999-8999-999999999999';

const bean = Object.freeze({
  id: IDS.bean, name: '에티오피아 구지', roaster: '샘플 로스터리', origin: '구지·함벨라',
  variety: '헤이룸', process: '워시드', tastingNotes: '복숭아',
});

function recipeInput(overrides = {}) {
  return {
    name: '공용 V60', dripper: 'V60', dose: 15, grind: '중간', grinder: '그라인더',
    grinderSetting: '20', microns: null, temperature: 93, totalWater: 250,
    steps: [{ name: '붓기', time: '0:00', water: 250 }], ...overrides,
  };
}

function legacySnapshot(beanId = IDS.bean) {
  return {
    version: 1, id: IDS.recipe, beanId, name: '과거 V60', dripper: 'V60', dose: 15,
    grind: '중간', grinder: '', grinderSetting: '', microns: null, temperature: 93,
    totalWater: 250,
    steps: [{ name: '붓기', order: 1, seconds: 0, interval: 0, water: 250, cumulativeWater: 250 }],
  };
}

function rawPage(kind, id, data) {
  const properties = {};
  for (const [name, typed] of Object.entries(encodeProperties(kind, data))) {
    const [type, value] = Object.entries(typed)[0];
    properties[name] = { id: 'property-' + kind + '-' + name, type, [type]: structuredClone(value) };
    if (type === 'relation') properties[name].has_more = false;
  }
  return {
    object: 'page', id,
    parent: { type: 'data_source_id', data_source_id: SOURCES[kind] },
    archived: false, in_trash: false, last_edited_time: '2026-10-22T00:00:00.000Z', properties,
  };
}

function legacyRows(snapshot = legacySnapshot()) {
  const recipe = { id: IDS.recipe, ...validateRecipe(recipeInput()) };
  const beanPage = rawPage('beans', IDS.bean, bean);
  const recipePage = rawPage('recipes', IDS.recipe, recipe);
  delete recipePage.properties['원두'];
  const stepPage = rawPage('steps', IDS.step, {
    name: '붓기', recipeId: IDS.recipe, order: 1, seconds: 0, interval: 0,
    water: 250, cumulativeWater: 250,
  });
  const recordPage = rawPage('records', IDS.record, {
    name: '과거 기록', recipeId: IDS.recipe, bagId: null,
    date: '2026-10-21', rating: 4, cupNote: '복숭아', snapshot,
  });
  delete recordPage.properties['원두'];
  const rows = {
    beans: [beanPage], bags: [], recipes: [recipePage], steps: [stepPage], records: [recordPage],
  };
  return { rows, recipePage };
}

function repositoryFor(rows, recipePage) {
  return createReadRepository({
    dataSources: SOURCES,
    async queryAll(kind) { return structuredClone(rows[kind]); },
    async getPage(id) { assert.equal(id, IDS.recipe); return structuredClone(recipePage); },
  });
}

test('새 레시피는 원두 관계 없이 검증된다', () => {
  const recipe = validateRecipe(recipeInput());
  assert.equal(recipe.beanId, undefined);
  assert.equal(Object.hasOwn(encodeProperties('recipes', { ...recipe, beanId: IDS.bean }), '원두'), false);
});

test('추출 기록은 선택한 원두와 레시피를 각각 보관하며 봉지 필드가 없다', () => {
  const recipe = { id: IDS.recipe, ...validateRecipe(recipeInput()) };
  const selectedBean = { ...bean, id: IDS.secondBean };
  const record = validateRecord({ date: '2026-10-22', rating: 5, cupNote: '살구' }, recipe, selectedBean);
  assert.deepEqual(record, {
    beanId: IDS.secondBean, recipeId: IDS.recipe,
    date: '2026-10-22', rating: 5, cupNote: '살구',
  });
  assert.throws(() => validateRecord({ date: '2026-10-22', rating: 5 }, recipe, null, null), /원두/);
  assert.equal(Object.hasOwn(record, 'bagId'), false);
});

test('기록 snapshot v2는 당시 원두 전체 정보와 레시피 조건·단계를 함께 보존한다', () => {
  const recipe = { id: IDS.recipe, ...validateRecipe(recipeInput()), stats: { count: 9, average: 4 } };
  const snapshot = createSnapshot(bean, recipe);
  assert.equal(snapshot.version, 2);
  assert.deepEqual(snapshot.bean, bean);
  assert.equal(snapshot.recipe.id, IDS.recipe);
  assert.equal(snapshot.recipe.temperature, 93);
  assert.deepEqual(snapshot.recipe.steps, recipe.steps);
  assert.equal(Object.hasOwn(snapshot.recipe, 'beanId'), false);
  assert.equal(Object.hasOwn(snapshot.recipe, 'stats'), false);
});

test('v3 actual snapshot은 삭제된 출처 레시피 관계가 없어도 수정 조건으로 다시 읽힌다', async () => {
  const actualRecipe = {
    id: IDS.recipe,
    ...validateRecipe(recipeInput({ dose: 16, temperature: 91,
      steps: [{ name: '뜸', time: '0:00', water: 45 }, { name: '붓기', time: '0:35', water: 205 }] })),
  };
  const snapshot = { version: 3, recordGeneration: 'bagless-v1', bean,
    recipe: actualRecipe, source: { recipeId: IDS.recipe, recordId: IDS.record } };
  const rows = {
    beans: [rawPage('beans', IDS.bean, bean)], bags: [], recipes: [], steps: [],
    records: [rawPage('records', IDS.record, { name: '실제 추출', beanId: IDS.bean, recipeId: null,
      date: '2026-11-04', rating: 4.7, cupNote: '복숭아', snapshot })],
  };
  const repository = createReadRepository({ dataSources: SOURCES,
    async queryAll(kind) { return structuredClone(rows[kind]); },
    async getPage() { throw new Error('no live recipe should be requested'); },
  });

  const result = await repository.readAll();
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].snapshotStatus, 'valid');
  assert.equal(result.records[0].snapshot.version, 3);
  assert.equal(result.records[0].recipeId, IDS.recipe);
  assert.equal(result.records[0].snapshot.recipe.dose, 16);
  assert.equal(result.records[0].snapshot.recipe.temperature, 91);
  assert.deepEqual(result.records[0].snapshot.recipe.steps.map(step => [step.seconds, step.water]), [[0, 45], [35, 205]]);
  assert.equal(result.records[0].rating, 4.7);
  assert.equal(result.records[0].beanId, IDS.bean);
});

test('원두 best relation codec은 Notion의 0/1/다중 cardinality를 보존한다', () => {
  const ids = [IDS.record, 'eeeeeeee-5555-4555-8555-222222222222'];
  const encoded = encodeProperties('beans', { name: '구지', bestRecordIds: ids });
  assert.deepEqual(encoded['베스트 추출'].relation, ids.map(id => ({ id })));
  assert.equal(relationTargets.beans.bestRecordIds, 'records');
  assert.ok(optionalProperties.beans.includes('bestRecordIds'));
  const page = rawPage('beans', IDS.bean, { ...bean, bestRecordIds: ids });
  assert.deepEqual(decodePage('beans', page).bestRecordIds, ids);
});

test('best relation schema가 없는 기존 원두 데이터베이스도 읽기 검증은 성공하고 기능만 비활성 상태로 둔다', async () => {
  const properties = Object.fromEntries(Object.values(schemas.beans)
    .filter(([name]) => name !== '베스트 추출')
    .map(([name, type]) => [name, { type, [type]: type === 'title' ? [] : [] }]));
  const client = new NotionClient('synthetic-token', { dataSources: SOURCES, connectionRevision: REVISION,
    fetchImpl: async () => ({ status: 200, ok: true,
      async json() { return { object: 'data_source', id: SOURCES.beans, properties }; } }),
  });
  assert.equal(await client.verify(['beans']), true);
  assert.equal(client.beanBestRecordRelationSupported, false);
});

test('records codec writes the selected bean relation and decodes old rows without it', () => {
  const properties = encodeProperties('records', {
    name: '기록', beanId: IDS.bean, recipeId: IDS.recipe, bagId: null,
    date: '2026-10-22', rating: 4, cupNote: '', snapshot: legacySnapshot(),
  });
  assert.deepEqual(properties['원두'].relation, [{ id: IDS.bean }]);
  delete properties['원두'];
  const raw = Object.fromEntries(Object.entries(properties).map(([name, typed]) => {
    const [type, value] = Object.entries(typed)[0];
    return [name, { type, [type]: value }];
  }));
  assert.equal(decodePage('records', { id: IDS.record, properties: raw }).beanId, null);
});

test('legacy v1 snapshot resolves a record bean when both new relations are absent', async () => {
  const { rows, recipePage } = legacyRows();
  const data = await repositoryFor(rows, recipePage).readAll();
  assert.equal(data.recipes.length, 1);
  assert.equal(data.recipes[0].beanId, null);
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].beanId, IDS.bean);
  assert.equal(data.records[0].beanResolution, 'snapshot-v1');
  assert.equal(data.records[0].rating, 4);
  assert.equal(data.records[0].cupNote, '복숭아');
});

test('unresolved legacy bean remains readable but does not enter current ratings', async () => {
  const { rows, recipePage } = legacyRows(legacySnapshot(null));
  const data = await repositoryFor(rows, recipePage).readAll();
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].beanId, null);
  assert.equal(data.records[0].beanResolution, 'needs-confirmation');
  assert.equal(data.records[0].rating, 4);
  assert.equal(data.recipes[0].stats.count, 0);
});

test('legacy data-source verification accepts a missing records.bean relation for read compatibility', async () => {
  const client = new NotionClient('synthetic-token', {
    dataSources: SOURCES,
    connectionRevision: REVISION,
    fetchImpl: async url => {
      const kind = Object.keys(SOURCES).find(key => url.endsWith('/' + SOURCES[key]));
      const properties = {};
      for (const [field, [name, type]] of Object.entries(schemas[kind])) {
        if (kind === 'records' && field === 'beanId') continue;
        properties[name] = type === 'relation'
          ? { type, relation: { data_source_id: SOURCES[relationTargets[kind][field]] } }
          : { type };
      }
      return Response.json({ object: 'data_source', id: SOURCES[kind], properties });
    },
  });
  assert.equal(await client.verify(), true);
  assert.equal(client.recordBeanRelationSupported, false);
});
