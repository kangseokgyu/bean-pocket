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
  assert.equal(model.selectedBeanId, 'bean-a');
  assert.equal(model.loadedCount, records.length);
});

test('selection, best record, and comparison values use only valid current snapshots without mutating inputs', () => {
  const records = [
    record({ id: 'older', beanId: 'bean-a', beanName: '과거 이름', date: '2026-10-01', rating: 5,
      recipeName: '당시 레시피', recipeId: 'live-recipe-id' }),
    record({ id: 'newer', beanId: 'bean-a', beanName: '과거 이름', date: '2026-10-05', rating: 5,
      recipeName: '새 당시 레시피' }),
    record({ id: 'unrated', beanId: 'bean-a', date: '2026-10-06', rating: null }),
    record({ id: 'bad-rating', beanId: 'bean-a', date: '2026-10-07', rating: 6 }),
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
  assert.equal(model.selectedBean.name, '현재 이름');
  assert.deepEqual(model.trend.map(point => [point.date, point.rating]), [['2026-10-01', 5], ['2026-10-05', 5]]);
  assert.equal(model.bestRecord.id, 'newer', 'equal ratings choose the newer valid date');
  assert.equal(model.bestRecord.snapshot.recipe.name, '새 당시 레시피');
  assert.equal(model.comparisonRecords.length, 2);
  assert.equal(model.eligibleCount, 4, 'unrated or invalidly rated records still establish valid bean/date membership');
  assert.equal(model.excludedCount, 4, 'invalid dates, ambiguous beans, stale generations and damaged snapshots are excluded');
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
