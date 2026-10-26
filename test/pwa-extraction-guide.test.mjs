import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InputError,
  copyRecipe,
  createSnapshot,
  validateRecipe,
  validateStoredSnapshot,
} from '../lib/domain.mjs';
import { NotionClient as ServerNotionClient, NotionRepository } from '../lib/notion.mjs';
import { NotionClient as PwaNotionClient } from '../pwa/data/notion-client.mjs';
import { decodePage, encodeProperties, relationTargets, schemas } from '../pwa/data/notion-properties.mjs';

const DATA_SOURCES = Object.freeze({
  beans: '11111111-1111-4111-8111-111111111111',
  recipes: '33333333-3333-4333-8333-333333333333',
  steps: '44444444-4444-4444-8444-444444444444',
  records: '55555555-5555-4555-8555-555555555555',
});
const REVISION = '99999999-9999-4999-8999-999999999999';
const RECIPE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GUIDE = '교반 없음\n목표 추출 완료 시간: 2분 30초';

function recipe(overrides = {}) {
  return {
    name: 'V60', dose: 15, temperature: 93, totalWater: 250,
    steps: [{ name: '붓기', time: '0:00', water: 250 }],
    ...overrides,
  };
}

function source(kind, { guide = true, wrongGuideType = false } = {}) {
  const properties = Object.fromEntries(Object.entries(schemas[kind]).map(([field, [name, type]]) => {
    if (kind === 'recipes' && field === 'extractionGuide' && !guide) return null;
    const propertyType = kind === 'recipes' && field === 'extractionGuide' && wrongGuideType ? 'number' : type;
    const relation = type === 'relation'
      ? { data_source_id: DATA_SOURCES[relationTargets[kind][field]] }
      : undefined;
    return [name, { type: propertyType, ...(relation ? { relation } : {}) }];
  }).filter(Boolean));
  return { object: 'data_source', id: DATA_SOURCES[kind], properties };
}

function pageForCreate(kind, properties) {
  const responseProperties = Object.fromEntries(Object.entries(properties).map(([name, typed]) => {
    const [type, value] = Object.entries(typed)[0];
    return [name, { type, [type]: value }];
  }));
  return {
    object: 'page', id: PAGE_ID, properties: responseProperties,
    parent: { type: 'data_source_id', data_source_id: DATA_SOURCES[kind] },
    in_trash: false, archived: false,
  };
}

function pwaHarness({ guide = true, wrongGuideType = false } = {}) {
  const calls = [];
  const client = new PwaNotionClient('synthetic-token', {
    dataSources: DATA_SOURCES,
    connectionRevision: REVISION,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      const kind = Object.keys(DATA_SOURCES).find(key => url.endsWith('/data_sources/' + DATA_SOURCES[key]));
      if (kind) return Response.json(source(kind, { guide: kind !== 'recipes' || guide,
        wrongGuideType: kind === 'recipes' && wrongGuideType }));
      if (url === 'https://api.notion.com/v1/pages' && init.method === 'POST') {
        const body = JSON.parse(init.body);
        const kindForPage = Object.keys(DATA_SOURCES).find(key => body.parent.data_source_id === DATA_SOURCES[key]);
        return Response.json(pageForCreate(kindForPage, body.properties));
      }
      throw new Error('Unexpected test request');
    },
    timeoutMs: 100,
  });
  return { client, calls };
}

function pageProperties(properties) {
  return Object.fromEntries(Object.entries(properties).map(([name, typed]) => {
    const [type, value] = Object.entries(typed)[0];
    return [name, { type, [type]: value }];
  }));
}

test('레시피 입력은 선택 추출 가이드를 정규화하고 복사와 새 snapshot에 보존한다', () => {
  const bean = { id: PAGE_ID, name: '에티오피아' };
  const original = { id: RECIPE_ID, ...validateRecipe(recipe({ extractionGuide: ` ${GUIDE} ` })) };
  assert.equal(original.extractionGuide, GUIDE);

  const copy = copyRecipe(original);
  assert.equal(copy.extractionGuide, GUIDE);
  assert.equal(copy.id, undefined);

  const snapshot = createSnapshot(bean, original);
  assert.equal(snapshot.recipe.extractionGuide, GUIDE);

  assert.equal(validateRecipe(recipe()).extractionGuide, '');
  assert.equal(validateRecipe(recipe({ extractionGuide: 42 })).extractionGuide, '');
});

test('추출 가이드가 없는 과거 recipe와 version 1/2 snapshot은 계속 유효하다', () => {
  const oldRecipe = validateRecipe(recipe());
  delete oldRecipe.extractionGuide;
  assert.doesNotThrow(() => validateStoredSnapshot({ version: 1, id: RECIPE_ID, ...oldRecipe }));
  assert.doesNotThrow(() => validateStoredSnapshot({
    version: 2,
    bean: { id: PAGE_ID, name: '에티오피아' },
    recipe: { id: RECIPE_ID, ...oldRecipe },
  }));
});

test('추출 가이드는 Notion rich_text로 왕복하고 과거 레시피 행은 빈 값으로 읽힌다', () => {
  assert.deepEqual(schemas.recipes.extractionGuide, ['추출 가이드', 'rich_text']);
  const input = validateRecipe(recipe({ extractionGuide: GUIDE }));
  const encoded = encodeProperties('recipes', input);
  assert.deepEqual(encoded['추출 가이드'], {
    rich_text: [{ type: 'text', text: { content: GUIDE } }],
  });
  const decoded = decodePage('recipes', { id: RECIPE_ID, properties: pageProperties(encoded) });
  assert.equal(decoded.extractionGuide, GUIDE);
  assert.equal(decodePage('recipes', { id: RECIPE_ID, properties: {} }).extractionGuide, '');

  const longGuide = '가'.repeat(4500);
  const longEncoded = encodeProperties('recipes', { name: '긴 안내', extractionGuide: longGuide });
  assert.equal(longEncoded['추출 가이드'].rich_text.length, 3);
  assert.equal(decodePage('recipes', { id: RECIPE_ID, properties: pageProperties(longEncoded) }).extractionGuide, longGuide);
});

test('PWA schema 검증은 추출 가이드 속성이 없는 구버전 DB를 허용하고 타입 오류는 거부한다', async () => {
  const old = pwaHarness({ guide: false });
  assert.equal(await old.client.verify(), true);
  assert.equal(old.client.recipeExtractionGuideSupported, false);

  const wrong = pwaHarness({ wrongGuideType: true });
  await assert.rejects(wrong.client.verify(), error => error.code === 'invalid-response');
});

test('PWA는 지원 schema에 rich_text 가이드를 저장하고 구버전에는 값 손실 없이 fail-closed 한다', async () => {
  const current = pwaHarness();
  await current.client.verify();
  const saved = await current.client.createPage('recipes', { name: '가이드 포함', extractionGuide: GUIDE });
  const wire = JSON.parse(current.calls.at(-1).init.body).properties;
  assert.deepEqual(wire['추출 가이드'], {
    rich_text: [{ type: 'text', text: { content: GUIDE } }],
  });
  assert.equal(decodePage('recipes', saved).extractionGuide, GUIDE);

  const old = pwaHarness({ guide: false });
  await old.client.verify();
  await assert.rejects(old.client.createPage('recipes', { name: '구버전', extractionGuide: GUIDE }), error => {
    assert.equal(error.code, 'recipe-guide-unsupported');
    assert.equal(error.writeState, 'not-sent');
    return true;
  });
  await old.client.createPage('recipes', { name: '구버전', extractionGuide: '' });
  assert.equal(JSON.parse(old.calls.at(-1).init.body).properties['추출 가이드'], undefined);
  assert.equal(old.calls.filter(call => call.url.endsWith('/pages')).length, 1);
});

test('서버 schema 검증도 구버전 속성을 허용하고 잘못된 guide 타입을 거부한다', async () => {
  const makeClient = options => new ServerNotionClient('synthetic-token', {
    dataSources: DATA_SOURCES,
    fetchImpl: async url => {
      const kind = Object.keys(DATA_SOURCES).find(key => url.endsWith('/data_sources/' + DATA_SOURCES[key]));
      return Response.json(source(kind, options));
    },
    timeoutMs: 100,
  });
  const old = makeClient({ guide: false });
  await old.verify();
  assert.equal(old.recipeExtractionGuideSupported, false);

  const wrong = makeClient({ wrongGuideType: true });
  await assert.rejects(wrong.verify(), error => error instanceof InputError);
});

test('서버는 구버전 schema에서 빈 guide를 생략하고 비어 있지 않은 guide 쓰기를 거부한다', async () => {
  const writes = [];
  const repository = new NotionRepository({
    dataSources: DATA_SOURCES,
    recipeExtractionGuideSupported: false,
    async createPage(_source, properties) {
      writes.push(properties);
      return { id: PAGE_ID };
    },
  });
  await repository.create('recipes', { name: '호환 레시피', extractionGuide: '' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]['추출 가이드'], undefined);
  await assert.rejects(repository.create('recipes', { name: '보존 필요', extractionGuide: GUIDE }), error => {
    assert.ok(error instanceof InputError);
    return true;
  });
  assert.equal(writes.length, 1);
});
