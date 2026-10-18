const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPECTED = Object.freeze({
  '원두 이름': 'title', '로스터리': 'rich_text', '원산지·농장': 'rich_text',
  '품종': 'rich_text', '가공 방식': 'rich_text', '로스터리 향미 노트': 'rich_text',
  '원두 봉지': 'relation', '레시피': 'relation',
});
const MESSAGES = Object.freeze({
  configured: '연결 입력을 메모리에 적용했습니다.',
  'invalid-config': '토큰과 하이픈이 포함된 UUID 형식의 데이터 소스 ID를 입력해 주세요.',
  busy: '현재 요청을 처리 중입니다. 완료될 때까지 기다려 주세요.',
  'not-ready': '정상 스키마 조회와 테스트 원두 대상 확인을 먼저 완료해 주세요. 잠금 상태라면 원본 확인도 필요합니다.',
  'read-ok': '원두 스키마를 정상 조회했습니다. 이 결과만으로 테스트 DB 여부나 생성 권한을 보장하지는 않습니다.',
  'schema-mismatch': '입력한 대상이 예상 원두 스키마와 일치하지 않습니다.',
  'read-rejected': '조회가 거부됐습니다. 인증과 연결 권한을 확인해 주세요.',
  'network-unconfirmed': '통신 응답을 확인하지 못했습니다. 네트워크와 교차 출처 정책 등 원인은 이 결과만으로 구분할 수 없습니다.',
  'read-timeout': '조회 응답 대기 시간이 지났습니다.',
  'invalid-response': '정상적인 응답 형식을 확인하지 못했습니다.',
  'auth-401': '잘못된 인증 요청의 401 응답을 확인했습니다.',
  'auth-unexpected': '잘못된 인증 요청에서 예상한 401을 확인하지 못했습니다.',
  'confirmation-required': '생성 여부 확인이 필요합니다. 재전송하지 마세요. 설정을 유지한 채 Notion 원본을 직접 확인하고 확인 체크 후 다시 조회해 주세요.',
  'create-rejected': '생성 요청이 거부됐습니다. 저장되지 않은 응답으로 처리하며, 설정 확인과 정상 재조회가 필요합니다.',
  created: '생성 성공과 생성 항목 재조회를 확인했습니다. 새 생성을 하려면 원본 확인 체크 후 다시 조회해 주세요.',
  'created-readback-failed': '생성은 성공했습니다. 이후 재조회만 확인하지 못했습니다. 저장 실패로 판단하거나 재전송하지 말고 Notion 원본을 확인해 주세요.',
});

function result(code, details = {}) {
  return Object.freeze({ code, message: MESSAGES[code], ...details });
}
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
}
class RequestFailure extends Error {
  constructor(kind) { super(kind); this.kind = kind; }
}
function sameId(a, b) { return typeof a === 'string' && a.toLowerCase() === b; }
function validSchema(body, id) {
  return body?.object === 'data_source' && sameId(body.id, id) &&
    Array.isArray(body.title) && body.title.map(t => t?.plain_text ?? t?.text?.content ?? '').join('') === '원두' &&
    Object.entries(EXPECTED).every(([name, type]) => body.properties?.[name]?.type === type);
}

export function createNotionProbe({ fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  let config = null;
  let busy = false, locked = false, schemaVerified = false, targetConfirmed = false, originalConfirmed = false;

  function getState() {
    return Object.freeze({ busy, locked, schemaVerified, targetConfirmed, originalConfirmed,
      canCreate: !!config && schemaVerified && targetConfirmed && !busy && !locked });
  }

  async function request(path, method, active, body, invalidAuth = false) {
    const controller = new AbortController();
    let timer;
    const headers = Object.freeze({
      Authorization: 'Bearer ' + (invalidAuth ? 'invalid-probe-credential' : active.token),
      'Notion-Version': '2025-09-03', 'Content-Type': 'application/json',
    });
    const options = Object.freeze({
      method, headers, signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await fetchImpl('https://api.notion.com/v1' + path, options);
          if (!response.ok || invalidAuth) return { ok: response.ok, status: response.status };
          let data;
          try { data = await response.json(); } catch { throw new RequestFailure('invalid-response'); }
          return { ok: true, status: response.status, data };
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => { reject(new RequestFailure('timeout')); controller.abort(); }, timeoutMs);
        }),
      ]);
    } finally { clearTimeout(timer); }
  }

  function configure(input = {}) {
    if (busy) return result('busy');
    const token = typeof input.token === 'string' ? input.token.trim() : '';
    const dataSourceId = typeof input.dataSourceId === 'string' ? input.dataSourceId.trim().toLowerCase() : '';
    if (config?.token === token && config.dataSourceId === dataSourceId) return result('configured');
    // Keep the exact original target and credential while a write needs confirmation.
    if (locked) return result('confirmation-required');
    schemaVerified = false; targetConfirmed = false; originalConfirmed = false;
    config = token && UUID.test(dataSourceId) ? Object.freeze({ token, dataSourceId }) : null;
    return result(config ? 'configured' : 'invalid-config');
  }

  function readFailure(error) {
    if (error instanceof RequestFailure) return result(error.kind === 'timeout' ? 'read-timeout' : 'invalid-response');
    return result('network-unconfirmed');
  }

  async function read() {
    if (busy) return result('busy');
    if (!config) return result('invalid-config');
    busy = true; schemaVerified = false;
    const active = config;
    try {
      const response = await request('/data_sources/' + active.dataSourceId, 'GET', active);
      if (!response.ok) return result('read-rejected', { httpStatus: response.status });
      if (!validSchema(response.data, active.dataSourceId)) return result('schema-mismatch');
      schemaVerified = true;
      if (locked && originalConfirmed) { locked = false; originalConfirmed = false; }
      return result('read-ok');
    } catch (error) { return readFailure(error); }
    finally { busy = false; }
  }

  async function testInvalidAuth() {
    if (busy) return result('busy');
    busy = true;
    try {
      const response = await request('/users/me', 'GET', null, null, true);
      return result(response.status === 401 ? 'auth-401' : 'auth-unexpected', { httpStatus: response.status });
    } catch (error) { return readFailure(error); }
    finally { busy = false; }
  }

  async function create() {
    if (busy) return result('busy');
    if (!getState().canCreate) return result('not-ready');
    const active = config;
    const payload = freeze({
      parent: { type: 'data_source_id', data_source_id: active.dataSourceId },
      properties: { '원두 이름': { title: [{ type: 'text', text: { content: 'T06 사용자가 생성한 테스트 원두' } }] } },
    });
    busy = true; locked = true; targetConfirmed = false; originalConfirmed = false;
    try {
      let response;
      try { response = await request('/pages', 'POST', active, payload); }
      catch { return result('confirmation-required', { saved: null }); }
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 408) {
          locked = false; schemaVerified = false;
          return result('create-rejected', { saved: false, httpStatus: response.status });
        }
        return result('confirmation-required', { saved: null, httpStatus: response.status });
      }
      const id = response.data?.id;
      if (response.data?.object !== 'page' || typeof id !== 'string' || !UUID.test(id)) return result('confirmation-required', { saved: null });
      try {
        const checked = await request('/pages/' + id.toLowerCase(), 'GET', active);
        if (!checked.ok || checked.data?.object !== 'page' || !sameId(checked.data.id, id.toLowerCase())) {
          return result('created-readback-failed', { saved: true });
        }
        return result('created', { saved: true });
      } catch { return result('created-readback-failed', { saved: true }); }
    } finally { busy = false; }
  }

  return Object.freeze({
    configure, read, testInvalidAuth, create, getState,
    confirmTarget(value) { if (!busy) targetConfirmed = value === true; },
    confirmOriginal(value) { if (!busy && locked) originalConfirmed = value === true; },
  });
}

export function bootstrap({ document: doc = globalThis.document, navigator: nav = globalThis.navigator,
  matchMedia = globalThis.matchMedia, fetchImpl = globalThis.fetch } = {}) {
  if (!doc) return null;
  const probe = createNotionProbe({ fetchImpl });
  const el = id => doc.getElementById(id);
  const token = el('token'), source = el('dataSourceId'), target = el('confirmTarget'), original = el('confirmOriginal');
  const readButton = el('btnRead'), authButton = el('btnAuth'), createButton = el('btnCreate');
  let media;
  try { media = matchMedia?.call(globalThis, '(display-mode: standalone)'); } catch { /* The runtime API may be unavailable. */ }
  const standalone = nav?.standalone === true || media?.matches === true;
  const modeKnown = typeof nav?.standalone === 'boolean' || typeof media?.matches === 'boolean';
  el('runtime').textContent = '실행 모드: ' + (standalone ? '홈 화면·standalone' : modeKnown ? '브라우저' : '확인 불가') +
    '\nuserAgent: ' + String(nav?.userAgent || '확인 불가').slice(0, 500) + '\n기종·OS는 사용자 기록과 화면 증거로 별도 확인해 주세요.';
  function render() {
    const state = probe.getState();
    token.disabled = source.disabled = state.busy || state.locked;
    readButton.disabled = authButton.disabled = state.busy;
    createButton.disabled = !state.canCreate;
    target.disabled = state.busy || state.locked;
    original.disabled = state.busy || !state.locked;
    target.checked = state.targetConfirmed; original.checked = state.originalConfirmed;
    el('lockStatus').textContent = state.locked ? '원본 확인 잠금: Notion에서 대상과 생성 여부를 확인한 뒤 아래 체크와 조회를 완료하세요.' : '원본 확인 잠금 없음';
    el('results').setAttribute('aria-busy', String(state.busy));
  }
  function show(outcome) {
    const item = doc.createElement('li');
    item.textContent = outcome.message + (outcome.httpStatus ? ' (HTTP ' + outcome.httpStatus + ')' : '');
    el('results').appendChild(item);
  }
  function applyInput() {
    const outcome = probe.configure({ token: token.value, dataSourceId: source.value });
    render(); return outcome;
  }
  token.addEventListener('input', applyInput); source.addEventListener('input', applyInput);
  target.addEventListener('change', () => { probe.confirmTarget(target.checked); render(); });
  original.addEventListener('change', () => { probe.confirmOriginal(original.checked); render(); });
  async function run(action) {
    const pending = action(); render();
    show(await pending); render();
  }
  readButton.addEventListener('click', () => { applyInput(); return run(probe.read); });
  authButton.addEventListener('click', () => run(probe.testInvalidAuth));
  createButton.addEventListener('click', () => { applyInput(); return run(probe.create); });
  render();
  return probe;
}

if (typeof document !== 'undefined') bootstrap();
