import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePage, encodeProperties, schemas } from '../pwa/data/notion-properties.mjs';

test('긴 snapshot은 Notion rich_text 조각으로 나누고 원래 객체로 복원한다', () => {
  const snapshot = { note: '한'.repeat(5000) };
  const properties = encodeProperties('records', {
    name: '기록', recipeId: 'recipe-id', date: '2026-10-15', rating: 4, snapshot,
  });

  assert.equal(properties['당시 레시피 스냅샷'].rich_text.length, 3);
  const pageProperties = Object.fromEntries(Object.entries(properties).map(([name, value]) => {
    const [type, content] = Object.entries(value)[0];
    return [name, { type, [type]: content }];
  }));
  assert.deepEqual(decodePage('records', { id: 'record-id', properties: pageProperties }).snapshot, snapshot);
});

test('기록 codec은 bagless schema를 유지하고 legacy bag 입력을 wire에 넣지 않는다', () => {
  const properties = encodeProperties('records', {
    name: '기록', beanId: 'bean-id', recipeId: 'recipe-id', bagId: 'legacy-bag-id',
    date: '2026-10-26', rating: 5, snapshot: { version: 2, recordGeneration: 'bagless-v1' },
  });

  assert.equal(Object.hasOwn(schemas.records, 'bagId'), false);
  assert.equal(Object.hasOwn(properties, '원두 봉지'), false);
});

test('레시피 codec은 단일 μm 숫자와 선택적 범위 rich_text를 상호 배타적으로 저장한다', () => {
  assert.deepEqual(schemas.recipes.micronRange, ['분쇄 입자 범위(μm)', 'rich_text']);

  const range = encodeProperties('recipes', { microns: '900~1000' });
  assert.deepEqual(range['분쇄 입자 굵기(μm)'], { number: null });
  assert.deepEqual(range['분쇄 입자 범위(μm)'], {
    rich_text: [{ type: 'text', text: { content: '900~1000' } }],
  });
  const both = decodePage('recipes', { id: 'range', properties: {
    '분쇄 입자 굵기(μm)': { number: 700 },
    '분쇄 입자 범위(μm)': { rich_text: [{ plain_text: '900~1000' }] },
  } });
  assert.equal(both.microns, '900~1000');
  assert.deepEqual(both.micronStorage, { number: 700, range: '900~1000' });

  const numeric = encodeProperties('recipes', { microns: 700 });
  assert.deepEqual(numeric['분쇄 입자 굵기(μm)'], { number: 700 });
  assert.deepEqual(numeric['분쇄 입자 범위(μm)'], { rich_text: [] });
  assert.equal(decodePage('recipes', { id: 'legacy', properties: {
    '분쇄 입자 굵기(μm)': { number: 700 },
  } }).microns, 700);
});
