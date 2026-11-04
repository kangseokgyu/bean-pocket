import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { migrateBestRecordRelation, parseMigrationArgs } from '../scripts/migrate-best-record-relation.mjs';

const beansId = '11111111-1111-4111-8111-111111111111';
const recordsId = '22222222-2222-4222-8222-222222222222';
const existingProperties = {
  '원두 이름': { type: 'title', title: {} },
  '향미 노트': { type: 'rich_text', rich_text: {} },
};

function fakeFetch(initialProperties = structuredClone(existingProperties), { mutateExistingOnPatch = false } = {}) {
  const calls = [];
  let properties = structuredClone(initialProperties);
  return {
    calls,
    properties: () => structuredClone(properties),
    async fetch(url, options) {
      const path = new URL(url).pathname;
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ method: options.method, path, body });
      if (options.method === 'GET') return Response.json({ object: 'data_source', properties });
      if (options.method === 'PATCH') {
        properties = { ...properties, ...Object.fromEntries(Object.entries(body.properties)
          .map(([name, property]) => [name, { type: Object.keys(property)[0], ...property,
            ...(property.relation ? { relation: { type: 'single_property', ...property.relation } } : {}) }])) };
        if (mutateExistingOnPatch) properties['향미 노트'] = { type: 'rich_text', rich_text: [{ plain_text: 'changed' }] };
        return Response.json({ object: 'data_source', properties });
      }
      return Response.json({}, { status: 405 });
    },
  };
}

test('migration defaults to a read-only test dry-run and proposes a single-property records relation', async () => {
  const fake = fakeFetch();
  const result = await migrateBestRecordRelation({ token: 'test-token', beansDataSourceId: beansId,
    recordsDataSourceId: recordsId, fetchImpl: fake.fetch });

  assert.equal(result.status, 'would-add');
  assert.equal(result.applied, false);
  assert.deepEqual(fake.calls.map(call => call.method), ['GET']);
  assert.deepEqual(fake.properties(), existingProperties);
  assert.deepEqual(result.property, { relation: { type: 'single_property', data_source_id: recordsId, single_property: {} } });
});

test('apply preserves every existing property and a second run performs no PATCH', async () => {
  const fake = fakeFetch();
  const options = { token: 'test-token', beansDataSourceId: beansId, recordsDataSourceId: recordsId,
    apply: true, fetchImpl: fake.fetch };
  const first = await migrateBestRecordRelation(options);
  const afterFirst = fake.properties();
  const second = await migrateBestRecordRelation(options);

  assert.equal(first.status, 'updated');
  assert.equal(first.schemaPreserved, true);
  assert.equal(second.status, 'already-configured');
  assert.equal(second.applied, false);
  assert.equal(fake.calls.filter(call => call.method === 'PATCH').length, 1);
  assert.ok(isDeepStrictEqual(afterFirst['원두 이름'], existingProperties['원두 이름']));
  assert.ok(isDeepStrictEqual(afterFirst['향미 노트'], existingProperties['향미 노트']));
  assert.deepEqual(afterFirst['베스트 추출'], { type: 'relation', relation: {
    type: 'single_property', data_source_id: recordsId, single_property: {},
  } });
});

test('migration rejects a conflicting property before any write', async () => {
  const fake = fakeFetch({ ...existingProperties, '베스트 추출': { type: 'number', number: {} } });
  await assert.rejects(migrateBestRecordRelation({ token: 'test-token', beansDataSourceId: beansId,
    recordsDataSourceId: recordsId, apply: true, fetchImpl: fake.fetch }), /conflict/i);
  assert.deepEqual(fake.calls.map(call => call.method), ['GET']);
});

test('post-write readback rejects any change to properties that existed before migration', async () => {
  const fake = fakeFetch(existingProperties, { mutateExistingOnPatch: true });
  await assert.rejects(migrateBestRecordRelation({ token: 'test-token', beansDataSourceId: beansId,
    recordsDataSourceId: recordsId, apply: true, fetchImpl: fake.fetch }), /preserve/i);
  assert.deepEqual(fake.calls.map(call => call.method), ['GET', 'PATCH', 'GET']);
});

test('a lost PATCH response is reconciled by schema readback without issuing a second PATCH', async () => {
  const fake = fakeFetch();
  const fetch = async (url, options) => {
    const response = await fake.fetch(url, options);
    if (options.method === 'PATCH') throw new TypeError('simulated lost response');
    return response;
  };
  const result = await migrateBestRecordRelation({ token: 'test-token', beansDataSourceId: beansId,
    recordsDataSourceId: recordsId, apply: true, fetchImpl: fetch });

  assert.equal(result.status, 'updated');
  assert.equal(result.responseUncertain, true);
  assert.deepEqual(fake.calls.map(call => call.method), ['GET', 'PATCH', 'GET']);
  assert.equal(fake.calls.filter(call => call.method === 'PATCH').length, 1);
});

test('command parsing keeps apply opt-in and restricts target environments', () => {
  assert.deepEqual(parseMigrationArgs(['--config', '/private/tmp/config.json']), {
    apply: false, configPath: '/private/tmp/config.json', environment: 'test',
  });
  assert.deepEqual(parseMigrationArgs(['--config', '/private/tmp/config.json', '--apply', '--environment', 'operating']), {
    apply: true, configPath: '/private/tmp/config.json', environment: 'operating',
  });
  assert.throws(() => parseMigrationArgs(['--apply', '--environment', 'both']), /config/i);
  assert.throws(() => parseMigrationArgs(['--config', '/private/tmp/config.json', '--environment', 'production']), /environment/i);
});
