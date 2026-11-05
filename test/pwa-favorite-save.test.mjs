import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';

const SOURCES = Object.freeze({
  beans: '11111111-1111-4111-8111-111111111111',
  recipes: '22222222-2222-4222-8222-222222222222',
  steps: '33333333-3333-4333-8333-333333333333',
  records: '44444444-4444-4444-8444-444444444444',
});
const BEAN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function page(item) {
  return { items: [structuredClone(item)], nextCursor: null, hasMore: false, complete: true };
}

function fixture({ listBeans, onStatus, onExecute, journalReader } = {}) {
  let route = '/beans';
  let revision = 0;
  const verified = [];
  const rendered = [];
  const states = [];
  const statuses = [];
  const remote = new Map();
  const context = {
    async inspect() { return { initialized: false, blocked: false }; },
    async readJournal() { return journalReader?.() ?? { operations: [], connectionGuard: null }; },
    async beginConnectionChange() {},
    async commitConnectionChange() {},
  };
  const view = {
    currentRoute() { return route; },
    setState(value) { states.push(value); },
    showStatus(value) { statuses.push(value); onStatus?.(value); },
    renderData(value) { rendered.push(value); },
  };
  const app = createAppController({
    view,
    state: { async withWriteLock(action) { return action(context); } },
    file: { async readConnection() { return null; } },
    uuid() {
      revision += 1;
      return `aaaaaaaa-aaaa-4aaa-8aaa-${String(revision).padStart(12, '0')}`;
    },
    makeClient(connection) {
      remote.set(connection.token, { id: BEAN, name: `${connection.token} bean`, favorite: false });
      return {
        connectionRevision: connection.revision,
        token: connection.token,
        beanFavoriteSupported: true,
        recipeFavoriteSupported: true,
        async verify(kinds) { verified.push([connection.token, kinds]); },
      };
    },
    makeRepository(client) {
      let readCount = 0;
      return {
        async listBeans(options) {
          readCount += 1;
          const item = structuredClone(remote.get(client.token));
          return listBeans ? listBeans({ client, readCount, item, options }) : page(item);
        },
        async listRecipeSummaries() { return { items: [], nextCursor: null, hasMore: false, complete: true }; },
      };
    },
    makeCommands({ client }) {
      return {
        async prepareFavoriteBean(payload) { return payload; },
        async execute(draft) {
          const override = onExecute?.(draft, client);
          if (override) return override;
          const next = { ...remote.get(client.token), favorite: draft.favorite };
          remote.set(client.token, next);
          return { status: 'succeeded', value: next };
        },
      };
    },
  });
  return {
    app, verified, rendered, states, statuses,
    setRoute(value) { route = value; },
    connect(token = 'first') { return app.connect({ token, dataSources: SOURCES }); },
  };
}

test('favorite save updates the visible value and unlocks before a slow refresh fails', async () => {
  const refreshStarted = deferred();
  const failRefresh = deferred();
  const readErrorShown = deferred();
  const setup = fixture({ listBeans: ({ readCount, item }) => {
    if (readCount === 2) {
      refreshStarted.resolve();
      return failRefresh.promise.then(() => { throw Object.freeze({ code: 'read-failed' }); });
    }
    return page(item);
  }, onStatus(status) { if (status.type === 'read-error') readErrorShown.resolve(); } });
  assert.equal(await setup.connect(), true);
  const save = setup.app.submit('favorite-bean', { id: BEAN, favorite: true });

  await refreshStarted.promise;
  const pendingDuringRefresh = setup.app.getState().pending;
  const visibleFavoriteDuringRefresh = setup.rendered.at(-1).beans[0].favorite;
  failRefresh.resolve();
  const result = await save;
  await readErrorShown.promise;

  assert.equal(result.status, 'succeeded');
  assert.equal(pendingDuringRefresh, false, 'the write lock is released while the background refresh is pending');
  assert.equal(visibleFavoriteDuringRefresh, true, 'the saved favorite is rendered before refresh completion');
  assert.deepEqual(setup.verified.at(-1), ['first', ['beans']], 'only the beans schema is checked for this save');
  await Promise.resolve();
  assert.equal(setup.app.getState().pending, false, 'a delayed refresh failure must not keep the UI locked');
  assert.ok(setup.statuses.some(status => status.type === 'read-error'));
});

test('a later favorite save wins over an older refresh response', async () => {
  const staleStarted = deferred();
  const releaseStale = deferred();
  const setup = fixture({ listBeans: ({ readCount, item }) => {
    if (readCount === 2) {
      staleStarted.resolve();
      return releaseStale.promise.then(() => page({ ...item, favorite: true }));
    }
    return page(item);
  } });
  await setup.connect();

  const firstSave = setup.app.submit('favorite-bean', { id: BEAN, favorite: true });
  await staleStarted.promise;
  const didFinishBeforeRefresh = await Promise.race([
    firstSave.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 0)),
  ]);
  const pendingAfterFirstSave = setup.app.getState().pending;
  if (!didFinishBeforeRefresh) {
    releaseStale.resolve();
    await firstSave;
    assert.equal(pendingAfterFirstSave, false, 'a second save can begin while the earlier refresh is still in flight');
    return;
  }
  const firstResult = await firstSave;
  const secondResult = await setup.app.submit('favorite-bean', { id: BEAN, favorite: false });
  assert.equal(firstResult.status, 'succeeded');
  assert.equal(secondResult.status, 'succeeded');
  assert.equal(pendingAfterFirstSave, false, 'a second save can begin while the earlier refresh is still in flight');

  releaseStale.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(setup.rendered.at(-1).beans[0].favorite, false, 'the stale true response cannot overwrite the later false save');
});

test('an older favorite refresh cannot clear a later failed save notice', async () => {
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  let executions = 0;
  const setup = fixture({
    listBeans: ({ readCount, item }) => {
      if (readCount === 2) {
        refreshStarted.resolve();
        return releaseRefresh.promise.then(() => page(item));
      }
      return page(item);
    },
    onExecute() {
      executions += 1;
      return executions === 2 ? { status: 'failed', code: 'network-unconfirmed' } : null;
    },
  });
  await setup.connect();

  assert.equal((await setup.app.submit('favorite-bean', { id: BEAN, favorite: true })).status, 'succeeded');
  await refreshStarted.promise;
  const failed = await setup.app.submit('favorite-bean', { id: BEAN, favorite: false });
  const failedNotice = setup.statuses.at(-1);
  assert.equal(failed.status, 'failed');
  assert.equal(failedNotice.type, 'failed');

  releaseRefresh.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(setup.statuses.at(-1), failedNotice, 'a prior refresh cannot replace the later write failure with ready');
});

test('an older favorite refresh cannot clear an ambiguous save warning or its recovery lock', async () => {
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  const unknownOperation = { key: 'operation-key', kind: 'favorite-bean', status: 'unknown',
    favoriteTarget: { kind: 'beans', id: BEAN, favorite: false }, createdPages: [] };
  const journal = { operations: [] };
  let executions = 0;
  const setup = fixture({
    listBeans: ({ readCount, item }) => {
      if (readCount === 2) {
        refreshStarted.resolve();
        return releaseRefresh.promise.then(() => page(item));
      }
      return page(item);
    },
    onExecute() {
      executions += 1;
      return executions === 2 ? { status: 'unknown', code: 'network-unconfirmed' } : null;
    },
    journalReader: () => journal,
  });
  await setup.connect();

  assert.equal((await setup.app.submit('favorite-bean', { id: BEAN, favorite: true })).status, 'succeeded');
  await refreshStarted.promise;
  journal.operations = [unknownOperation];
  const unresolved = await setup.app.submit('favorite-bean', { id: BEAN, favorite: false });
  const warning = setup.statuses.at(-1);
  assert.equal(unresolved.status, 'unknown');
  assert.equal(warning.type, 'unknown');
  assert.equal(setup.app.getState().unresolved, true);

  releaseRefresh.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(setup.statuses.at(-1), warning, 'a prior refresh cannot replace the recovery warning with ready');
  assert.equal(setup.app.getState().unresolved, true, 'the journal recovery lock stays active');
});

test('a screen transition ignores the previous screen favorite refresh', async () => {
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  const setup = fixture({ listBeans: ({ readCount, item }) => {
    if (readCount === 2) {
      refreshStarted.resolve();
      return releaseRefresh.promise.then(() => page(item));
    }
    return page(item);
  } });
  await setup.connect();

  const save = setup.app.submit('favorite-bean', { id: BEAN, favorite: true });
  await refreshStarted.promise;
  const pendingDuringRefresh = setup.app.getState().pending;
  const didFinishBeforeRefresh = await Promise.race([
    save.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 0)),
  ]);
  if (!didFinishBeforeRefresh) {
    releaseRefresh.resolve();
    await save;
    assert.equal(pendingDuringRefresh, false, 'the favorite save finishes while its old-screen refresh is pending');
    return;
  }
  const saved = await save;
  setup.setRoute('/recipes');
  await setup.app.loadRoute('/recipes', { force: true });
  releaseRefresh.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(saved.status, 'succeeded');
  assert.equal(pendingDuringRefresh, false);
  assert.equal(setup.rendered.at(-1).screen.route, '/recipes');
});

test('a connection replacement ignores the previous connection favorite refresh', async () => {
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  const setup = fixture({ listBeans: ({ client, readCount, item }) => {
    if (client.token === 'first' && readCount === 2) {
      refreshStarted.resolve();
      return releaseRefresh.promise.then(() => page({ ...item, favorite: true }));
    }
    return page(item);
  } });
  await setup.connect('first');

  const save = setup.app.submit('favorite-bean', { id: BEAN, favorite: true });
  await refreshStarted.promise;
  const didFinishBeforeRefresh = await Promise.race([
    save.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 0)),
  ]);
  if (!didFinishBeforeRefresh) {
    releaseRefresh.resolve();
    await save;
    assert.equal(setup.app.getState().pending, false, 'the saved value returns before its background refresh completes');
    return;
  }
  await save;

  await setup.connect('second');
  const replacement = setup.rendered.at(-1);
  const replacementRevision = setup.states.at(-1).connectionRevision;
  releaseRefresh.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(replacement.beans[0].name, 'second bean');
  assert.equal(setup.rendered.at(-1).beans[0].name, 'second bean');
  assert.equal(setup.rendered.at(-1).screen.connectionRevision, replacementRevision);
});
