import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { demoBeans, demoRecords, filterAndSortRecords, getRoastAgeDays, summarizeBean } from '../pwa/records-demo.mjs';

test('데모는 실제 기록과 분리된 원두 3종 이상의 샘플을 제공한다', () => {
  assert.ok(demoBeans.length >= 3);
  assert.ok(demoRecords.length >= demoBeans.length * 3);
  assert.ok(demoRecords.every(record => record.beanId && record.recipe && Number.isInteger(record.rating)));
});

test('원두 요약은 최고 평가를 기록에서 계산하고 기록 표본 수와 평균을 함께 제공한다', () => {
  const bean = demoBeans[0];
  const beanRecords = demoRecords.filter(record => record.beanId === bean.id);
  const highestRating = Math.max(...beanRecords.map(record => record.rating));
  const latestHighestRecord = beanRecords
    .filter(record => record.rating === highestRating)
    .sort((left, right) => right.brewedOn.localeCompare(left.brewedOn))[0];
  const summary = summarizeBean(bean.id, demoBeans, demoRecords);

  assert.equal(summary.bean.id, bean.id);
  assert.equal(summary.recordCount, beanRecords.length);
  assert.equal(summary.averageRating, Math.round(beanRecords.reduce((sum, record) => sum + record.rating, 0) / beanRecords.length * 10) / 10);
  assert.equal(summary.bestRecord.id, latestHighestRecord.id, '최고점이 같으면 가장 최근 추출을 대표 기록으로 표시한다');
});

test('원두 선택과 레시피 필터를 적용한 뒤 날짜 또는 평가 순으로 정렬한다', () => {
  const beanId = demoBeans[0].id;
  const recipeFamily = demoRecords.find(record => record.beanId === beanId).recipe.family;
  const matching = demoRecords.filter(record => record.beanId === beanId && record.recipe.family === recipeFamily);
  const dateSorted = filterAndSortRecords(demoRecords, { beanId, recipeFamily, sort: 'date-desc' });
  const ratingSorted = filterAndSortRecords(demoRecords, { beanId, recipeFamily, sort: 'rating-desc' });

  assert.ok(dateSorted.length > 0);
  assert.ok(dateSorted.every(record => record.beanId === beanId && record.recipe.family === recipeFamily));
  assert.deepEqual(dateSorted.map(record => record.id), [...matching].sort((left, right) => right.brewedOn.localeCompare(left.brewedOn)).map(record => record.id));
  assert.deepEqual(ratingSorted.map(record => record.id), [...matching].sort((left, right) => right.rating - left.rating || right.brewedOn.localeCompare(left.brewedOn)).map(record => record.id));
  assert.deepEqual(demoRecords.map(record => record.id), [...demoRecords].map(record => record.id), '정렬은 원본 샘플 배열을 변경하지 않는다');
});

test('원두별 기록이 없거나 필터 결과가 없으면 빈 요약과 빈 배열을 돌려준다', () => {
  const emptyBean = { id: 'empty-bean', name: '기록 없는 원두' };
  const summary = summarizeBean(emptyBean.id, [emptyBean], []);

  assert.equal(summary.recordCount, 0);
  assert.equal(summary.averageRating, null);
  assert.equal(summary.bestRecord, null);
  assert.deepEqual(filterAndSortRecords(demoRecords, { beanId: demoBeans[0].id, recipeFamily: 'no-matching-recipe' }), []);
});

test('로스팅 날짜부터 추출 날짜까지 경과일을 계산한다', () => {
  assert.equal(getRoastAgeDays('2026-10-03', '2026-10-17'), 14);
  assert.equal(getRoastAgeDays('2024-02-28', '2024-03-01'), 2);
});

test('평점 표시는 채운 별과 빈 별을 숫자 평가에 맞춰 구분한다', async () => {
  const source = await readFile(new URL('../pwa/records-demo.mjs', import.meta.url), 'utf8');
  const document = {
    querySelector: () => null,
    createElement: () => ({
      children: [],
      append(...children) { this.children.push(...children); },
      setAttribute() {},
    }),
  };
  const context = vm.createContext({ document });
  vm.runInContext(source.replace(/^export /gm, ''), context);
  for (const [rating, expected] of [[3, '★★★☆☆'], [4, '★★★★☆'], [5, '★★★★★']]) {
    const rendered = vm.runInContext(`createRating(${rating})`, context);
    assert.equal(rendered.children[0].textContent, expected);
    assert.equal(rendered.children[1].textContent, `${rating}.0점`);
  }
});
