import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';

const REVISION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SOURCES = {
  beans: '11111111-1111-4111-8111-111111111111',
  recipes: '22222222-2222-4222-8222-222222222222',
  steps: '33333333-3333-4333-8333-333333333333',
  records: '44444444-4444-4444-8444-444444444444',
};

test('saved-connection startup verifies and reads only the current beans page', async () => {
  const calls = [];
  const rendered = [];
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
  };
  const view = {
    currentRoute() { return '/beans'; },
    setState() {}, showConnection() {}, showStatus() {}, finishStartup() {},
    renderData(data) { rendered.push(data); },
  };
  const app = createAppController({
    view,
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } },
    makeClient: () => ({ async verify(kinds) { calls.push(['verify', kinds]); } }),
    makeRepository: () => ({
      async listBeans(options) {
        calls.push(['listBeans', options]);
        return { items: [{ id: 'bean-1', name: '검증 원두' }], nextCursor: null, hasMore: false, complete: true };
      },
      async readAll() { calls.push(['readAll']); return { beans: [], recipes: [], records: [], excluded: {} }; },
    }),
    makeCommands: () => ({}),
  });

  assert.equal(await app.initialize(), true);
  assert.deepEqual(calls[0], ['verify', ['beans']]);
  assert.equal(calls[1][0], 'listBeans');
  assert.deepEqual({ cursor: calls[1][1].cursor, limit: calls[1][1].limit }, { cursor: null, limit: 20 });
  assert.ok(calls[1][1].signal instanceof AbortSignal);
  assert.deepEqual(rendered.at(-1).beans, [{ id: 'bean-1', name: '검증 원두',
    recordCount: { status: 'loading', count: null } }]);
});

test('route reads stay scoped, record filters query the server, and name options load on form use', async () => {
  const calls = [];
  const rendered = [];
  let routeChanged;
  let currentRoute = '/beans';
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const view = {
    currentRoute() { return currentRoute; }, onRouteChange(handler) { routeChanged = handler; }, bind() {},
    setState() {}, showConnection() {}, showStatus() {}, showConnectionSuccess() {}, clearSecret() {},
    renderData(data) { rendered.push(data); }, setSearchOptions(...args) { calls.push(['setSearchOptions', ...args]); },
  };
  const repository = {
    async listBeans(options) {
      calls.push(['listBeans', options]);
      return { items: [{ id: 'bean-1', name: '원두' }], nextCursor: 'beans-next', hasMore: true, complete: false };
    },
    async listRecords(options) {
      calls.push(['listRecords', options]);
      return { items: [], beans: [], recipes: [], nextCursor: null, hasMore: false, complete: true };
    },
    async searchOptions(options) {
      calls.push(['searchOptions', options]);
      return { items: [{ id: `${options.kind}-option`, name: '선택 항목', status: 'ready' }], nextCursor: null,
        hasMore: false, complete: true };
    },
  };
  const app = createAppController({ view,
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } },
    uuid: () => REVISION,
    makeClient: () => ({ async verify(kinds) { calls.push(['verify', kinds ?? 'all']); } }),
    makeRepository: () => repository,
    makeCommands: () => ({}),
  });
  app.bind();
  await app.connect({ token: 'fake-only', dataSources: SOURCES });
  assert.equal(calls.some(([name]) => name === 'searchOptions'), false);

  currentRoute = '/records';
  await routeChanged(currentRoute);
  assert.equal(calls.some(([name]) => name === 'searchOptions'), false,
    'opening the records list does not fetch searchable name options');
  await app.loadSearchOptions('beans', '', null, 'filters');
  await app.setRecordFilters({ beanId: 'beans-option', recipeId: '' });
  const recordQuery = calls.findLast(([name]) => name === 'listRecords')[1];
  assert.deepEqual([recordQuery.beanId, recordQuery.recipeId], ['beans-option', '']);
  assert.equal(rendered.at(-1).screen.filters.beanId, 'beans-option');
  assert.deepEqual(rendered.at(-1).options.filterBeans.items, [
    { id: 'beans-option', name: '선택 항목', status: 'ready' },
  ]);

  currentRoute = '/records/new';
  await routeChanged(currentRoute);
  assert.deepEqual(calls.filter(([name]) => name === 'searchOptions').map(([, options]) => options.kind),
    ['beans', 'beans', 'recipes']);

  currentRoute = '/beans';
  await routeChanged(currentRoute);
  await app.loadMore();
  const beanCalls = calls.filter(([name]) => name === 'listBeans');
  assert.equal(beanCalls.at(-1)[1].cursor, 'beans-next');
  assert.deepEqual(rendered.at(-1).beans.map(bean => bean.id), ['bean-1']);
});

test('search picker requests expose retryable errors and ignore superseded results and failures', async () => {
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const states = [];
  const results = [];
  const statuses = [];
  let resolveOld;
  let rejectOld;
  const oldRequest = new Promise((resolve, reject) => { resolveOld = resolve; rejectOld = reject; });
  const newPage = { items: [{ id: 'current', name: '최신 결과' }], nextCursor: null, hasMore: false, complete: true };
  const repository = {
    async listRecords() { return { items: [], beans: [], recipes: [], nextCursor: null, hasMore: false, complete: true }; },
    searchOptions({ query }) {
      if (query === 'old') return oldRequest;
      if (query === 'new') return Promise.resolve(newPage);
      if (query === 'broken') return Promise.reject(Object.assign(new Error('read failed'), { code: 'read-failed' }));
      return Promise.resolve({ items: [], nextCursor: null, hasMore: false, complete: true });
    },
  };
  const view = {
    currentRoute() { return '/records'; },
    setState() {}, showConnection() {}, showStatus(status) { statuses.push(status); },
    setSearchOptionsState(...args) { states.push(args); },
    setSearchOptions(...args) { results.push(args); },
    renderData() {},
  };
  const app = createAppController({ view,
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } },
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => repository,
    makeCommands: () => ({}),
  });
  app.bind();
  await app.connect({ token: 'fake-only', dataSources: SOURCES });

  const previous = app.loadSearchOptions('beans', 'old', null, 'filters');
  const current = app.loadSearchOptions('beans', 'new', null, 'filters');
  rejectOld(Object.assign(new Error('stale failure'), { code: 'read-failed' }));
  await previous;
  await current;

  assert.deepEqual(states.slice(0, 2).map(([, , state]) => [state.status, state.query]), [
    ['loading', 'old'], ['loading', 'new'],
  ]);
  assert.deepEqual(results.map(([, , , , query]) => query), ['new'], 'only the current search response reaches the picker');
  assert.equal(statuses.some(status => status.type === 'read-error'), false, 'a superseded failure is ignored');

  await app.loadSearchOptions('beans', 'broken', null, 'filters');
  assert.deepEqual(states.at(-1), ['filters', 'beans', { status: 'error', query: 'broken', append: false }]);
  assert.equal(statuses.at(-1).type, 'read-error', 'the current failure remains visible and can be retried');
  resolveOld(newPage);
});

test('route transition loading is independent from writes and ends after the first page', async () => {
  let currentRoute = '/beans';
  let routeChanged;
  let resolveRecords;
  let markRecordsStarted;
  const recordsStarted = new Promise(resolve => { markRecordsStarted = resolve; });
  const routeStates = [];
  const rendered = [];
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const app = createAppController({
    view: { currentRoute: () => currentRoute, onRouteChange(handler) { routeChanged = handler; }, bind() {},
      setState() {}, setRouteReadState(status) { routeStates.push(status); },
      showConnection() {}, showStatus() {}, showConnectionSuccess() {}, clearSecret() {},
      renderData(data) { rendered.push(data); } },
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } }, uuid: () => REVISION,
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => ({
      async listBeans() { return { items: [], nextCursor: null, hasMore: false, complete: true }; },
      async listRecords({ cursor }) {
        if (cursor) return { items: [], beans: [], recipes: [], nextCursor: null, hasMore: false, complete: true };
        markRecordsStarted();
        return await new Promise(resolve => { resolveRecords = resolve; });
      },
    }),
    makeCommands: () => ({}),
  });
  app.bind();
  await app.connect({ token: 'fake-only', dataSources: SOURCES });
  routeStates.length = 0;

  currentRoute = '/records';
  const firstPage = routeChanged(currentRoute);
  await recordsStarted;
  assert.deepEqual(routeStates, ['loading']);
  assert.equal(app.getState().pending, false, 'a route read must not become a write lock');

  resolveRecords({ items: [], beans: [], recipes: [], nextCursor: 'records-next', hasMore: true, complete: false });
  await firstPage;
  assert.deepEqual(routeStates, ['loading', 'ready']);
  assert.equal(rendered.at(-1).screen.route, '/records');

  await app.loadMore();
  assert.deepEqual(routeStates, ['loading', 'ready'], 'pagination must not show a route skeleton');
});

test('route read failure and cancellation clear loading without rendering previous-route data', async () => {
  let currentRoute = '/beans';
  let routeChanged;
  const routeStates = [];
  const rendered = [];
  const statuses = [];
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const app = createAppController({
    view: { currentRoute: () => currentRoute, onRouteChange(handler) { routeChanged = handler; }, bind() {},
      setState() {}, setRouteReadState(status) { routeStates.push(status); },
      showConnection() {}, showStatus(status) { statuses.push(status); }, showConnectionSuccess() {}, clearSecret() {},
      renderData(data) { rendered.push(data); } },
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } }, uuid: () => REVISION,
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => ({
      async listBeans() { return { items: [{ id: 'bean-1', name: '현재 원두' }], nextCursor: null, hasMore: false, complete: true }; },
      async listRecipeSummaries() { throw new Error('offline'); },
      async listRecords() { throw Object.freeze({ code: 'read-cancelled' }); },
    }),
    makeCommands: () => ({}),
  });
  app.bind();
  await app.connect({ token: 'fake-only', dataSources: SOURCES });

  currentRoute = '/recipes';
  await routeChanged(currentRoute);
  assert.deepEqual(routeStates.slice(-2), ['loading', 'error']);
  assert.equal(statuses.at(-1).type, 'read-error');
  assert.equal(rendered.at(-1).screen.route, '/beans', 'a failed route must not render stale beans as recipes');

  currentRoute = '/records';
  await routeChanged(currentRoute);
  assert.deepEqual(routeStates.slice(-2), ['loading', 'cancelled']);
  assert.equal(rendered.at(-1).screen.route, '/beans', 'a cancelled route must not render stale beans as records');
  assert.equal(app.getState().pending, false);
});

test('returning to the current route clears a cancelled transition skeleton', async () => {
  let currentRoute = '/beans';
  let routeChanged;
  let rejectRecipes;
  let markRecipesStarted;
  const recipesStarted = new Promise(resolve => { markRecipesStarted = resolve; });
  const routeStates = [];
  const rendered = [];
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const app = createAppController({
    view: { currentRoute: () => currentRoute, onRouteChange(handler) { routeChanged = handler; }, bind() {},
      setState() {}, setRouteReadState(status) { routeStates.push(status); },
      showConnection() {}, showStatus() {}, showConnectionSuccess() {}, clearSecret() {},
      renderData(data) { rendered.push(data); } },
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } }, uuid: () => REVISION,
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => ({
      async listBeans() { return { items: [{ id: 'bean-1', name: '원두' }], nextCursor: null, hasMore: false, complete: true }; },
      async listRecipeSummaries() {
        markRecipesStarted();
        return await new Promise((resolve, reject) => { rejectRecipes = reject; });
      },
    }),
    makeCommands: () => ({}),
  });
  app.bind();
  await app.connect({ token: 'fake-only', dataSources: SOURCES });
  routeStates.length = 0;

  currentRoute = '/recipes';
  const staleRead = routeChanged(currentRoute);
  await recipesStarted;
  assert.deepEqual(routeStates, ['loading']);

  currentRoute = '/beans';
  await routeChanged(currentRoute);
  assert.deepEqual(routeStates, ['loading', 'ready']);
  rejectRecipes(new Error('cancelled stale route'));
  await staleRead;
  assert.deepEqual(routeStates, ['loading', 'ready'], 'the aborted response cannot alter the restored route state');
  assert.equal(rendered.at(-1).screen.route, '/beans');
});

test('late response from a previous route cannot replace the current screen', async () => {
  let currentRoute = '/beans';
  let routeChanged;
  let rejectRecipes;
  let markRecipesStarted;
  const recipesStarted = new Promise(resolve => { markRecipesStarted = resolve; });
  const rendered = [];
  const routeStates = [];
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
    async beginConnectionChange() {}, async commitConnectionChange() {},
  };
  const app = createAppController({
    view: { currentRoute: () => currentRoute, onRouteChange(handler) { routeChanged = handler; }, bind() {},
      setState() {}, setRouteReadState(status) { routeStates.push(status); },
      showConnection() {}, showStatus() {}, showConnectionSuccess() {}, clearSecret() {},
      renderData(data) { rendered.push(data); } },
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } }, uuid: () => REVISION,
    makeClient: () => ({ async verify() {} }),
    makeRepository: () => ({
      async listBeans() { return { items: [], nextCursor: null, hasMore: false, complete: true }; },
      async listRecipeSummaries() {
        markRecipesStarted();
        return await new Promise((resolve, reject) => { rejectRecipes = reject; });
      },
      async listRecords() { return { items: [], beans: [], recipes: [], nextCursor: null, hasMore: false, complete: true }; },
    }),
    makeCommands: () => ({}),
  });
  app.bind();
  await app.connect({ token: 'fake-only', dataSources: SOURCES });
  routeStates.length = 0;

  currentRoute = '/recipes';
  const staleRead = routeChanged(currentRoute);
  await recipesStarted;
  currentRoute = '/records';
  await routeChanged(currentRoute);
  rejectRecipes(new Error('stale route failure'));
  await staleRead;

  assert.equal(rendered.at(-1).screen.route, '/records');
  assert.deepEqual(rendered.at(-1).recipes, []);
  assert.deepEqual(routeStates, ['loading', 'loading', 'ready'], 'the stale error cannot clear the current route state');
});


test('home startup performs no screen reads and brew routes use scoped repository methods', async () => {
  const calls = [];
  const rendered = [];
  let currentRoute = '/home';
  let routeChanged;
  const connection = { schemaVersion: 1, revision: REVISION, token: 'fake-only', dataSources: SOURCES };
  const context = {
    async inspect() { return { initialized: true, blocked: false }; },
    async readJournal() { return { operations: [], activeConnectionRevision: REVISION, connectionGuard: null }; },
  };
  const bean = { id: '11111111-1111-4111-8111-111111111111', name: '홈 흐름 원두' };
  const recipe = { id: '22222222-2222-4222-8222-222222222222', name: '홈 흐름 레시피', beanId: null,
    steps: [{ name: '뜸', seconds: 0, water: 50, cumulativeWater: 50 }], validationStatus: 'ready' };
  const repository = {
    async listBeans(options) { calls.push(['listBeans', options]); return { items: [bean], nextCursor: null, hasMore: false, complete: true }; },
    async listRecipeSummaries(options) { calls.push(['listRecipeSummaries', options]); return { items: [recipe], nextCursor: null, hasMore: false, complete: true }; },
    async getBean(id) { calls.push(['getBean', id]); return bean; },
    async getRecipeDetail(id) { calls.push(['getRecipeDetail', id]); return recipe; },
    async listRecords(options) { calls.push(['listRecords', options]); return { items: [], beans: [], recipes: [], nextCursor: null, hasMore: false, complete: true }; },
    async searchOptions(options) { calls.push(['searchOptions', options]); return { items: [], nextCursor: null, hasMore: false, complete: true }; },
  };
  const app = createAppController({
    view: { currentRoute: () => currentRoute, onRouteChange(handler) { routeChanged = handler; }, bind() {},
      setState() {}, showConnection() {}, showStatus() {}, showConnectionSuccess() {}, clearSecret() {},
      renderData(value) { rendered.push(value); } },
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return connection; } }, uuid: () => REVISION,
    makeClient: () => ({ async verify(kinds) { calls.push(['verify', kinds]); } }),
    makeRepository: () => repository, makeCommands: () => ({}),
  });
  app.bind();
  assert.equal(await app.initialize(), true);
  assert.deepEqual(calls.filter(([name]) => name !== 'verify'), [], 'the home screen must not query entity lists');
  assert.deepEqual(calls.filter(([name]) => name === 'verify'),
    [['verify', ['beans', 'recipes', 'steps', 'records']]],
    'home verifies the saved connection without querying entity lists');

  currentRoute = '/brew/bean';
  await routeChanged(currentRoute);
  assert.ok(calls.some(([name]) => name === 'listBeans'));

  currentRoute = `/brew/recipe?beanId=${bean.id}`;
  await routeChanged(currentRoute);
  assert.ok(calls.some(([name, id]) => name === 'getBean' && id === bean.id));
  assert.ok(calls.some(([name]) => name === 'listRecipeSummaries'));
  assert.ok(rendered.at(-1).recipes.some(item => item.id === recipe.id),
    'public recipes remain selectable after validating the explicitly selected bean');

  currentRoute = `/brew/run?beanId=${bean.id}&recipeId=${recipe.id}`;
  await routeChanged(currentRoute);
  assert.ok(calls.some(([name, id]) => name === 'getBean' && id === bean.id));
  assert.ok(calls.some(([name, id]) => name === 'getRecipeDetail' && id === recipe.id));
  assert.equal(rendered.at(-1).screen.route, currentRoute);
  assert.equal(rendered.at(-1).screen.error, undefined);

  currentRoute = `/records/new?beanId=${bean.id}&recipeId=${recipe.id}`;
  await routeChanged(currentRoute);
  const prefilled = rendered.at(-1);
  assert.ok(prefilled.beans.some(item => item.id === bean.id), 'selected bean is included even when absent from the first search page');
  assert.ok(prefilled.recipes.some(item => item.id === recipe.id), 'selected recipe is included for form prefill');
  assert.ok(calls.some(([name, id]) => name === 'getBean' && id === bean.id));
  assert.ok(calls.some(([name, id]) => name === 'getRecipeDetail' && id === recipe.id));

  repository.getRecipeDetail = async id => ({ ...recipe, id, beanId: bean.id });
  currentRoute = '/brew/run?recipeId=' + recipe.id;
  await app.loadRoute(currentRoute, { force: true });
  assert.equal(rendered.at(-1).screen.error, 'bean-required', 'a legacy recipe relation never supplies the selected bean');

  currentRoute = '/records/new?recipeId=' + recipe.id;
  await app.loadRoute(currentRoute, { force: true });
  assert.equal(rendered.at(-1).screen.error, 'bean-required', 'record prefill requires an explicit bean selection');

  currentRoute = `/brew/run?beanId=${bean.id}&recipeId=${recipe.id}`;
  repository.getRecipeDetail = async id => ({ ...recipe, id, beanId: '99999999-9999-4999-8999-999999999999' });
  await app.loadRoute(currentRoute, { force: true });
  assert.equal(rendered.at(-1).screen.error, undefined, 'legacy recipe relations do not restrict an explicit bean choice');
  currentRoute = `/records/new?beanId=${bean.id}&recipeId=${recipe.id}`;
  await app.loadRoute(currentRoute, { force: true });
  assert.equal(rendered.at(-1).screen.error, undefined, 'legacy relations also permit record prefill');

  repository.getRecipeDetail = async id => ({ ...recipe, id, steps: [] });
  for (const route of [`/brew/run?beanId=${bean.id}&recipeId=${recipe.id}`,
    `/records/new?beanId=${bean.id}&recipeId=${recipe.id}`]) {
    await app.loadRoute(route, { force: true });
    assert.equal(rendered.at(-1).screen.error, 'recipe-unavailable', 'missing steps still block guidance and prefill');
  }

  currentRoute = `/brew/recipe?beanId=${bean.id}`;
  repository.getBean = async () => { throw Object.freeze({ code: 'bean-unavailable' }); };
  await app.loadRoute(currentRoute, { force: true });
  assert.equal(rendered.at(-1).screen.error, 'bean-unavailable', 'a missing selected parent gets an actionable route error');
});
