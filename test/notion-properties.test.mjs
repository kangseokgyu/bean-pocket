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
