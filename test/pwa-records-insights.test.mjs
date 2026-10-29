import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecordsInsights, layoutRatingTrend } from '../pwa/ui/records-insights.mjs';

const generation = 'bagless-v1';

function record({ id, beanId, beanName = beanId, date, rating, recipeName = '보관된 레시피', ...extra }) {
  return {
    id, beanId, beanResolution: 'relation', date, rating, cupNote: `컵노트 ${id}`,
    snapshotStatus: 'valid', snapshot: {
      version: 2, recordGeneration: generation,
      bean: { id: beanId, name: beanName },
      recipe: { id: `recipe-${id}`, name: recipeName, dose: 15, totalWater: 240,
        temperature: 92, steps: [{ name: '뜸', seconds: 40, interval: 40, water: 40, cumulativeWater: 40 }] },
    },
    ...extra,
  };
}

test('three distinct beans are ordered by newest valid record with a stable tie break', () => {
  const records = [
    record({ id: 'old-a', beanId: 'bean-a', date: '2026-10-01', rating: 3 }),
    record({ id: 'new-b', beanId: 'bean-b', date: '2026-10-09', rating: 4 }),
    record({ id: 'new-a', beanId: 'bean-a', beanName: '시다마', date: '2026-10-12', rating: 5 }),
    record({ id: 'tie-d', beanId: 'bean-d', date: '2026-10-12', rating: 3 }),
    record({ id: 'fourth-c', beanId: 'bean-c', date: '2026-10-11', rating: 4 }),
  ];
  const model = buildRecordsInsights(records);

  assert.deepEqual(model.beans.map(bean => [bean.id, bean.latestDate]), [
    ['bean-a', '2026-10-12'], ['bean-d', '2026-10-12'], ['bean-c', '2026-10-11'],
  ]);
  assert.deepEqual(model.beans[0], {
    id: 'bean-a', name: '시다마', origin: '', roaster: '', variety: '', process: '', tastingNotes: '',
    latestDate: '2026-10-12', latestRecipeName: '보관된 레시피', latestRating: 5, latestRatingLabel: '5/5', recordCount: 2,
  });
  assert.deepEqual(model.beans[1], {
    id: 'bean-d', name: 'bean-d', origin: '', roaster: '', variety: '', process: '', tastingNotes: '',
    latestDate: '2026-10-12', latestRecipeName: '보관된 레시피', latestRating: 3, latestRatingLabel: '3/5', recordCount: 1,
  });
  assert.equal(model.selectedBeanId, 'bean-a');
  assert.equal(model.loadedCount, records.length);
});

test('selection, best record, and comparison values use only valid current snapshots without mutating inputs', () => {
  const records = [
    record({ id: 'older', beanId: 'bean-a', beanName: '과거 이름', date: '2026-10-01', rating: 5,
      recipeName: '당시 레시피', recipeId: 'live-recipe-id' }),
    record({ id: 'newer', beanId: 'bean-a', beanName: '과거 이름', date: '2026-10-05', rating: 5,
      recipeName: '새 당시 레시피' }),
    record({ id: 'unrated', beanId: 'bean-a', beanName: '과거 이름', date: '2026-10-06', rating: null }),
    record({ id: 'bad-rating', beanId: 'bean-a', beanName: '과거 이름', date: '2026-10-07', rating: 6 }),
    record({ id: 'bad-date', beanId: 'bean-a', date: 'yesterday', rating: 5 }),
    record({ id: 'ambiguous', beanId: 'bean-a', date: '2026-10-08', rating: 5,
      beanResolution: 'needs-confirmation' }),
    record({ id: 'old-generation', beanId: 'bean-a', date: '2026-10-09', rating: 5,
      snapshot: { version: 2, recordGeneration: 'legacy', bean: { id: 'bean-a' }, recipe: {} } }),
    { ...record({ id: 'damaged', beanId: 'bean-a', date: '2026-10-10', rating: 5 }), snapshotStatus: 'damaged' },
  ];
  const before = structuredClone(records);
  const model = buildRecordsInsights(records, [{ id: 'bean-a', name: '현재 이름' }], 'bean-a');

  assert.deepEqual(records, before, 'model construction must not mutate repository rows');
  assert.equal(model.selectedBean.name, '과거 이름', 'a valid bean snapshot keeps the historical name');
  assert.deepEqual(model.trend.map(point => [point.date, point.rating]), [['2026-10-01', 5], ['2026-10-05', 5]]);
  assert.equal(model.bestRecord.id, 'newer', 'equal ratings choose the newer valid date');
  assert.equal(model.bestRecord.snapshot.recipe.name, '새 당시 레시피');
  assert.deepEqual(model.comparisonRecords.map(record => record.id), ['unrated', 'newer', 'older']);
  assert.equal(model.eligibleCount, 4, 'unrated or invalidly rated records still establish valid bean/date membership');
  assert.equal(model.excludedCount, 4, 'invalid dates, ambiguous beans, stale generations and damaged snapshots are excluded');
});

test('bean summaries prefer recipe snapshots and only use live recipe names as a fallback', () => {
  const rows = [
    record({ id: 'snapshot', beanId: 'bean-a', beanName: '당시 원두', date: '2026-10-10', rating: 4,
      recipeName: '당시 레시피', recipeId: 'recipe-a' }),
    { ...record({ id: 'live-fallback', beanId: 'bean-b', beanName: '다른 원두', date: '2026-10-09', rating: 3 }),
      recipeId: 'recipe-live', snapshot: { version: 2, recordGeneration: generation,
        bean: { id: 'bean-b', name: '다른 원두' }, recipe: { id: 'recipe-live' } } },
    { ...record({ id: 'v1-snapshot', beanId: 'bean-c', beanName: '현재 원두 C', date: '2026-10-08', rating: 4 }),
      recipeId: 'recipe-v1', snapshot: { version: 1, recordGeneration: generation, id: 'recipe-v1', name: '당시 v1 레시피' } },
  ];
  const model = buildRecordsInsights(rows, [
    { id: 'bean-a', name: '현재 원두 A' }, { id: 'bean-b', name: '현재 원두 B' }, { id: 'bean-c', name: '현재 원두 C' },
  ], '', [{ id: 'recipe-a', name: '현재 레시피 A' }, { id: 'recipe-live', name: '현재 레시피 B' },
    { id: 'recipe-v1', name: '현재 레시피 C' }]);

  assert.deepEqual(model.beans.map(bean => [bean.name, bean.latestRecipeName]), [
    ['당시 원두', '당시 레시피'], ['다른 원두', '현재 레시피 B'], ['현재 원두 C', '당시 v1 레시피'],
  ]);
  const invalidRating = buildRecordsInsights([
    record({ id: 'invalid-rating', beanId: 'bean-d', date: '2026-10-11', rating: 6 }),
  ]);
  assert.equal(invalidRating.beans[0].latestRatingLabel, '별점 확인 필요');
});

test('selected bean statistics and comparison choices describe only loaded snapshot records', () => {
  const makeSnapshotRecord = ({ id, date, rating, recipeId, recipeName, version = 2 }) => {
    const item = record({ id, beanId: 'bean-a', beanName: '당시 구지', date, rating, recipeName, recipeId });
    item.snapshot.bean.origin = '당시 구지 농장';
    item.snapshot.bean.roaster = '당시 로스터리';
    item.snapshot.recipe.id = recipeId;
    if (version === 1) {
      item.snapshot = { version: 1, recordGeneration: generation, id: recipeId, name: recipeName,
        dripper: 'V60', grind: '중간', dose: 15, totalWater: 240, temperature: 92 };
    }
    return item;
  };
  const records = [
    makeSnapshotRecord({ id: 'older', date: '2026-10-01', rating: 4, recipeId: 'recipe-v60', recipeName: '기록 V60' }),
    makeSnapshotRecord({ id: 'unrated', date: '2026-10-03', rating: null, recipeId: 'recipe-origami', recipeName: '' }),
    makeSnapshotRecord({ id: 'invalid', date: '2026-10-04', rating: 6, recipeId: 'recipe-invalid', recipeName: '잘못된 별점 레시피' }),
    makeSnapshotRecord({ id: 'latest', date: '2026-10-05', rating: 5, recipeId: 'recipe-v60', recipeName: '기록 V60' }),
  ];
  const before = structuredClone(records);
  const model = buildRecordsInsights(records,
    [{ id: 'bean-a', name: '현재 이름', origin: '현재 원산지', roaster: '현재 로스터리' }], 'bean-a', [
      { id: 'recipe-origami', name: '현재 오리가미' }, { id: 'recipe-v60', name: '현재 V60' },
    ]);

  assert.deepEqual(records, before, 'aggregation must not mutate bounded repository records');
  assert.equal(model.selectedBean.name, '당시 구지');
  assert.equal(model.selectedBean.origin, '당시 구지 농장');
  assert.equal(model.selectedBean.roaster, '당시 로스터리');
  assert.equal(model.selectedBean.recordCount, 4);
  assert.equal(model.selectedRecordCount, 4);
  assert.equal(model.ratedRecordCount, 2);
  assert.equal(model.averageRating, 4.5);
  assert.deepEqual(model.comparisonRecords.map(item => item.id), ['latest', 'unrated', 'older']);
  assert.deepEqual(model.recipeOptions.map(({ id, name }) => [id, name]), [
    ['recipe-v60', '기록 V60'], ['recipe-origami', '현재 오리가미'],
  ]);
});

test('chart coordinates use real date spacing and a fixed one-to-five rating scale', () => {
  const layout = layoutRatingTrend([
    { id: 'first', date: '2026-10-01', rating: 1 },
    { id: 'same-day', date: '2026-10-01', rating: 3 },
    { id: 'middle', date: '2026-10-05', rating: 2 },
    { id: 'later', date: '2026-10-09', rating: 5 },
  ], { width: 500, height: 240 });
  const [first, sameDay, middle, later] = layout.points;

  assert.equal(first.x, sameDay.x, 'records on the same date share the true date coordinate');
  assert.equal(later.x - first.x, layout.plotWidth, 'the first and last dates span the full plot range');
  assert.equal(middle.x - first.x, layout.plotWidth / 2, 'four elapsed days use half the eight-day x range');
  assert.equal(first.y, layout.plotBottom, 'rating one stays on the fixed lower bound');
  assert.equal(later.y, layout.plotTop, 'rating five stays on the fixed upper bound');
  assert.equal(layout.yTicks[0], 1);
  assert.equal(layout.yTicks.at(-1), 5);
  const single = layoutRatingTrend([{ id: 'only', date: '2026-10-03', rating: 3 }], { width: 500, height: 240 });
  assert.equal(single.points[0].x, single.plotLeft + single.plotWidth / 2, 'a one-date chart is centered on its date');
});
