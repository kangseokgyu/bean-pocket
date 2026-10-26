import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';
import { NotionClient } from '../pwa/data/notion-client.mjs';
import { createReadRepository } from '../pwa/data/read-repository.mjs';
import { createCommands } from '../pwa/commands/index.mjs';
import { createSubmissionState } from '../pwa/state/submission-state.mjs';
import { memoryPlatform, fakePwaNotion, testConnection } from './fixtures/pwa-environment.mjs';

const recipeInput = beanId => ({ name: 'V60', beanId, dose: 15, totalWater: 250, temperature: 93,
  steps: [{ time: '0:00', water: 50 }, { time: '0:30', water: 200 }] });
const recordInput = (beanId, recipeId) => ({ beanId, recipeId,
  date: '2026-10-23', rating: 5, cupNote: '미저장 초안 보존 확인' });

async function setup() {
  const native = memoryPlatform({ initialized: false });
  const fake = fakePwaNotion();
  const events = [];
  const connection = () => JSON.parse(native.files.get('connection.json'));
  const make = () => {
    const state = createSubmissionState(native);
    const app = createAppController({
      view: { showStatus: value => events.push({ status: value }), renderData: value => events.push({ data: value }),
        setState() {}, clearSecret() {}, showConnection() {}, showUnresolved() {} },
      state, file: { readConnection: async () => native.files.has('connection.json') ? connection() : null },
      makeClient: current => new NotionClient(current.token, { dataSources: current.dataSources,
        connectionRevision: current.revision, fetchImpl: fake.fetch }),
      makeRepository: createReadRepository, makeCommands: createCommands,
    });
    return { app, state };
  };
  const { app, state } = make();
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: '삭제 검증 원두' });
  return { native, fake, events, app, state, make, connection, beanId: bean.value.id };
}

const sourceRows = (env, kind) => env.fake.rows.filter(row => row.parent.data_source_id === env.connection().dataSources[kind]);
const patches = env => env.fake.calls.filter(call => call.method === 'PATCH');
const latestData = env => env.events.filter(event => event.data).at(-1).data;

test('a hidden historical record still blocks recipe deletion', async () => {
  const env = await setup();
  const recipe = await env.app.submit('recipes', recipeInput(env.beanId));
  await env.app.submit('records', recordInput(env.beanId, recipe.value.id));
  const recordPage = sourceRows(env, 'records')[0];
  const snapshotProperty = recordPage.properties['당시 레시피 스냅샷'];
  const snapshot = JSON.parse(snapshotProperty.rich_text.map(item => item.text.content).join(''));
  delete snapshot.recordGeneration;
  snapshotProperty.rich_text = [{ type: 'text', text: { content: JSON.stringify(snapshot) } }];

  const result = await env.app.submit('delete-recipe', { id: recipe.value.id });

  assert.equal(result.status, 'failed');
  assert.equal(result.code, 'delete-in-use');
  assert.equal(patches(env).length, 0);
  assert.equal(recordPage.in_trash, false);
});

test('an incomplete record relation protects unrelated recipe deletion', async () => {
  const env = await setup();
  const target = await env.app.submit('recipes', recipeInput(env.beanId));
  const other = await env.app.submit('recipes', { ...recipeInput(env.beanId), name: '다른 레시피' });
  await env.app.submit('records', recordInput(env.beanId, other.value.id));
  const page = sourceRows(env, 'records')[0];
  page.properties['레시피'].has_more = true;

  const result = await env.app.submit('delete-recipe', { id: target.value.id });

  assert.equal(result.status, 'failed');
  assert.equal(result.code, 'delete-dependency-unknown');
  assert.equal(patches(env).length, 0);
});

test('excluded historical record rows keep recipe deletion fail-closed', async () => {
  const dataSources = testConnection().dataSources;
  const beanId = '11111111-1111-4111-8111-111111111111';
  const bagId = '22222222-2222-4222-8222-222222222222';
  const recipeId = '33333333-3333-4333-8333-333333333333';
  const recipe = { id: recipeId, name: 'V60', dripper: 'V60', dose: 15, grind: '', grinder: '', grinderSetting: '',
    microns: null, temperature: 93, totalWater: 250, stats: { count: 0, average: null }, steps: [
      { id: '44444444-4444-4444-8444-444444444444', recipeId, name: '뜸', order: 1, seconds: 0, interval: 0, water: 50, cumulativeWater: 50 },
      { id: '55555555-5555-4555-8555-555555555555', recipeId, name: '붓기', order: 2, seconds: 30, interval: 30, water: 200, cumulativeWater: 250 },
    ] };
  const data = { beans: [{ id: beanId, name: '원두' }], bags: [{ id: bagId, beanId, name: '봉지' }], recipes: [recipe], records: [],
    excluded: { bags: 0, recipes: 0, records: 1, steps: 0 } };
  const native = memoryPlatform({ initialized: false });
  const state = createSubmissionState(native);
  const archived = [];
  const events = [];
  const app = createAppController({ view: { showStatus: value => events.push(value), renderData() {}, setState() {}, showConnection() {}, clearSecret() {} },
    state, file: { async readConnection() { return JSON.parse(native.files.get('connection.json')); } },
    makeClient: connection => ({ connectionRevision: connection.revision, dataSources, recordBeanRelationSupported: true,
      async verify() {}, async createPage() { throw new Error('unexpected create'); }, async archiveCreatedPage() { throw new Error('unexpected cleanup'); },
      async archivePage(kind, id) { archived.push({ kind, id }); return { id, in_trash: true }; } }),
    makeRepository: () => ({ async readAll() { return data; }, async readRecipeForSnapshot() { return recipe; } }), makeCommands: createCommands,
  });
  await app.connect(testConnection());

  const result = await app.submit('delete-recipe', { id: recipeId });
  assert.equal(result.status, 'failed');
  assert.equal(result.code, 'delete-dependency-unknown');
  assert.deepEqual(archived, []);
});

test('bag deletion commands are unavailable and raw bag pages remain active', async () => {
  const env = await setup();
  const bagId = '22222222-2222-4222-8222-222222222222';
  const row = { id: bagId, parent: { type: 'data_source_id', data_source_id: env.connection().dataSources.bags },
    in_trash: false, archived: false };
  env.fake.rows.push(row);

  await assert.rejects(env.app.submit('delete-bag', { id: bagId }), error => error.code === 'input');

  assert.equal(patches(env).length, 0);
  assert.equal(row.in_trash, false);
  assert.equal(env.native.journal().operations.some(operation => operation.kind === 'delete-bag'), false);
});

test('recipe deletion trashes only the parent and removes it from fresh recipe choices', async () => {
  const env = await setup();
  const recipe = await env.app.submit('recipes', recipeInput(env.beanId));
  const children = sourceRows(env, 'steps');
  assert.equal(children.length, 2);

  env.fake.intercept = ({ method }) => {
    if (method === 'PATCH') {
      const operation = env.native.journal().operations.at(-1);
      assert.equal(operation.kind, 'delete-recipe');
      assert.equal(operation.status, 'processing');
      assert.deepEqual(operation.deleteTarget, { kind: 'recipes', id: recipe.value.id, archiveState: 'active' });
    }
    return null;
  };
  const result = await env.app.submit('delete-recipe', { id: recipe.value.id });

  assert.equal(result.status, 'succeeded');
  assert.deepEqual(patches(env).map(call => call.pathname), [`/v1/pages/${recipe.value.id}`]);
  assert.equal(sourceRows(env, 'recipes')[0].in_trash, true);
  assert.equal(sourceRows(env, 'steps').length, 2);
  assert.ok(sourceRows(env, 'steps').every(step => step.in_trash === false));
  assert.equal(latestData(env).recipes.some(item => item.id === recipe.value.id), false);
  const writesBefore = env.fake.calls.filter(call => call.pathname === '/v1/pages' && ['POST', 'PATCH'].includes(call.method)).length;
  await assert.rejects(env.app.submit('copy', { recipeId: recipe.value.id, changes: {} }));
  const blockedRecord = await env.app.submit('records', recordInput(env.beanId, recipe.value.id));
  assert.equal(blockedRecord.status, 'failed');
  assert.equal(env.fake.calls.filter(call => call.pathname === '/v1/pages' && ['POST', 'PATCH'].includes(call.method)).length, writesBefore);
});

test('record deletion refreshes rating totals and keeps unsaved draft state', async () => {
  const env = await setup();
  const recipe = await env.app.submit('recipes', recipeInput(env.beanId));
  const record = await env.app.submit('records', recordInput(env.beanId, recipe.value.id));
  assert.deepEqual(latestData(env).recipes.find(item => item.id === recipe.value.id).stats, { count: 1, average: 5 });
  env.app.setDirty(true, 'records');
  const readsBefore = env.fake.calls.filter(call => call.pathname.endsWith('/query')).length;

  env.fake.intercept = ({ method }) => {
    if (method === 'PATCH') {
      const operation = env.native.journal().operations.at(-1);
      assert.equal(operation.kind, 'delete-record');
      assert.equal(operation.status, 'processing');
      assert.deepEqual(operation.deleteTarget, { kind: 'records', id: record.value.id, archiveState: 'active' });
    }
    return null;
  };
  const result = await env.app.submit('delete-record', { id: record.value.id });

  assert.equal(result.status, 'succeeded');
  assert.equal(sourceRows(env, 'records')[0].in_trash, true);
  assert.equal(latestData(env).records.length, 0);
  assert.deepEqual(latestData(env).recipes.find(item => item.id === recipe.value.id).stats, { count: 0, average: null });
  assert.ok(env.fake.calls.filter(call => call.pathname.endsWith('/query')).length > readsBefore);
  assert.equal(env.app.getState().dirty, true);
});

test('lost record deletion response recovers from the fresh target without a second PATCH', async () => {
  const env = await setup();
  const recipe = await env.app.submit('recipes', recipeInput(env.beanId));
  const record = await env.app.submit('records', recordInput(env.beanId, recipe.value.id));
  const page = sourceRows(env, 'records')[0];
  env.fake.intercept = ({ method, pathname }) => {
    if (method === 'PATCH') {
      page.in_trash = true;
      throw new TypeError('response lost');
    }
    return null;
  };

  const outcome = await env.app.submit('delete-record', { id: record.value.id });
  assert.equal(outcome.status, 'unknown');
  const operation = env.native.journal().operations.at(-1);
  assert.equal(operation.kind, 'delete-record');
  assert.deepEqual(operation.deleteTarget, { kind: 'records', id: record.value.id, archiveState: 'unknown' });
  env.fake.intercept = null;
  const restarted = env.make().app;
  await restarted.initialize();
  await restarted.resolveOperation(operation.key, { originalConfirmed: true, decision: 'saved' });

  assert.equal(env.native.journal().operations.at(-1).status, 'succeeded');
  assert.equal(env.native.journal().operations.at(-1).deleteTarget.archiveState, 'archived');
  assert.equal(patches(env).length, 1);
});
