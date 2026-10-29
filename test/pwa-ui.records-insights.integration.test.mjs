import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';

const makeRecord = ({ id, beanId, recipeId, date, rating }) => ({
  id, beanId, beanResolution: 'relation', recipeId, date, rating, cupNote: `${id} 컵노트`, snapshotStatus: 'valid',
  snapshot: { version: 2, recordGeneration: 'bagless-v1',
    bean: { id: beanId, name: `원두 ${beanId}` },
    recipe: { id: recipeId, name: `기록 당시 ${recipeId}`, dose: 15, totalWater: 240, temperature: 92,
      steps: [{ name: '뜸', seconds: 40, interval: 40, water: 40, cumulativeWater: 40 }] } },
});

const seedRecords = () => [
  makeRecord({ id: 'record-a1', beanId: 'bean-a', recipeId: 'recipe-a', date: '2026-10-01', rating: 3 }),
  makeRecord({ id: 'record-b1', beanId: 'bean-b', recipeId: 'recipe-b', date: '2026-10-05', rating: 5 }),
  makeRecord({ id: 'record-a2', beanId: 'bean-a', recipeId: 'recipe-a', date: '2026-10-08', rating: 4 }),
  makeRecord({ id: 'record-b2', beanId: 'bean-b', recipeId: 'recipe-b', date: '2026-10-09', rating: 2 }),
];

function createHarness({ records = seedRecords(), failUnfilteredOnce = false, delayNextPage = false } = {}) {
  let route = '/home';
  const reads = [];
  let latestData = null;
  let failUnfiltered = failUnfilteredOnce;
  let releaseNextPage;
  const view = {
    currentRoute: () => route,
    renderData(value) { latestData = value; },
    showConnection() {}, showStatus() {}, showDeleteResult() {}, showEntrySuccess() { return true; },
    clearStatus() {}, setState() {}, bind(actions) { this.actions = actions; },
  };
  const context = {
    async inspect() { return { initialized: false, blocked: false }; },
    async readJournal() { return { connectionGuard: null, operations: [] }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const repository = {
    async listRecords(options = {}) {
      reads.push({ ...options });
      const filtered = records.filter(record => (!options.beanId || record.beanId === options.beanId) &&
        (!options.recipeId || record.recipeId === options.recipeId));
      if (failUnfiltered && !options.beanId && !options.recipeId) {
        failUnfiltered = false;
        throw new Error('overview unavailable');
      }
      if (delayNextPage && options.cursor) {
        delayNextPage = false;
        await new Promise(resolve => { releaseNextPage = resolve; });
      }
      const start = options.cursor ? 2 : 0;
      const items = filtered.slice(start, start + 2);
      return { items, beans: [], recipes: [], nextCursor: filtered.length > start + 2 ? 'next' : null,
        hasMore: filtered.length > start + 2, complete: filtered.length <= start + 2 };
    },
  };
  const controller = createAppController({
    view,
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return null; } },
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => repository,
    makeCommands: () => ({
      async prepareRecord(payload) { return { kind: 'records', payload }; },
      async prepareDeleteRecord(payload) { return { kind: 'delete-record', payload }; },
      async execute(draft) {
        if (draft.kind === 'records') {
          const record = makeRecord({ id: 'record-new', beanId: draft.payload.beanId, recipeId: draft.payload.recipeId,
            date: draft.payload.date, rating: Number(draft.payload.rating) });
          records.unshift(record);
          return { status: 'succeeded', value: record };
        }
        records = records.filter(record => record.id !== draft.payload.id);
        return { status: 'succeeded' };
      },
    }),
    uuid: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  });
  controller.bind();
  return {
    controller, view, reads, records,
    get latestData() { return latestData; },
    releaseNextPage() { releaseNextPage?.(); },
    setRoute(value) { route = value; },
    async connect() { await controller.connect({ token: 'test-only', dataSources: {} }); },
  };
}

test('records insights keep their own bounded cursor and selection outside recipe filters and table paging', async () => {
  const setup = createHarness();
  await setup.connect();
  setup.setRoute('/records');
  await setup.controller.loadRoute('/records');

  assert.equal(setup.latestData.records.length, 2);
  assert.equal(setup.latestData.recordInsights.loadedCount, 2);
  assert.equal(setup.latestData.recordInsights.selectedBeanId, 'bean-b');
  assert.equal(setup.latestData.recordInsights.hasMore, true);
  assert.equal(setup.reads.length, 1, 'the unfiltered first table page is reused for insights');
  assert.equal(setup.reads[0].limit, 20);

  setup.controller.setRecordInsightsBean('bean-a');
  await setup.controller.setRecordFilters({ recipeId: 'recipe-b' });
  assert.ok(setup.latestData.records.every(record => record.recipeId === 'recipe-b'), 'the table follows its recipe filter');
  assert.equal(setup.latestData.recordInsights.selectedBeanId, 'bean-a');
  assert.deepEqual(setup.latestData.recordInsights.trend.map(point => point.record.beanId), ['bean-a']);

  await setup.controller.loadMore();
  assert.ok(setup.latestData.records.every(record => record.recipeId === 'recipe-b'));
  assert.equal(setup.latestData.recordInsights.selectedBeanId, 'bean-a', 'table paging preserves the selected bean');

  await setup.controller.loadMoreInsights();
  assert.equal(setup.latestData.recordInsights.loadedCount, 4);
  assert.equal(setup.latestData.recordInsights.selectedBeanId, 'bean-a');
  assert.equal(setup.reads.at(-1).cursor, 'next');
  assert.equal(setup.reads.at(-1).beanId, undefined);
  assert.equal(setup.reads.at(-1).recipeId, undefined, 'the insight cursor never inherits table filters');
  assert.ok(setup.reads.every(read => read.limit === 20), 'all requests remain bounded');
});

test('insight read failures stay inline and do not replace the filtered records page', async () => {
  const setup = createHarness({ failUnfilteredOnce: true });
  await setup.connect();
  setup.setRoute('/records');
  await setup.controller.setRecordFilters({ recipeId: 'recipe-a' });
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(setup.latestData.records.length, 2, 'filtered table rows remain available');
  assert.ok(setup.latestData.records.every(record => record.recipeId === 'recipe-a'));
  assert.equal(setup.latestData.recordInsights.status, 'error');
  assert.match(setup.latestData.recordInsights.error, /인사이트/);
});

test('record create and delete reset and reload the bounded insights cursor', async () => {
  const setup = createHarness();
  await setup.connect();
  setup.setRoute('/records');
  await setup.controller.loadRoute('/records');
  const initialReads = setup.reads.length;

  const created = await setup.controller.submit('records', {
    beanId: 'bean-a', recipeId: 'recipe-a', date: '2026-10-10', rating: '5', cupNote: '새 컵노트',
  });
  assert.equal(created.status, 'succeeded');
  assert.ok(setup.reads.length > initialReads);
  assert.equal(setup.latestData.recordInsights.records[0].id, 'record-new');
  assert.equal(setup.latestData.recordInsights.nextCursor, 'next', 'create starts a fresh first-page cursor');

  const beforeDelete = setup.reads.length;
  const deleted = await setup.controller.submit('delete-record', { id: 'record-new' });
  assert.equal(deleted.status, 'succeeded');
  assert.ok(setup.reads.length > beforeDelete);
  assert.notEqual(setup.latestData.recordInsights.records[0]?.id, 'record-new');
});

test('reconnection clears prior overview selection and stale aborted pages cannot cross the connection boundary', async () => {
  const setup = createHarness({ delayNextPage: true });
  await setup.connect();
  setup.setRoute('/records');
  await setup.controller.loadRoute('/records');
  setup.controller.setRecordInsightsBean('bean-a');

  const stalePage = setup.controller.loadMoreInsights();
  await Promise.resolve();
  await setup.connect();
  assert.equal(setup.latestData.recordInsights.selectedBeanId, 'bean-b', 'new connection chooses its own newest bean');
  assert.equal(setup.latestData.recordInsights.loadedCount, 2);

  setup.releaseNextPage();
  await stalePage;
  assert.equal(setup.latestData.recordInsights.loadedCount, 2, 'late response from the previous connection is ignored');
  assert.equal(setup.latestData.recordInsights.selectedBeanId, 'bean-b');
});
