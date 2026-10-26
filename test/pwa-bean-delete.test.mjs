import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../pwa/ui/controller.mjs';
import { NotionClient } from '../pwa/data/notion-client.mjs';
import { createReadRepository } from '../pwa/data/read-repository.mjs';
import { createCommands } from '../pwa/commands/index.mjs';
import { createSubmissionState, createSubmissionDraft } from '../pwa/state/submission-state.mjs';
import { memoryPlatform, fakePwaNotion, testConnection } from './fixtures/pwa-environment.mjs';

async function setup() {
  const native = memoryPlatform({ initialized: false }), fake = fakePwaNotion(), events = [];
  const connection = () => JSON.parse(native.files.get('connection.json'));
  const make = () => {
    const state = createSubmissionState(native);
    const app = createAppController({
      view: { currentRoute() { return '/beans'; }, showStatus: v => events.push(v), renderData: d => events.push({ data: d }), setState() {}, clearSecret() {} },
      state, file: { readConnection: async () => native.files.has('connection.json') ? connection() : null },
      makeClient: c => new NotionClient(c.token, { dataSources: c.dataSources, connectionRevision: c.revision, fetchImpl: fake.fetch }),
      makeRepository: createReadRepository, makeCommands: createCommands,
    });
    return { app, state };
  };
  const { app, state } = make();
  await app.connect(testConnection());
  const bean = await app.submit('beans', { name: '삭제 테스트 원두' });
  return { native, fake, events, app, state, make, connection, id: bean.value.id };
}
const patches = env => env.fake.calls.filter(c => c.method === 'PATCH');
const recipe = beanId => ({ name: 'V60', beanId, dose: 15, totalWater: 250, temperature: 93,
  steps: [{ time: '0:00', water: 50 }, { time: '0:30', water: 200 }] });

function seedRawBag(env, beanId, id = '22222222-2222-4222-8222-222222222222') {
  env.fake.rows.push({ object: 'page', id,
    parent: { type: 'data_source_id', data_source_id: '22222222-2222-4222-8222-222222222222' },
    archived: false, in_trash: false, last_edited_time: '2026-10-22T00:00:00.000Z',
    properties: {
      '봉지 이름': { type: 'title', title: [{ plain_text: '과거 봉지' }] },
      '원두': { type: 'relation', relation: [{ id: beanId }], has_more: false },
      '로스팅 날짜': { type: 'date', date: { start: '2026-10-22' } },
    },
  });
}

function convertRecordToLegacyV1(env, recipeId) {
  const row = env.fake.rows.find(item => item.parent.data_source_id === env.connection().dataSources.records);
  row.properties['원두'].relation = [];
  const snapshotProperty = row.properties['당시 레시피 스냅샷'];
  const snapshotV2 = JSON.parse(snapshotProperty.rich_text.map(item => item.text.content).join(''));
  snapshotProperty.rich_text = [{ type: 'text', text: { content: JSON.stringify({
    version: 1, ...snapshotV2.recipe, id: recipeId, beanId: env.id,
  }) } }];
  return row;
}

test('bean deletion persists its target before PATCH and refreshes the list', async () => {
  const env = await setup();
  env.fake.intercept = ({ method }) => {
    if (method === 'PATCH') {
      const op = env.native.journal().operations.at(-1);
      assert.equal(op.kind, 'delete-bean');
      assert.equal(op.status, 'processing');
      assert.deepEqual(op.deleteTarget, { kind: 'beans', id: env.id, archiveState: 'active' });
    }
  };
  const result = await env.app.submit('delete-bean', { id: env.id });
  assert.equal(result.status, 'succeeded');
  assert.equal(patches(env).length, 1);
  assert.equal(env.fake.rows[0].in_trash, true);
  assert.equal(env.events.filter(e => e.data).at(-1).data.beans.length, 0);
  assert.equal(env.native.journal().operations.at(-1).deleteTarget.archiveState, 'archived');
});

test('bean deletion ignores an unqueried legacy bag and preserves its remote row', async () => {
  const env = await setup();
  seedRawBag(env, env.id);
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'succeeded');
  assert.equal(patches(env).length, 1);
  assert.equal(env.fake.rows[0].in_trash, true);
  assert.equal(env.fake.rows[1].in_trash, false);
  assert.equal(env.fake.calls.some(call => call.pathname.includes('22222222-2222-4222-8222-222222222222')), false);
});

test('bean deletion permits a legacy recipe relation without a record or bag dependency', async () => {
  const env = await setup();
  const saved = await env.app.submit('recipes', recipe(env.id));
  const page = env.fake.rows.find(row => row.id === saved.value.id);
  page.properties['원두'] = { id: 'legacy-recipe-bean', type: 'relation', relation: [{ id: env.id }], has_more: false };
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'succeeded');
  assert.equal(patches(env).length, 1);
  assert.equal(env.fake.rows[0].in_trash, true);
});

test('bean deletion protects a known extraction record and an unresolved legacy record', async () => {
  const env = await setup();
  const saved = await env.app.submit('recipes', recipe(env.id));
  const record = await env.app.submit('records', { beanId: env.id, recipeId: saved.value.id, date: '2026-10-22', rating: 5 });
  assert.equal(record.status, 'succeeded');
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'failed');
  assert.equal(patches(env).length, 0);

  const unresolved = await setup();
  const legacyRecipe = await unresolved.app.submit('recipes', recipe(unresolved.id));
  const savedRecord = unresolved.fake.rows.find(row => row.id === legacyRecipe.value.id);
  const recordPage = {
    object: 'page',
    id: 'eeeeeeee-5555-4555-8555-111111111111',
    parent: { type: 'data_source_id', data_source_id: unresolved.connection().dataSources.records },
    in_trash: false, archived: false, last_edited_time: '2026-10-22T00:00:00.000Z',
    properties: {
      '기록 이름': { id: 'record-title', type: 'title', title: [{ plain_text: '과거 기록' }] },
      '레시피': { id: 'record-recipe', type: 'relation', relation: [{ id: savedRecord.id }], has_more: false },
      '원두 봉지': { id: 'record-bag', type: 'relation', relation: [{ id: '22222222-2222-4222-8222-222222222222' }], has_more: false },
      '날짜': { id: 'record-date', type: 'date', date: { start: '2026-10-21' } },
      '별점': { id: 'record-rating', type: 'number', number: 4 },
      '컵노트': { id: 'record-note', type: 'rich_text', rich_text: [] },
      '당시 레시피 스냅샷': { id: 'record-snapshot', type: 'rich_text', rich_text: [] },
    },
  };
  seedRawBag(unresolved, unresolved.id);
  unresolved.fake.rows.push(recordPage);
  const c = unresolved.connection();
  const raw = await createReadRepository(new NotionClient(c.token, { dataSources: c.dataSources, connectionRevision: c.revision, fetchImpl: unresolved.fake.fetch })).readAll();
  assert.equal(raw.records[0].beanId, null);
  assert.equal(raw.records[0].beanResolution, 'needs-confirmation');
  assert.equal(raw.records[0].rating, 4);
  assert.equal(raw.records[0].snapshotStatus, 'missing');
  assert.equal(Object.hasOwn(raw.records[0], 'bagId'), false);
  assert.equal((await unresolved.app.submit('delete-bean', { id: unresolved.id })).status, 'failed');
  assert.equal(patches(unresolved).length, 0);
});

test('bean deletion protects a v1 record when its legacy recipe has multiple bean candidates', async () => {
  const env = await setup();
  const other = await env.app.submit('beans', { name: '두 번째 원두' });
  const saved = await env.app.submit('recipes', recipe(env.id));
  await env.app.submit('records', { beanId: env.id, recipeId: saved.value.id, date: '2026-10-22', rating: 5 });
  const record = convertRecordToLegacyV1(env, saved.value.id);
  const recipeRow = env.fake.rows.find(row => row.id === saved.value.id);
  recipeRow.properties['원두'] = { id: 'legacy-recipe-bean', type: 'relation',
    relation: [{ id: env.id }, { id: other.value.id }], has_more: false };

  assert.equal((await env.app.submit('delete-bean', { id: other.value.id })).status, 'failed');
  assert.equal(patches(env).length, 0);
  assert.equal(record.properties['원두'].relation.length, 0);
});

test('bean deletion stays blocked when a truncated legacy relation exposes only one candidate', async () => {
  const env = await setup();
  const other = await env.app.submit('beans', { name: '두 번째 원두' });
  const saved = await env.app.submit('recipes', recipe(env.id));
  await env.app.submit('records', { beanId: env.id, recipeId: saved.value.id, date: '2026-10-22', rating: 5 });
  convertRecordToLegacyV1(env, saved.value.id);
  const recipeRow = env.fake.rows.find(row => row.id === saved.value.id);
  recipeRow.properties['원두'] = { id: 'legacy-recipe-bean', type: 'relation',
    relation: [{ id: env.id }], has_more: true };

  assert.equal((await env.app.submit('delete-bean', { id: other.value.id })).status, 'failed');
  assert.equal(patches(env).length, 0);
});

test('unqueried malformed bag rows have no effect while failed fresh reads fail closed', async () => {
  const env = await setup();
  seedRawBag(env, env.id);
  env.fake.rows[1].properties['원두'].relation = [];
  env.fake.intercept = ({ pathname }) => pathname.includes('/query') ? Response.json({}, { status: 503 }) : null;
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'failed');
  assert.equal(patches(env).length, 0);
  env.fake.intercept = null;
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'succeeded');
  assert.equal(patches(env).length, 1);
  assert.equal(env.fake.rows[1].in_trash, false);
});

test('archiveBean refuses another data source and validates the PATCH response', async () => {
  const env = await setup(), c = env.connection();
  const client = new NotionClient(c.token, { dataSources: c.dataSources, connectionRevision: c.revision, fetchImpl: env.fake.fetch });
  env.fake.rows[0].parent.data_source_id = c.dataSources.recipes;
  await assert.rejects(client.archiveBean(env.id));
  assert.equal(patches(env).length, 0);
  env.fake.rows[0].parent.data_source_id = c.dataSources.beans;
  env.fake.intercept = ({ method }) => method === 'PATCH' ? Response.json({ ...env.fake.rows[0], in_trash: false }) : null;
  await assert.rejects(client.archiveBean(env.id), e => e.writeState === 'unknown');
});

for (const deleted of [true, false]) test(`lost deletion response recovers after restart from actual target (${deleted})`, async () => {
  const env = await setup();
  env.fake.intercept = ({ method }) => {
    if (method !== 'PATCH') return null;
    env.fake.rows[0].in_trash = deleted;
    throw new TypeError('response lost');
  };
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'unknown');
  assert.equal(env.app.getState().unresolved, true);
  await assert.rejects(env.app.submit('delete-bean', { id: env.id }));
  env.fake.intercept = null;
  const { app } = env.make();
  await app.initialize();
  assert.equal(app.getState().unresolved, true);
  const op = env.native.journal().operations.at(-1);
  await assert.rejects(app.resolveOperation(op.key, { originalConfirmed: true, decision: deleted ? 'not-saved' : 'saved' }));
  assert.equal(app.getState().unresolved, true);
  await app.resolveOperation(op.key, { originalConfirmed: true, decision: deleted ? 'saved' : 'not-saved' });
  assert.equal(app.getState().unresolved, false);
  assert.equal(env.native.journal().operations.at(-1).status, deleted ? 'succeeded' : 'failed');
  assert.equal(patches(env).length, 1, 'resolution must never retry the deletion');
});

test('404 cannot resolve an unknown deletion as success', async () => {
  const env = await setup();
  env.fake.intercept = ({ method }) => { if (method === 'PATCH') throw new TypeError('lost'); };
  await env.app.submit('delete-bean', { id: env.id });
  const key = env.native.journal().operations.at(-1).key;
  env.fake.intercept = ({ method, pathname }) => method === 'GET' && pathname.includes('/pages/') ? Response.json({}, { status: 404 }) : null;
  await assert.rejects(env.app.resolveOperation(key, { originalConfirmed: true, decision: 'saved' }));
  assert.equal(env.app.getState().unresolved, true);
});

test('pending, frozen and busy locks prevent deletion dispatch', async () => {
  const env = await setup();
  env.app.setFrozen(true);
  await assert.rejects(env.app.submit('delete-bean', { id: env.id }));
  env.app.setFrozen(false);
  await env.state.withWriteLock(async () => {
    await assert.rejects(env.app.submit('delete-bean', { id: env.id }));
  });
  let release, entered;
  const started = new Promise(r => { entered = r; });
  env.fake.intercept = async ({ method }) => {
    if (method === 'PATCH') { entered(); await new Promise(r => { release = r; }); }
  };
  const first = env.app.submit('delete-bean', { id: env.id });
  await started;
  await assert.rejects(env.app.submit('delete-bean', { id: env.id }));
  release();
  assert.equal((await first).status, 'succeeded');
  assert.equal(patches(env).length, 1);
});

test('delete target cannot use creation cleanup and stale connections cannot dispatch', async () => {
  const env = await setup(), c = env.connection();
  const draft = await createSubmissionDraft('delete-bean', { id: env.id }, { connectionRevision: c.revision, dataSources: c.dataSources });
  let sent = false;
  const result = await env.state.withWriteLock(ctx => ctx.runOperation(draft, c.revision, async op => {
    await op.write(async () => { sent = true; return { id: env.id, in_trash: true }; }, { archiveId: env.id });
  }));
  assert.equal(result.status, 'failed'); assert.equal(sent, false);
  const client = new NotionClient(c.token, { dataSources: c.dataSources, connectionRevision: c.revision, fetchImpl: env.fake.fetch });
  const commands = createCommands({ client, repository: createReadRepository(client), submissionState: env.state });
  const next = await commands.prepareDeleteBean({ id: env.id });
  env.native.files.set('connection.json', JSON.stringify({ ...c, revision: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
  await assert.rejects(commands.execute(next));
  assert.equal(patches(env).length, 0);
});

test('successful deletion with failed final refresh reports success separately', async () => {
  const env = await setup(); let deleted = false;
  env.fake.intercept = ({ method, pathname }) => {
    if (method === 'PATCH') deleted = true;
    if (deleted && pathname.includes('/query')) return Response.json({}, { status: 503 });
  };
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'succeeded');
  assert.equal(env.events.filter(e => e.type).at(-1).type, 'deleted-read-error');
});

test('a rejected deletion remains active and does not retry automatically', async () => {
  const env = await setup();
  env.fake.intercept = ({ method }) => method === 'PATCH' ? Response.json({}, { status: 403 }) : null;
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'failed');
  assert.equal(env.native.journal().operations.at(-1).deleteTarget.archiveState, 'active');
  assert.equal(env.app.getState().unresolved, false);
  assert.equal(patches(env).length, 1);
  assert.equal(env.fake.rows[0].in_trash, false);
});

test('a duplicate delete intent never dispatches twice and unsaved form state survives deletion', async () => {
  const env = await setup(), c = env.connection();
  const client = new NotionClient(c.token, { dataSources: c.dataSources, connectionRevision: c.revision, fetchImpl: env.fake.fetch });
  const commands = createCommands({ client, repository: createReadRepository(client), submissionState: env.state });
  const draft = await commands.prepareDeleteBean({ id: env.id });
  assert.equal((await commands.execute(draft)).status, 'succeeded');
  await assert.rejects(commands.execute(draft));
  assert.equal(patches(env).length, 1);
  const added = await env.app.submit('beans', { name: '다른 원두' });
  env.app.setDirty(true, 'beans');
  assert.equal((await env.app.submit('delete-bean', { id: added.value.id })).status, 'succeeded');
  assert.equal(env.app.getState().dirty, true);
});

test('missing and invalid targets cannot dispatch a deletion', async () => {
  const env = await setup();
  await assert.rejects(env.app.submit('delete-bean', { id: 'invalid' }));
  assert.equal((await env.app.submit('delete-bean', { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })).status, 'failed');
  assert.equal(patches(env).length, 0);
});

test('malformed durable delete targets block all further writes', async () => {
  const env = await setup();
  await env.app.submit('delete-bean', { id: env.id });
  const original = env.native.journal();
  for (const target of [null, { kind: 'recipes', id: env.id, archiveState: 'archived' },
    { kind: 'beans', id: 'invalid', archiveState: 'archived' }, { kind: 'beans', id: env.id, archiveState: 'invalid' }]) {
    const journal = structuredClone(original);
    journal.operations.at(-1).deleteTarget = target;
    env.native.files.set('submission-journal.json', JSON.stringify(journal));
    const { state } = env.make();
    await assert.rejects(state.withWriteLock(ctx => ctx.inspect()));
  }
  assert.equal(patches(env).length, 1);
});

test('delete write hooks reject a different target and arbitrary untracked writes', async () => {
  const env = await setup(), c = env.connection();
  for (const options of [{}, { deleteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }, { createdKind: 'beans' }]) {
    const draft = await createSubmissionDraft('delete-bean', { id: env.id }, { connectionRevision: c.revision, dataSources: c.dataSources });
    let sent = false;
    const result = await env.state.withWriteLock(ctx => ctx.runOperation(draft, c.revision, async op => {
      await op.write(async () => { sent = true; return { id: env.id, in_trash: true }; }, options);
    }));
    assert.equal(result.status, 'failed'); assert.equal(sent, false);
  }
});
