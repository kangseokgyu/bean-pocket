import test from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as connectionFileModule from '../pwa/platform/connection-file.mjs';
const { createConnectionFile } = connectionFileModule;

const DIRECTORY = 'bean-pocket-private-v1';
const FILE = 'connection.json';
const REVISION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_REVISION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SOURCE_IDS = Object.freeze({
  beans: '11111111-1111-4111-8111-111111111111',
  recipes: '33333333-3333-4333-8333-333333333333',
  steps: '44444444-4444-4444-8444-444444444444',
  records: '55555555-5555-4555-8555-555555555555',
});
const TOKEN = 'fake-notion-token-for-connection-file-tests';
const RAW = `private raw failure ${TOKEN} ${REVISION}`;

function connection(patch = {}) {
  return {
    schemaVersion: 1,
    revision: REVISION,
    token: TOKEN,
    dataSources: { ...SOURCE_IDS },
    ...patch,
  };
}

function error(name, message = RAW) {
  return Object.assign(new Error(message, { cause: new Error(RAW) }), { name });
}

function mockOpfs({ content, directoryExists = content !== undefined } = {}) {
  const state = {
    content,
    directoryExists,
    calls: [],
    failures: new Map(),
    writeGate: null,
    closeCommit: true,
    closeAfterCommitError: null,
    afterClose: null,
    abortCalls: 0,
    closeCalls: 0,
  };
  function failAt(stage) {
    const failure = state.failures.get(stage);
    if (failure) throw failure;
  }
  const storage = {
    async getDirectory() {
      state.calls.push({ method: 'getDirectory' });
      failAt('getDirectory');
      return root;
    },
  };
  const root = {
    async getDirectoryHandle(name, options) {
      state.calls.push({ method: 'getDirectoryHandle', name, options: { ...options } });
      failAt('getDirectoryHandle');
      if (name !== DIRECTORY) throw error('TypeMismatchError');
      if (!state.directoryExists && !options.create) throw error('NotFoundError');
      if (options.create) state.directoryExists = true;
      return directory;
    },
  };
  const directory = {
    async getFileHandle(name, options) {
      state.calls.push({ method: 'getFileHandle', name, options: { ...options } });
      failAt('getFileHandle');
      if (name !== FILE) throw error('TypeMismatchError');
      if (state.content === undefined && !options.create) throw error('NotFoundError');
      if (options.create && state.content === undefined) state.content = '';
      return {
        async createWritable() {
          state.calls.push({ method: 'createWritable' });
          failAt('createWritable');
          let draft = '';
          return {
            async write(value) {
              state.calls.push({ method: 'write' });
              if (state.writeGate) await state.writeGate;
              failAt('write');
              draft = value;
            },
            async close() {
              state.calls.push({ method: 'close' });
              state.closeCalls += 1;
              failAt('close');
              if (state.closeCommit) state.content = draft;
              if (state.afterClose) await state.afterClose(state);
              if (state.closeAfterCommitError) throw state.closeAfterCommitError;
            },
            async abort() {
              state.calls.push({ method: 'abort' });
              state.abortCalls += 1;
              failAt('abort');
            },
          };
        },
        async getFile() {
          state.calls.push({ method: 'getFile' });
          failAt('getFile');
          return {
            get size() { return typeof state.content === 'string' ? new TextEncoder().encode(state.content).length : 0; },
            async text() {
              state.calls.push({ method: 'text' });
              failAt('text');
              return state.content;
            },
          };
        },
      };
    },
  };
  return {
    storage,
    state,
    setFailure(stage, value) { state.failures.set(stage, value); },
    clearFailure(stage) { state.failures.delete(stage); },
  };
}

async function rejectedWith(action, code, writeState) {
  await assert.rejects(action, rejection => {
    assert.deepEqual(rejection.code, code);
    if (writeState === undefined) assert.equal('writeState' in rejection, false);
    else assert.equal(rejection.writeState, writeState);
    assert.ok(Object.isFrozen(rejection));
    assertNoSensitiveDetails(rejection);
    return true;
  });
}

function assertNoSensitiveDetails(value) {
  const rendered = JSON.stringify(value) + inspect(value);
  const secrets = [TOKEN, RAW, REVISION, ...Object.values(SOURCE_IDS)];
  assert.equal(secrets.some(secret => rendered.includes(secret)), false);
  assert.doesNotMatch(rendered, /cause|stack|Error:/i);
}

test('모듈은 factory와 readConnection/writeConnection만 제공한다', () => {
  assert.deepEqual(Object.keys(connectionFileModule), ['createConnectionFile']);
  const api = createConnectionFile({ storage: mockOpfs().storage });
  assert.deepEqual(Object.keys(api).sort(), ['readConnection', 'writeConnection']);
  assert.ok(Object.isFrozen(api));
});

test('readConnection은 전용 경로를 생성하지 않고 실제 부재만 null로 반환한다', async () => {
  const fs = mockOpfs({ directoryExists: false });
  const file = createConnectionFile({ storage: fs.storage });
  assert.equal(await file.readConnection(), null);
  assert.equal(fs.state.directoryExists, false);
  assert.equal(fs.state.content, undefined);
  assert.ok(fs.state.calls.some(call => call.method === 'getDirectoryHandle' && call.name === DIRECTORY && call.options.create === false));
  assert.ok(!fs.state.calls.some(call => call.options?.create === true));

  fs.state.directoryExists = true;
  assert.equal(await file.readConnection(), null);
  assert.equal(fs.state.content, undefined);
  assert.ok(fs.state.calls.some(call => call.method === 'getFileHandle' && call.name === FILE && call.options.create === false));
});

test('write/read 재실행은 고정 경로의 schema v1 연결을 정규화해 깊은 복사·불변 반환한다', async () => {
  const fs = mockOpfs();
  const file = createConnectionFile({ storage: fs.storage });
  const candidate = connection({ revision: REVISION.toUpperCase(), dataSources: Object.fromEntries(
    Object.entries(SOURCE_IDS).map(([key, value]) => [key, value.toUpperCase()]),
  ) });
  const saved = await file.writeConnection(candidate);
  candidate.token = 'caller mutation';
  candidate.dataSources.beans = OTHER_REVISION;
  assert.equal(saved.revision, REVISION);
  assert.equal(saved.dataSources.beans, SOURCE_IDS.beans);
  assert.equal(saved.token, TOKEN);
  assert.ok(Object.isFrozen(saved));
  assert.ok(Object.isFrozen(saved.dataSources));
  assert.throws(() => { saved.dataSources.beans = OTHER_REVISION; }, TypeError);
  const parsed = JSON.parse(fs.state.content);
  assert.deepEqual(Object.keys(parsed).sort(), ['dataSources', 'revision', 'schemaVersion', 'token']);
  assert.deepEqual(Object.keys(parsed.dataSources).sort(), ['beans', 'recipes', 'records', 'steps']);
  assert.ok(fs.state.calls.some(call => call.method === 'getDirectoryHandle' && call.name === DIRECTORY && call.options.create === true));
  assert.ok(fs.state.calls.some(call => call.method === 'getFileHandle' && call.name === FILE && call.options.create === true));
  const update = await file.writeConnection(connection({ revision: OTHER_REVISION, token: '  updated  fake token  ' }));
  assert.equal(update.revision, OTHER_REVISION);
  assert.equal(update.token, '  updated  fake token  ');
  assert.equal(JSON.parse(fs.state.content).schemaVersion, 1);
  const afterRestart = await createConnectionFile({ storage: fs.storage }).readConnection();
  assert.deepEqual(afterRestart, update);
  assert.equal(saved.revision, REVISION);
  assert.equal(saved.token, TOKEN);
  assert.ok(Object.isFrozen(afterRestart.dataSources));
});

test('기존 파일 read는 내용을 바꾸거나 native write stream을 만들지 않는다', async () => {
  const original = JSON.stringify(connection());
  const fs = mockOpfs({ content: original });
  const saved = await createConnectionFile({ storage: fs.storage }).readConnection();
  assert.deepEqual(saved, connection());
  assert.equal(fs.state.content, original);
  assert.equal(fs.state.calls.some(call => ['createWritable', 'write', 'close', 'abort'].includes(call.method)), false);
  assert.equal(fs.state.calls.some(call => call.options?.create === true), false);
});

test('writeConnection snapshots input before awaiting native staging', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const fs = mockOpfs(); fs.state.writeGate = gate;
  const file = createConnectionFile({ storage: fs.storage });
  const candidate = connection();
  const saving = file.writeConnection(candidate);
  candidate.token = 'changed after call';
  candidate.dataSources.records = OTHER_REVISION;
  release();
  const saved = await saving;
  assert.equal(saved.token, TOKEN);
  assert.equal(saved.dataSources.records, SOURCE_IDS.records);
});

test('잘못된 입력은 native 파일 접근 전에 안전 오류로 거부한다', async () => {
  const fs = mockOpfs();
  const file = createConnectionFile({ storage: fs.storage });
  const invalid = [
    null,
    [],
    { ...connection(), extra: 'unknown' },
    connection({ schemaVersion: 2 }),
    connection({ revision: 'not-a-uuid' }),
    connection({ dataSources: { ...SOURCE_IDS, unknown: OTHER_REVISION } }),
    connection({ dataSources: { beans: SOURCE_IDS.beans, bags: SOURCE_IDS.bags, recipes: SOURCE_IDS.recipes, steps: SOURCE_IDS.steps } }),
    connection({ dataSources: { ...SOURCE_IDS, beans: '../connection.json' } }),
    connection({ token: '' }),
    connection({ token: '   ' }),
    connection({ token: `bad\u0000${TOKEN}` }),
    connection({ token: `bad\u0085${TOKEN}` }),
  ];
  for (const value of invalid) await rejectedWith(() => file.writeConnection(value), 'invalid-input', 'not-sent');
  assert.equal(fs.state.calls.length, 0);
});

test('write 단계의 close 전 실패는 abort를 시도하고 기존 유효 바이트를 보존한다', async t => {
  for (const stage of ['createWritable', 'write']) {
    await t.test(stage, async () => {
      const original = JSON.stringify(connection());
      const fs = mockOpfs({ content: original });
      fs.setFailure(stage, error(stage === 'write' ? 'QuotaExceededError' : 'NotAllowedError'));
      const file = createConnectionFile({ storage: fs.storage });
      await rejectedWith(() => file.writeConnection(connection({ revision: OTHER_REVISION })),
        stage === 'write' ? 'quota' : 'permission', 'not-sent');
      assert.equal(fs.state.content, original);
      assert.equal(fs.state.closeCalls, 0);
      if (stage === 'write') assert.equal(fs.state.abortCalls, 1);
    });
  }
});

test('close를 시작한 뒤 예외가 나면 저장 여부를 unknown으로 표시하고 차단 정보를 준다', async () => {
  const original = JSON.stringify(connection());
  const fs = mockOpfs({ content: original });
  fs.state.closeAfterCommitError = error('UnknownError');
  const file = createConnectionFile({ storage: fs.storage });
  let rejection;
  try { await file.writeConnection(connection({ revision: OTHER_REVISION })); }
  catch (value) { rejection = value; }
  assert.equal(rejection?.code, 'save-uncertain');
  assert.equal(rejection?.writeState, 'unknown');
  assert.equal(rejection?.blockWrites, true);
  assert.ok(Object.isFrozen(rejection));
  assert.equal(fs.state.closeCalls, 1);
  assert.equal(fs.state.abortCalls, 0);
  assert.equal(fs.state.content, JSON.stringify(connection({ revision: OTHER_REVISION })));
  assertNoSensitiveDetails(rejection);
});

test('close가 commit 전에 실패해도 기존 파일 보존을 단정하지 않고 unknown을 반환한다', async () => {
  const original = JSON.stringify(connection());
  const fs = mockOpfs({ content: original });
  fs.state.closeCommit = false;
  fs.setFailure('close', error('QuotaExceededError'));
  const file = createConnectionFile({ storage: fs.storage });
  let rejection;
  try { await file.writeConnection(connection({ revision: OTHER_REVISION })); }
  catch (value) { rejection = value; }
  assert.equal(rejection?.code, 'save-uncertain');
  assert.equal(rejection?.writeState, 'unknown');
  assert.equal(rejection?.blockWrites, true);
  assert.equal(fs.state.content, original);
  assert.equal(fs.state.abortCalls, 0);
  assertNoSensitiveDetails(rejection);
});

test('commit 후 readback 오류나 불일치는 save-uncertain/unknown으로 보고한다', async t => {
  for (const scenario of ['readback-error', 'mismatch']) {
    await t.test(scenario, async () => {
      const fs = mockOpfs();
      if (scenario === 'readback-error') fs.state.afterClose = async state => state.failures.set('text', error('NotAllowedError'));
      else fs.state.afterClose = async state => { state.content = JSON.stringify(connection({ revision: OTHER_REVISION })); };
      const file = createConnectionFile({ storage: fs.storage });
      let rejection;
      try { await file.writeConnection(connection()); }
      catch (value) { rejection = value; }
      assert.equal(rejection?.code, 'save-uncertain');
      assert.equal(rejection?.writeState, 'unknown');
      assert.equal(rejection?.blockWrites, true);
      assert.equal(fs.state.closeCalls, 1);
      assert.equal(fs.state.abortCalls, 0);
      assertNoSensitiveDetails(rejection);
    });
  }
});

test('최초 저장의 close 전 실패로 남은 0바이트 파일은 다음 읽기에서 손상으로 구분한다', async () => {
  const fs = mockOpfs({ directoryExists: false });
  fs.setFailure('write', error('UnknownError'));
  const file = createConnectionFile({ storage: fs.storage });
  await rejectedWith(() => file.writeConnection(connection()), 'storage-error', 'not-sent');
  assert.equal(fs.state.content, '');
  fs.clearFailure('write');
  await rejectedWith(() => file.readConnection(), 'corrupt');
});

test('read 오류는 부재와 구분하고 원문 NotFound는 storage-error로 안전 변환한다', async t => {
  for (const [name, code] of [
    ['NotAllowedError', 'permission'], ['SecurityError', 'permission'], ['QuotaExceededError', 'quota'],
    ['NotSupportedError', 'unsupported'], ['TypeMismatchError', 'path-conflict'], ['UnknownError', 'storage-error'],
  ]) {
    await t.test(name, async () => {
      const fs = mockOpfs({ content: JSON.stringify(connection()) });
      fs.setFailure('text', error(name));
      const file = createConnectionFile({ storage: fs.storage });
      await rejectedWith(() => file.readConnection(), code);
      assertNoSensitiveDetails(await file.readConnection().catch(value => value));
    });
  }
  const fs = mockOpfs({ content: JSON.stringify(connection()) });
  fs.setFailure('text', error('NotFoundError'));
  await rejectedWith(() => createConnectionFile({ storage: fs.storage }).readConnection(), 'storage-error');
});

test('파일 손상과 미지원 schema version을 서로 구분한다', async t => {
  for (const [text, code] of [
    ['', 'corrupt'], ['not-json', 'corrupt'], ['{}', 'corrupt'],
    [JSON.stringify(connection({ schemaVersion: 9 })), 'unsupported-version'],
    [JSON.stringify(connection({ token: '   ' })), 'corrupt'],
    [JSON.stringify({ ...connection(), unexpected: true }), 'corrupt'],
    [JSON.stringify({ ...connection(), dataSources: { ...SOURCE_IDS, extra: OTHER_REVISION } }), 'corrupt'],
    [JSON.stringify(connection({ token: `secret\u0001${TOKEN}` })), 'corrupt'],
  ]) {
    await t.test(code, async () => {
      const fs = mockOpfs({ content: text });
      await rejectedWith(() => createConnectionFile({ storage: fs.storage }).readConnection(), code);
    });
  }
});

test('미지원 OPFS는 안전 오류로 실패하며 fallback 경로나 브라우저 저장소를 쓰지 않는다', async () => {
  const file = createConnectionFile({ storage: {} });
  await rejectedWith(() => file.readConnection(), 'unsupported');
  await rejectedWith(() => file.writeConnection(connection()), 'unsupported', 'not-sent');
});

test('native 접근 오류 레코드는 code/writeState만 노출하고 원문·token·ID·cause·stack을 숨긴다', async () => {
  const fs = mockOpfs({ content: JSON.stringify(connection()) });
  fs.setFailure('text', error('NotAllowedError'));
  const file = createConnectionFile({ storage: fs.storage });
  let rejection;
  try { await file.readConnection(); } catch (value) { rejection = value; }
  assert.deepEqual(Object.keys(rejection).sort(), ['code']);
  assertNoSensitiveDetails(rejection);

  const invalid = connection({ token: '' });
  let invalidRejection;
  try { await file.writeConnection(invalid); } catch (value) { invalidRejection = value; }
  assert.deepEqual(Object.keys(invalidRejection).sort(), ['code', 'writeState']);
  assertNoSensitiveDetails(invalidRejection);
});
