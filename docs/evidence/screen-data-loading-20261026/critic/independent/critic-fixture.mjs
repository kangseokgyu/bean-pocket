import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createSnapshot, validateRecipe } from '../lib/domain.mjs';
import { encodeProperties } from '../pwa/data/notion-properties.mjs';
import * as repositoryModule from '../pwa/data/read-repository.mjs';

const { createReadRepository } = repositoryModule;
const KINDS = ['beans', 'recipes', 'steps', 'records'];
const SOURCES = Object.freeze({
  beans: 'a1111111-1111-4111-8111-111111111111',
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
  return { ...rawPage('beans', id, { name }), properties: { '원두': { type: 'relation', relation: [{ id: beanId }], has_more: false } } };
}

function recordPage({ id = IDS.record, recipeId = IDS.recipe, beanId = IDS.bean, bagId = null, snapshot = legacySnapshot(storedRecipe(recipeId)), rating = 4 } = {}) {
  return rawPage('records', id, {
    name: '2026-10-18 · V60', beanId, recipeId, bagId, date: '2026-10-18', rating,
    cupNote: '복숭아와 꿀', snapshot,
  });
}

function baglessSnapshot(recipeId = IDS.recipe) {
  const currentRecipe = storedRecipe(recipeId);
  return createSnapshot({ id: IDS.bean, name: '에티오피아', roaster: '로스터리', origin: '구지',
    variety: '', process: '워시드', tastingNotes: '복숭아' }, currentRecipe);
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



export {SOURCES,IDS,beanPage,recipePage,standardStepPages,rawPage,baglessSnapshot};
