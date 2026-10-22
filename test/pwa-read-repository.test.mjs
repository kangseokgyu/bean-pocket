import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { validateRecipe } from '../lib/domain.mjs';
import { encodeProperties } from '../pwa/data/notion-properties.mjs';
import * as repositoryModule from '../pwa/data/read-repository.mjs';

const { createReadRepository } = repositoryModule;
const KINDS = ['beans', 'bags', 'recipes', 'steps', 'records'];
const SOURCES = Object.freeze({
  beans: 'a1111111-1111-4111-8111-111111111111',
  bags: 'a2222222-2222-4222-8222-222222222222',
  recipes: 'a3333333-3333-4333-8333-333333333333',
  steps: 'a4444444-4444-4444-8444-444444444444',
  records: 'a5555555-5555-4555-8555-555555555555',
});
const IDS = Object.freeze({
  bean: 'b1111111-1111-4111-8111-111111111111',
  otherBean: 'b1111111-1111-4111-8111-222222222222',
  bag: 'b2222222-2222-4222-8222-111111111111',
  otherBag: 'b2222222-2222-4222-8222-222222222222',
  recipe: 'b3333333-3333-4333-8333-111111111111',
  secondRecipe: 'b3333333-3333-4333-8333-222222222222',
  thirdRecipe: 'b3333333-3333-4333-8333-333333333333',
  fourthRecipe: 'b3333333-3333-4333-8333-444444444444',
  fifthRecipe: 'b3333333-3333-4333-8333-555555555555',
  pageA: 'b4444444-4444-4444-8444-111111111111',
  pageB: 'b4444444-4444-4444-8444-222222222222',
  pageC: 'b4444444-4444-4444-8444-333333333333',
  pageD: 'b4444444-4444-4444-8444-444444444444',
  record: 'b5555555-5555-4555-8555-111111111111',
  secondRecord: 'b5555555-5555-4555-8555-222222222222',
});
const TOKEN = 'synthetic-private-read-token';
const RAW_ERROR = `raw page failure ${TOKEN} ${IDS.recipe}`;
const LAST_EDITED = '2026-10-18T10:00:00.000Z';

function emptyRows() {
  return { beans: [], bags: [], recipes: [], steps: [], records: [] };
}

function rawPage(kind, id, fields, overrides = {}) {
  const properties = {};
  for (const [name, typed] of Object.entries(encodeProperties(kind, fields))) {
    const [type, value] = Object.entries(typed)[0];
    properties[name] = { id: `property-${name}`, type, [type]: structuredClone(value) };
    if (type === 'relation') properties[name].has_more = false;
  }
  return {
    object: 'page',
    id,
    parent: { type: 'data_source_id', data_source_id: SOURCES[kind] },
    archived: false,
    in_trash: false,
    last_edited_time: LAST_EDITED,
    properties,
    ...overrides,
  };
}

function beanPage(id = IDS.bean, name = '에티오피아') {
  return rawPage('beans', id, {
    name, roaster: '로스터리', origin: '구지', variety: '', process: '워시드', tastingNotes: '복숭아',
  });
}

function recipeInput(overrides = {}) {
  return {
    name: 'V60', beanId: IDS.bean, dripper: 'V60', dose: 15, grind: '중간', grinder: '그라인더',
    grinderSetting: '20', microns: null, temperature: 93, totalWater: 250,
    steps: [
      { name: '뜸', time: '0:00', water: 50 },
      { name: '1차', time: '0:30', water: 100 },
      { name: '2차', time: '1:10', water: 100 },
    ],
    ...overrides,
  };
}

function storedRecipe(id = IDS.recipe, overrides = {}) {
  const { id: _ignored, steps: _steps, ...inputOverrides } = overrides;
  return { id, ...validateRecipe(recipeInput(inputOverrides)) };
}

function legacySnapshot(recipe) {
  const snapshot = structuredClone(recipe);
  delete snapshot.stats;
  return { version: 1, ...snapshot };
}

function recipePage(id = IDS.recipe, overrides = {}) {
  const page = rawPage('recipes', id, {
    name: 'V60', beanId: IDS.bean, dripper: 'V60', dose: 15, grind: '중간', grinder: '그라인더',
    grinderSetting: '20', microns: null, temperature: 93, totalWater: 250, ...overrides,
  });
  page.properties['원두'] = { id: 'legacy-recipe-bean', type: 'relation', relation: [{ id: IDS.bean }], has_more: false };
  return page;
}

function stepPage(recipeId, step, id = IDS.pageA, overrides = {}) {
  return rawPage('steps', id, {
    name: step.name, recipeId, order: step.order, seconds: step.seconds, interval: step.interval,
    water: step.water, cumulativeWater: step.cumulativeWater,
  }, overrides);
}

function standardStepPages(recipeId = IDS.recipe, idPrefix = IDS.pageA) {
  const recipe = storedRecipe(recipeId);
  return recipe.steps.map((step, index) => stepPage(recipeId, step,
    index === 0 ? idPrefix : `${idPrefix.slice(0, -12)}${String(index + 1).padStart(12, '0')}`));
}

function bagPage(id = IDS.bag, beanId = IDS.bean, name = '봄 봉지') {
  return rawPage('bags', id, { name, beanId, roastedOn: '2026-10-01' });
}

function recordPage({ id = IDS.record, recipeId = IDS.recipe, beanId = IDS.bean, bagId = null, snapshot = legacySnapshot(storedRecipe(recipeId)), rating = 4 } = {}) {
  return rawPage('records', id, {
    name: '2026-10-18 · V60', beanId, recipeId, bagId, date: '2026-10-18', rating,
    cupNote: '복숭아와 꿀', snapshot,
  });
}

function baselineRows() {
  return {
    beans: [beanPage()],
    bags: [bagPage()],
    recipes: [recipePage()],
    steps: standardStepPages(),
    records: [recordPage({ bagId: IDS.bag })],
  };
}

function epsilonRows() {
  const recipe = validateRecipe(recipeInput({
    totalWater: 50,
    steps: [
      { name: '거의 전량', time: '0:00', water: 49.9999995 },
      { name: '마지막 방울', time: '0:30', water: 0.0000005 },
    ],
  }));
  const rows = baselineRows();
  rows.recipes = [recipePage(IDS.recipe, { totalWater: 50 })];
  rows.steps = recipe.steps.map((step, index) => stepPage(
    IDS.recipe, step, index === 0 ? IDS.pageA : IDS.pageB,
  ));
  rows.records = [];
  return { rows, recipe };
}

function fixture({ rows = baselineRows(), onQuery, onGetPage, failQuery, failGetPage, empty = false } = {}) {
  const calls = [];
  const parents = new Map(rows.recipes.map(page => [page.id, page]));
  const client = {
    dataSources: SOURCES,
    async queryAll(kind) {
      calls.push({ method: 'queryAll', kind });
      if (onQuery) await onQuery(kind, rows, parents, calls);
      if (failQuery === kind) throw Object.assign(new Error(RAW_ERROR, { cause: { id: IDS.recipe } }), { privateId: IDS.recipe });
      return structuredClone(empty ? emptyRows()[kind] : rows[kind]);
    },
    async getPage(id) {
      calls.push({ method: 'getPage', id });
      if (onGetPage) await onGetPage(id, parents, calls);
      if (failGetPage === id || failGetPage === true) throw Object.assign(new Error(RAW_ERROR), { cause: TOKEN });
      const page = parents.get(id);
      if (page === undefined) throw new Error(RAW_ERROR);
      return structuredClone(page);
    },
  };
  return { client, calls, parents, rows, repository: createReadRepository(client) };
}

async function expectSafeFailure(action, code) {
  await assert.rejects(action, failure => {
    assert.equal(failure?.code, code);
    assert.equal(failure?.writeState, 'not-sent');
    assert.ok(Object.isFrozen(failure));
    const rendered = JSON.stringify(failure) + inspect(failure);
    assert.doesNotMatch(rendered, /synthetic-private-read-token|raw page failure|b3333333-3333-4333-8333-111111111111|cause|stack|Error:/i);
    return true;
  });
}

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.ok(Object.isFrozen(value));
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
}

function setRelation(page, propertyName, ids, hasMore = false) {
  page.properties[propertyName] = {
    id: `relation-${propertyName}`, type: 'relation', has_more: hasMore, relation: ids.map(id => ({ id })),
  };
}

test('모듈은 공개 factory와 두 읽기 메서드만 제공한다', () => {
  assert.deepEqual(Object.keys(repositoryModule), ['createReadRepository']);
  const repository = createReadRepository(fixture().client);
  assert.deepEqual(Object.keys(repository).sort(), ['readAll', 'readRecipeForSnapshot']);
  assert.ok(Object.isFrozen(repository));
});

test('factory는 다섯 source ID를 검증하고 생성 시점 값을 복사한다', async () => {
  const f = fixture();
  const sourceIds = { ...SOURCES };
  f.client.dataSources = sourceIds;
  const repository = createReadRepository(f.client);
  for (const kind of KINDS) sourceIds[kind] = 'bad-source-id';

  const result = await repository.readAll();
  assert.equal(result.beans.length, 1);
  assert.equal(result.bags.length, 1);
  assert.equal(result.recipes.length, 1);

  const invalidClient = { ...f.client, dataSources: { ...SOURCES, steps: 'bad-source-id' } };
  assert.throws(() => createReadRepository(invalidClient), failure => {
    assert.equal(failure?.code, 'invalid-input');
    assert.equal(failure?.writeState, 'not-sent');
    assert.ok(Object.isFrozen(failure));
    assert.doesNotMatch(JSON.stringify(failure) + inspect(failure), /bad-source-id|synthetic-private-read-token/);
    return true;
  });
});

test('다섯 source를 모두 읽고 단계 정렬·기록 snapshot·별점 집계를 만든 뒤 깊게 고정한다', async () => {
  const rows = baselineRows();
  rows.steps.reverse();
  rows.records.push(recordPage({ id: IDS.secondRecord, bagId: null, rating: 1 }));
  const f = fixture({ rows });
  const result = await f.repository.readAll();
  assert.deepEqual(f.calls.filter(call => call.method === 'queryAll').map(call => call.kind), KINDS);
  assert.deepEqual(Object.keys(result), ['beans', 'bags', 'recipes', 'records', 'excluded']);
  assert.equal(result.beans.length, 1);
  assert.equal(result.bags.length, 1);
  assert.equal(result.recipes.length, 1);
  assert.deepEqual(result.recipes[0].steps.map(step => step.order), [1, 2, 3]);
  assert.deepEqual(result.recipes[0].stats, { count: 2, average: 2.5 });
  assert.deepEqual(result.records[0].snapshot, legacySnapshot(storedRecipe()));
  assert.deepEqual(result.excluded, { bags: 0, recipes: 0, records: 0, steps: 0 });
  assertDeepFrozen(result);
  assert.throws(() => { result.recipes[0].steps[0].water = 999; }, TypeError);
  rows.beans[0].properties['원두 이름'].title[0].text.content = '바뀐 원두';
  assert.equal(result.beans[0].name, '에티오피아');
});

test('진짜 빈 다섯 source는 빈 데이터로 반환하고 조회 실패와 구분한다', async () => {
  const empty = await fixture({ empty: true }).repository.readAll();
  assert.deepEqual(empty, {
    beans: [], bags: [], recipes: [], records: [],
    excluded: { bags: 0, recipes: 0, records: 0, steps: 0 },
  });
  await expectSafeFailure(() => fixture({ failQuery: 'records' }).repository.readAll(), 'read-failed');
});

for (const kind of KINDS) {
  test(`queryAll ${kind} 실패는 부분 데이터를 반환하지 않고 원문 오류를 감춘다`, async () => {
    const f = fixture({ failQuery: kind });
    await expectSafeFailure(() => f.repository.readAll(), 'read-failed');
  });
}

test('삭제·잘못된 ID·source·parent 페이지는 codec 전에 제외한다', async () => {
  const rows = baselineRows();
  rows.beans.push(beanPage(IDS.otherBean, '삭제된 원두')); rows.beans.at(-1).archived = true;
  rows.beans.push(beanPage('bad-page-id', '잘못된 ID'));
  rows.beans.push({ ...beanPage(), id: IDS.fifthRecipe, parent: { type: 'workspace', workspace: true } });
  rows.bags.push(bagPage(IDS.otherBag, IDS.otherBean));
  rows.bags.push(bagPage(IDS.pageD, IDS.bean, '다른 source 봉지'));
  rows.bags.at(-1).parent.data_source_id = SOURCES.beans;
  rows.recipes.push(recipePage(IDS.secondRecipe)); rows.recipes.at(-1).archived = true;
  rows.recipes.push(recipePage(IDS.thirdRecipe)); rows.recipes.at(-1).parent.data_source_id = SOURCES.beans;
  rows.steps.push(stepPage(IDS.recipe, storedRecipe().steps[0], IDS.pageB, { in_trash: true }));
  rows.steps.push(stepPage(IDS.recipe, storedRecipe().steps[0], IDS.pageC, { archived: true }));
  const f = fixture({ rows });
  const result = await f.repository.readAll();
  assert.deepEqual(result.beans.map(bean => bean.id), [IDS.bean]);
  assert.deepEqual(result.bags.map(bag => bag.id), [IDS.bag]);
  assert.deepEqual(result.recipes.map(recipe => recipe.id), [IDS.recipe]);
  assert.equal(result.excluded.bags, 2);
  assert.equal(result.excluded.recipes, 2);
  assert.equal(result.excluded.steps, 2);
});

test('잘리거나 다중인 관계가 있어도 기존 기록과 평가는 보존하고 불확실성을 표시한다', async () => {
  const rows = baselineRows();
  rows.bags.push(bagPage(IDS.otherBag));
  setRelation(rows.bags[1], '원두', [IDS.bean], true);
  rows.bags.push(bagPage(IDS.pageB)); setRelation(rows.bags[2], '원두', [IDS.bean, IDS.otherBean]);
  rows.bags.push(bagPage(IDS.pageC)); delete rows.bags[3].properties['원두'];
  rows.bags.push(bagPage(IDS.pageD, IDS.otherBean));
  rows.beans.push(beanPage(IDS.otherBean, '다른 원두'));
  rows.recipes.push(recipePage(IDS.secondRecipe)); setRelation(rows.recipes[1], '원두', [IDS.bean, IDS.otherBean]);
  rows.recipes.push(recipePage(IDS.thirdRecipe, { name: '사라진 원두 레시피' }));
  setRelation(rows.recipes[2], '원두', ['b1111111-1111-4111-8111-999999999999']);
  rows.steps.push(stepPage(IDS.recipe, storedRecipe().steps[0], IDS.pageB));
  setRelation(rows.steps.at(-1), '레시피', [IDS.recipe], true);
  rows.records.push(recordPage({ id: IDS.secondRecord, bagId: IDS.bag }));
  setRelation(rows.records[1], '원두 봉지', [IDS.bag, IDS.otherBag]);
  rows.records.push(recordPage({ id: IDS.pageC, bagId: IDS.otherBag }));
  const f = fixture({ rows });
  const result = await f.repository.readAll();
  assert.deepEqual(result.bags.map(bag => bag.id), [IDS.bag, IDS.pageD]);
  assert.deepEqual(result.recipes, []);
  assert.deepEqual(result.records.map(record => record.id), [IDS.record, IDS.secondRecord, IDS.pageC]);
  assert.deepEqual(result.records[0].snapshot, legacySnapshot(storedRecipe()));
  assert.equal(result.records[1].beanResolution, 'relation');
  assert.equal(result.records[1].rating, 4);
  assert.deepEqual(result.records[1].bagCandidates, [IDS.bag, IDS.otherBag]);
  assert.equal(result.records[2].beanResolution, 'relation');
  assert.deepEqual(result.excluded, { bags: 3, recipes: 3, records: 0, steps: 1 });
});

test('기록의 봉지 관계와 과거 원두 충돌은 평가를 보존하고 확인 대상으로 둔다', async () => {
  const rows = baselineRows();
  rows.beans.push(beanPage(IDS.otherBean, '다른 원두'));
  rows.bags.push(bagPage(IDS.otherBag, IDS.otherBean, '다른 원두 봉지'));
  rows.records = [
    recordPage({ id: IDS.record, bagId: null }),
    recordPage({ id: IDS.secondRecord, bagId: 'b2222222-2222-4222-8222-999999999999' }),
    recordPage({ id: IDS.pageB, bagId: IDS.otherBag }),
  ];

  const result = await fixture({ rows }).repository.readAll();
  assert.deepEqual(result.records.map(record => record.id), [IDS.record, IDS.secondRecord, IDS.pageB]);
  assert.equal(result.records[1].bagId, 'b2222222-2222-4222-8222-999999999999');
  assert.equal(result.records[2].beanResolution, 'needs-confirmation');
  assert.equal(result.records[2].rating, 4);
  assert.equal(result.excluded.records, 0);
});

test('records.bean 관계가 없어도 snapshot·legacy recipe·bag 근거를 읽고 모순은 확인 대상으로 보존한다', async () => {
  const rows = baselineRows();
  rows.records = [
    recordPage({ id: IDS.record, beanId: null, bagId: IDS.bag, snapshot: { ...legacySnapshot(storedRecipe()), beanId: IDS.bean } }),
    recordPage({ id: IDS.secondRecord, beanId: null, bagId: IDS.bag, snapshot: null }),
  ];
  for (const page of rows.records) delete page.properties['원두'];
  const result = await fixture({ rows }).repository.readAll();
  assert.deepEqual(result.records.map(record => record.beanId), [IDS.bean, IDS.bean]);
  assert.equal(result.records[0].beanResolution, 'snapshot-v1');
  assert.equal(result.records[1].beanResolution, 'legacy-recipe');
  assert.ok(result.records.every(record => record.rating === 4));
});

test('버전 1 snapshot 전체·기록 날짜·별점을 검증한다', async () => {
  const rows = baselineRows();
  const damagedSnapshot = legacySnapshot(storedRecipe());
  damagedSnapshot.steps[1].cumulativeWater = 151;
  rows.records = [
    recordPage({ id: IDS.record, bagId: null }),
    recordPage({ id: IDS.secondRecord, bagId: null, snapshot: damagedSnapshot }),
    recordPage({ id: IDS.pageB, bagId: null }),
    recordPage({ id: IDS.pageC, bagId: null }),
  ];
  rows.records[2].properties['날짜'].date.start = 'not-a-date';
  rows.records[3].properties['별점'].number = 6;

  const result = await fixture({ rows }).repository.readAll();
  assert.deepEqual(result.records.map(record => record.id), [IDS.record, IDS.secondRecord, IDS.pageB, IDS.pageC]);
  assert.equal(result.records[1].rating, 4);
  assert.equal(result.records[1].beanResolution, 'relation');
  assert.equal(result.records[2].date, 'not-a-date');
  assert.deepEqual(result.records[2].invalidFields, ['date']);
  assert.equal(result.records[3].rating, 6);
  assert.deepEqual(result.records[3].invalidFields, ['rating']);
  assert.deepEqual(result.recipes[0].stats, { count: 3, average: 4 });
  assert.equal(result.excluded.records, 0);
});

test('multi-bean legacy recipe candidates conflict with a v1 snapshot and remain unresolved', async () => {
  const rows = baselineRows();
  rows.beans.push(beanPage(IDS.otherBean, '케냐'));
  rows.recipes[0].properties['원두'] = {
    id: 'legacy-recipe-bean', type: 'relation',
    relation: [{ id: IDS.bean }, { id: IDS.otherBean }], has_more: false,
  };
  rows.records = [recordPage({ beanId: null, bagId: null,
    snapshot: { ...legacySnapshot(storedRecipe()), beanId: IDS.bean } })];

  const result = await fixture({ rows }).repository.readAll();
  const record = result.records[0];
  assert.equal(record.beanId, null);
  assert.equal(record.beanResolution, 'needs-confirmation');
  assert.deepEqual(record.beanCandidates, [IDS.bean, IDS.otherBean]);
  assert.deepEqual(record.relationEvidence.legacyRecipeBean, {
    ids: [IDS.bean, IDS.otherBean], complete: true, present: true,
  });
});

test('truncated legacy relations preserve observed candidates and force confirmation', async () => {
  const rows = baselineRows();
  rows.records = [recordPage({ beanId: null, bagId: null,
    snapshot: { ...legacySnapshot(storedRecipe()), beanId: IDS.bean } })];
  rows.recipes[0].properties['원두'] = {
    id: 'legacy-recipe-bean', type: 'relation', relation: [{ id: IDS.bean }], has_more: true,
  };
  rows.records[0].properties['원두'] = {
    id: 'record-bean', type: 'relation', relation: [{ id: IDS.bean }], has_more: true,
  };

  const result = await fixture({ rows }).repository.readAll();
  const record = result.records[0];
  assert.equal(record.beanId, null);
  assert.equal(record.beanResolution, 'needs-confirmation');
  assert.deepEqual(record.beanCandidates, [IDS.bean]);
  assert.equal(record.relationEvidence.bean.complete, false);
  assert.equal(record.relationEvidence.legacyRecipeBean.complete, false);
});

test('invalid v1/v2 snapshots remain attached to the record as damage status, not renderable data', async () => {
  const rows = baselineRows();
  const v1 = legacySnapshot(storedRecipe());
  v1.steps = { broken: true };
  const v2Recipe = storedRecipe();
  v2Recipe.steps = { broken: true };
  rows.records = [
    recordPage({ id: IDS.record, snapshot: v1 }),
    recordPage({ id: IDS.secondRecord, snapshot: {
      version: 2,
      bean: { id: IDS.bean, name: '에티오피아', roaster: '', origin: '', variety: '', process: '', tastingNotes: '' },
      recipe: v2Recipe,
    } }),
  ];

  const result = await fixture({ rows }).repository.readAll();
  assert.equal(result.records.length, 2);
  assert.deepEqual(result.records.map(record => record.rating), [4, 4]);
  assert.ok(result.records.every(record => record.snapshot === null));
  assert.ok(result.records.every(record => record.snapshotStatus === 'damaged'));
  assert.equal(result.excluded.records, 0);
});

test('잘못된 recipe 속성은 recipe만 제외하고 손상된 record 필드도 원본 평가를 보존한다', async () => {
  const rows = baselineRows();
  rows.recipes[0].properties['드리퍼'].type = 'number';
  rows.records[0].properties['컵노트'].rich_text = {};

  const result = await fixture({ rows }).repository.readAll();
  assert.deepEqual(result.recipes, []);
  assert.deepEqual(result.records.map(record => record.id), [IDS.record]);
  assert.equal(result.records[0].rating, 4);
  assert.equal(result.records[0].cupNote, '');
  assert.equal(result.records[0].snapshot.version, 1);
  assert.equal(result.excluded.recipes, 1);
  assert.equal(result.excluded.records, 0);
});

test('order 1 부재·순서 gap/중복·파생값 손상·tiny-water 자식 삭제는 완성 레시피로 노출하지 않는다', async () => {
  const rows = baselineRows();
  const missingStartId = IDS.secondRecipe;
  const gapId = IDS.thirdRecipe;
  const duplicateId = IDS.fourthRecipe;
  const derivedId = IDS.fifthRecipe;
  for (const id of [missingStartId, gapId, duplicateId, derivedId]) rows.recipes.push(recipePage(id));
  const base = storedRecipe();
  rows.steps.push(...base.steps.slice(1).map((step, index) => stepPage(missingStartId, step,
    index === 0 ? IDS.pageD : IDS.pageC)));
  rows.steps.push(stepPage(gapId, { ...base.steps[0], order: 1 }, IDS.pageB));
  rows.steps.push(stepPage(gapId, { ...base.steps[1], order: 3 }, IDS.pageD));
  rows.steps.push(stepPage(duplicateId, { ...base.steps[0], order: 1 }, IDS.pageC));
  rows.steps.push(stepPage(duplicateId, { ...base.steps[1], order: 1 }, IDS.pageD));
  rows.steps.push(...base.steps.map((step, index) => stepPage(derivedId,
    index === 1 ? { ...step, cumulativeWater: 151 } : step, IDS.pageA)));
  const tinyId = 'b6666666-6666-4666-8666-666666666666';
  const tinyInput = recipeInput({ totalWater: 100, steps: [
    { name: '극소량 시작', time: '0:00', water: 0.0000001 },
    { name: '나머지', time: '0:30', water: 99.9999999 },
  ] });
  rows.recipes.push(recipePage(tinyId, { totalWater: 100 }));
  const tinySteps = validateRecipe(tinyInput).steps.map((step, index) => stepPage(tinyId, step,
    index === 0 ? IDS.pageB : IDS.pageD));
  rows.steps.push(...tinySteps);
  const f = fixture({ rows, onQuery(kind, currentRows) {
    if (kind === 'steps') currentRows.steps.find(page => page.parent && page.properties['단계 이름']?.title?.[0]?.text?.content === '극소량 시작').archived = true;
  } });
  const result = await f.repository.readAll();
  assert.deepEqual(result.recipes.map(recipe => recipe.id), [IDS.recipe]);
  assert.equal(result.excluded.recipes, 5);
  assert.equal(result.excluded.steps, 1);
});

test('epsilon 경계에서 손상된 마지막 자식이 남은 prefix를 완성 레시피로 만들지 않는다', async () => {
  const { rows, recipe } = epsilonRows();
  assert.equal(recipe.steps[0].cumulativeWater, 50);
  rows.steps[1].properties['이번에 붓는 물 양(g)'].type = 'rich_text';

  const result = await fixture({ rows }).repository.readAll();
  assert.deepEqual(result.recipes, []);
  assert.equal(result.excluded.recipes, 1);
  assert.equal(result.excluded.steps, 1);
});

test('식별 가능한 부모 관계가 있는 잘못된 자식은 그 부모를 taint한다', async t => {
  const scenarios = [
    ['잘못된 number 값', page => { page.properties['이번에 붓는 물 양(g)'].number = '0.0000005'; }],
    ['잘못된 property type', page => { page.properties['단계 이름'].type = 'number'; }],
    ['복수 부모 관계', page => setRelation(page, '레시피', [IDS.recipe, IDS.secondRecipe])],
    ['잘린 부모 관계', page => setRelation(page, '레시피', [IDS.recipe], true)],
    ['관계 배열이 남은 잘못된 relation type', page => { page.properties['레시피'].type = 'rich_text'; }],
    ['관계 배열이 남은 잘못된 child ID', page => { page.id = 'bad-page-id'; }],
    ['관계 배열이 남은 잘못된 child source', page => { page.parent.data_source_id = SOURCES.beans; }],
  ];

  for (const [label, corrupt] of scenarios) {
    await t.test(label, async () => {
      const { rows } = epsilonRows();
      corrupt(rows.steps[1]);
      const f = fixture({ rows });

      const result = await f.repository.readAll();
      assert.deepEqual(result.recipes, []);
      assert.equal(result.excluded.recipes, 1);
      assert.equal(result.excluded.steps, 1);
      assert.equal(f.calls.filter(call => call.method === 'getPage').length, 0);
    });
  }
});

test('parent 조회 뒤 parent archive 또는 조건·bean·last_edited_time 변경은 전체 조회를 stale-read로 끝낸다', async t => {
  const mutations = [
    ['archive', parent => { parent.archived = true; }],
    ['trash', parent => { parent.in_trash = true; }],
    ['name', parent => { parent.properties['레시피 이름'].title[0].text.content = '새 이름'; }],
    ['dripper', parent => { parent.properties['드리퍼'].rich_text[0].text.content = '새 드리퍼'; }],
    ['dose', parent => { parent.properties['원두 사용량(g)'].number = 16; }],
    ['grind', parent => { parent.properties['분쇄도'].rich_text[0].text.content = '새 분쇄도'; }],
    ['grinder', parent => { parent.properties['그라인더 이름'].rich_text[0].text.content = '새 그라인더'; }],
    ['grinder setting', parent => { parent.properties['그라인더 설정값'].rich_text[0].text.content = '21'; }],
    ['microns', parent => { parent.properties['분쇄 입자 굵기(μm)'].number = 500; }],
    ['temperature', parent => { parent.properties['물 온도(℃)'].number = 90; }],
    ['total water', parent => { parent.properties['총 물 양(g)'].number = 251; }],
    ['bean relation', parent => setRelation(parent, '원두', [IDS.otherBean])],
    ['last edited', parent => { parent.last_edited_time = '2026-10-18T10:00:01.000Z'; }],
    ['source', parent => { parent.parent.data_source_id = SOURCES.beans; }],
  ];
  for (const [label, mutate] of mutations) {
    await t.test(label, async () => {
      const f = fixture({ onQuery(kind, _rows, parents) {
        if (kind === 'steps') mutate(parents.get(IDS.recipe));
      } });
      await expectSafeFailure(() => f.repository.readAll(), 'stale-read');
      assert.equal(f.calls.filter(call => call.method === 'getPage').length, 1);
    });
  }
});

test('parent 비교는 첫 rich text 조각 뒤의 변경도 stale-read로 감지한다', async () => {
  const rows = baselineRows();
  rows.recipes[0] = recipePage(IDS.recipe, { dripper: `${'x'.repeat(2000)}a` });
  const f = fixture({ rows, onQuery(kind, _rows, parents) {
    if (kind === 'steps') parents.get(IDS.recipe).properties['드리퍼'].rich_text[1].text.content = 'b';
  } });

  await expectSafeFailure(() => f.repository.readAll(), 'stale-read');
});

test('parent 최종 getPage 실패와 ID 불일치는 안전 stale-read로 전환한다', async t => {
  for (const scenario of ['failure', 'id-mismatch']) {
    await t.test(scenario, async () => {
      const f = fixture({ failGetPage: scenario === 'failure' ? true : undefined,
        onGetPage(id, parents) {
          if (scenario === 'id-mismatch') parents.get(id).id = IDS.secondRecipe;
        } });
      await expectSafeFailure(() => f.repository.readAll(), 'stale-read');
    });
  }
});

test('현재 recipe가 삭제되어도 유효한 과거 record snapshot은 저장된 값 그대로 읽는다', async () => {
  const rows = baselineRows();
  rows.recipes = [];
  rows.steps = [];
  const historic = legacySnapshot(storedRecipe());
  historic.temperature = 91;
  rows.records = [recordPage({ snapshot: historic, bagId: null })];
  const result = await fixture({ rows }).repository.readAll();
  assert.equal(result.recipes.length, 0);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].recipeId, IDS.recipe);
  assert.equal(result.records[0].snapshot.temperature, 91);
  assert.deepEqual(result.excluded, { bags: 0, recipes: 0, records: 0, steps: 0 });
});

test('손상되거나 버전이 다른 record snapshot은 제외하고 원본을 공개하지 않는다', async () => {
  const rows = baselineRows();
  rows.records = [
    recordPage({ id: IDS.record, snapshot: { ...legacySnapshot(storedRecipe()), version: 9 } }),
    recordPage({ id: IDS.secondRecord }),
  ];
  rows.records[1].properties['당시 레시피 스냅샷'].rich_text = [{ type: 'text', text: { content: '{ broken secret ' + TOKEN } }];
  const result = await fixture({ rows }).repository.readAll();
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].beanResolution, 'relation');
  assert.equal(result.records[0].rating, 4);
  assert.equal(result.records[1].snapshot, null);
  assert.equal(result.records[1].rating, 4);
  assert.equal(result.excluded.records, 0);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(TOKEN));
});

test('readRecipeForSnapshot은 매 호출마다 다섯 source와 parent를 새로 확인한다', async () => {
  const f = fixture();
  const first = await f.repository.readRecipeForSnapshot(IDS.recipe.toUpperCase());
  assert.equal(first.id, IDS.recipe);
  assert.deepEqual(first.steps.map(step => step.order), [1, 2, 3]);
  f.rows.recipes[0].properties['물 온도(℃)'].number = 90;
  f.rows.recipes[0].last_edited_time = '2026-10-18T11:00:00.000Z';
  const second = await f.repository.readRecipeForSnapshot(IDS.recipe);
  assert.equal(second.temperature, 90);
  assert.notEqual(first, second);
  assert.equal(f.calls.filter(call => call.method === 'queryAll').length, 10);
  assert.equal(f.calls.filter(call => call.method === 'getPage').length, 2);
  await expectSafeFailure(() => f.repository.readRecipeForSnapshot('bad-id'), 'invalid-input');
  await expectSafeFailure(() => f.repository.readRecipeForSnapshot(IDS.otherRecipe ?? IDS.secondRecipe), 'recipe-unavailable');
});

test('관계 부재와 완전 조회 실패는 빈 collection으로 위장하지 않는다', async () => {
  const f = fixture({ failQuery: 'steps' });
  await expectSafeFailure(() => f.repository.readAll(), 'read-failed');
});
