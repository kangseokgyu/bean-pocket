import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  demoBeans,
  demoRecords,
  filterAndSortRecords,
  getRatingTrend,
  getRatingTrendCoordinates,
  getRecentlyBrewedBeans,
  getRoastAgeDays,
  summarizeBean,
} from '../pwa/records-demo.mjs';

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

test('최근 추출한 서로 다른 원두만 최신순으로 최대 3종 보여주고 입력은 바꾸지 않는다', () => {
  const beans = [
    { id: 'guji', name: '구지' },
    { id: 'huila', name: '우일라' },
    { id: 'kirinyaga', name: '키리냐가' },
    { id: 'gesha', name: '게이샤' },
    { id: 'no-record', name: '기록 없음' },
  ];
  const recipe = name => ({ name });
  const records = [
    { id: 'guji-older', beanId: 'guji', brewedOn: '2026-10-02', rating: 3, recipe: recipe('오래된 레시피') },
    { id: 'huila-latest', beanId: 'huila', brewedOn: '2026-10-27', rating: 4, recipe: recipe('우일라 레시피') },
    { id: 'kirinyaga-latest', beanId: 'kirinyaga', brewedOn: '2026-10-25', rating: 5, recipe: recipe('키리냐가 레시피') },
    { id: 'guji-latest', beanId: 'guji', brewedOn: '2026-10-23', rating: 5, recipe: recipe('구지 최신 레시피') },
    { id: 'gesha-latest', beanId: 'gesha', brewedOn: '2026-10-25', rating: 2, recipe: recipe('게이샤 레시피') },
    { id: 'orphan', beanId: 'unknown-bean', brewedOn: '2026-10-29', rating: 5, recipe: recipe('없는 원두') },
    { id: 'huila-older', beanId: 'huila', brewedOn: '2026-10-10', rating: 5, recipe: recipe('이전 우일라 레시피') },
  ];
  const beansBefore = structuredClone(beans);
  const recordsBefore = structuredClone(records);

  const recent = getRecentlyBrewedBeans(beans, records);

  assert.deepEqual(recent.map(item => item.bean.id), ['huila', 'gesha', 'kirinyaga']);
  assert.deepEqual(recent.map(item => item.latestRecord.id), ['huila-latest', 'gesha-latest', 'kirinyaga-latest']);
  assert.equal(recent.length, 3);
  assert.equal(getRecentlyBrewedBeans(beans, records, 4)[3].latestRecord.id, 'guji-latest');
  assert.deepEqual(beans, beansBefore);
  assert.deepEqual(records, recordsBefore);
});

test('선택 원두의 별점 추이는 전체 기록을 날짜 오름차순으로 정렬하고 y축은 1~5점 고정이다', () => {
  const records = [
    { id: 'later', beanId: 'guji', brewedOn: '2026-10-11', rating: 5 },
    { id: 'other-bean', beanId: 'huila', brewedOn: '2026-10-01', rating: 1 },
    { id: 'middle', beanId: 'guji', brewedOn: '2026-10-03', rating: 3 },
    { id: 'earlier', beanId: 'guji', brewedOn: '2026-10-01', rating: 1 },
  ];
  const originalIds = records.map(record => record.id);

  const trend = getRatingTrend(records, 'guji');
  const points = getRatingTrendCoordinates(trend, {
    width: 100,
    height: 100,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  assert.deepEqual(trend.map(record => record.id), ['earlier', 'middle', 'later']);
  assert.deepEqual(points.map(point => point.x), [0, 20, 100], 'x 좌표는 날짜 차이를 실제 일수 비율로 반영한다');
  assert.deepEqual(points.map(point => point.y), [100, 50, 0], '평점 1점은 아래, 5점은 위에 고정한다');
  assert.deepEqual(records.map(record => record.id), originalIds);
  assert.deepEqual(getRatingTrend(records, 'no-record'), []);
  assert.deepEqual(getRatingTrendCoordinates([], { width: 100, height: 100 }), []);
  assert.equal(
    getRatingTrendCoordinates([{ id: 'only', brewedOn: '2026-10-08', rating: 4 }], {
      width: 100,
      height: 100,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    })[0].x,
    50,
    '기록 한 건의 점은 그래프 가운데에 둔다',
  );
  assert.deepEqual(
    getRatingTrendCoordinates([
      { id: 'same-day-one', brewedOn: '2026-10-08', rating: 2 },
      { id: 'same-day-two', brewedOn: '2026-10-08', rating: 4 },
    ], {
      width: 100,
      height: 100,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    }).map(point => point.x),
    [50, 50],
    '같은 날짜에 추출한 기록은 같은 x 좌표에 둔다',
  );
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
