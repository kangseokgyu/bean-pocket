import test from 'node:test';
import assert from 'node:assert/strict';
import { NotionClient, NotionRepository, readDataSources } from '../lib/notion.mjs';
import { DATA_SOURCES } from './fixtures/notion-config.mjs';

test('설정된 데이터 소스를 연결 확인·조회·저장에 사용한다', async () => {
  const calls = [];
  const client = new NotionClient('test-token', {
    dataSources: DATA_SOURCES,
    fetchImpl: async (url, options) => {
      calls.push({ path: new URL(url).pathname, method: options.method, body: options.body && JSON.parse(options.body) });
      return Response.json({ id: 'created-page', results: [], has_more: false });
    },
  });
  await client.verify();
  assert.deepEqual(calls.map(call => call.path), Object.values(DATA_SOURCES).map(id => '/v1/data_sources/' + id));
  calls.length = 0;
  const repository = new NotionRepository(client);
  await repository.all();
  assert.deepEqual(calls.map(call => call.path), Object.values(DATA_SOURCES).map(id => `/v1/data_sources/${id}/query`));
  await repository.create('beans', { name: 'test bean' });
  assert.equal(calls.at(-1).body.parent.data_source_id, DATA_SOURCES.beans);
});

test('누락된 ID가 있으면 외부 요청 전에 설정 오류를 알린다', async () => {
  let calls = 0;
  const client = new NotionClient('test-token', {
    dataSources: { ...DATA_SOURCES, records: '' },
    fetchImpl: async () => { calls++; return Response.json({}); },
  });
  await assert.rejects(() => client.verify(), /NOTION_RECORDS_DATA_SOURCE_ID/);
  assert.equal(calls, 0);
});


test('환경변수에서 ID를 읽고 공백을 제거하며 개인 ID로 대체하지 않는다', () => {
  const env = Object.fromEntries(Object.entries(DATA_SOURCES).map(([kind, id]) => [
    `NOTION_${kind.toUpperCase()}_DATA_SOURCE_ID`, `  ${id}  `,
  ]));
  assert.deepEqual(readDataSources(env), DATA_SOURCES);
  assert.deepEqual(readDataSources({}), { beans: '', recipes: '', steps: '', records: '' });
  assert.equal(Object.isFrozen(readDataSources(env)), true);
});
