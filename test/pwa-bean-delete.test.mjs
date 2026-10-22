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
      view: { showStatus: v => events.push(v), renderData: d => events.push({ data: d }), setState() {}, clearSecret() {} },
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

for (const relation of ['bags', 'recipes']) test(`bean deletion refuses a linked ${relation} without PATCH`, async () => {
  const env = await setup();
  await env.app.submit(relation, relation === 'bags'
    ? { name: '봉지', beanId: env.id, roastedOn: '2026-10-22' } : recipe(env.id));
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'failed');
  assert.equal(patches(env).length, 0);
  assert.equal(env.fake.rows[0].in_trash, false);
});

test('excluded malformed related rows and failed fresh reads fail closed', async () => {
  const env = await setup();
  await env.app.submit('bags', { name: '봉지', beanId: env.id, roastedOn: '2026-10-22' });
  env.fake.rows[1].properties['원두'].relation = [];
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'failed');
  assert.equal(patches(env).length, 0);
  env.fake.intercept = ({ pathname }) => pathname.includes('/query') ? Response.json({}, { status: 503 }) : null;
  assert.equal((await env.app.submit('delete-bean', { id: env.id })).status, 'failed');
  assert.equal(patches(env).length, 0);
});

test('archiveBean refuses another data source and validates the PATCH response', async () => {
  const env = await setup(), c = env.connection();
  const client = new NotionClient(c.token, { dataSources: c.dataSources, connectionRevision: c.revision, fetchImpl: env.fake.fetch });
  env.fake.rows[0].parent.data_source_id = c.dataSources.bags;
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
