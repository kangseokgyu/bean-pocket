const DIRECTORY = 'bean-pocket-pwa-t07-retention-v1';
const FILE = 'demo-marker.schema-v1.json';
const PURPOSE = 'bean-pocket-t07-retention-probe';
const MARKER = /^T07-DEMO-[a-z0-9-]{1,48}$/i;
const MESSAGES = Object.freeze({
  written: '가짜 시험 문자열의 버전 JSON을 작성했습니다. 아래 지문을 기록해 이후 읽기 결과와 대조하세요.',
  'read-ok': '시험 파일의 버전과 형식을 확인했습니다. 아래 지문을 작성 기록과 대조하세요. 시험 문자열 원문은 표시하지 않습니다.',
  'fingerprint-unavailable': 'SHA-256 지문을 계산할 수 없습니다. 동일 시험 파일 여부를 판단하지 마세요. 새 파일은 작성하지 않습니다.',
  missing: '이 실행 환경에 시험 파일이 없습니다. 파일 없음만으로 삭제 원인이나 보관 수명을 판단할 수 없습니다.',
  unsupported: '이 환경에서는 앱 전용 파일 기능을 사용할 수 없습니다.',
  quota: '저장 공간 한도로 파일 작업을 완료하지 못했습니다.',
  permission: '파일 접근 권한 또는 보안 정책으로 작업을 완료하지 못했습니다.',
  corrupt: '시험 파일이 손상됐거나 지정한 버전·형식과 다릅니다. 덮어쓰기 전에 상태를 기록해 주세요.',
  'path-conflict': '전용 시험 경로에 다른 종류의 항목이 있습니다. 자동 변경하지 않습니다.',
  'storage-error': '파일 작업을 완료하지 못했습니다. 이 결과만으로 원인을 특정할 수 없습니다.',
  'invalid-marker': 'T07-DEMO- 뒤에 영문·숫자·하이픈 1~48자를 입력해 주세요. 실제 토큰과 연결 정보는 입력하지 마세요.',
  busy: '파일 작업을 처리 중입니다.',
});
const result = (code, details = {}) => Object.freeze({ code, message: MESSAGES[code], ...details });
function validPayload(data) {
  return data && typeof data === 'object' && !Array.isArray(data) &&
    Object.keys(data).sort().join(',') === 'marker,purpose,savedAt,schemaVersion' &&
    data.schemaVersion === 1 && data.purpose === PURPOSE && typeof data.marker === 'string' &&
    MARKER.test(data.marker) && typeof data.savedAt === 'string' && Number.isFinite(Date.parse(data.savedAt)) && new Date(data.savedAt).toISOString() === data.savedAt;
}
function classify(error, reading) {
  if (error?.name === 'NotFoundError' && reading) return result('missing');
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return result('permission');
  if (error?.name === 'QuotaExceededError') return result('quota');
  if (error?.name === 'NotSupportedError') return result('unsupported');
  if (error?.name === 'TypeMismatchError') return result('path-conflict');
  return result('storage-error');
}

export function createStorageProbe({ storage = globalThis.navigator?.storage, subtle = globalThis.crypto?.subtle } = {}) {
  let busy = false;
  async function calculateFingerprint(text) {
    if (typeof subtle?.digest !== 'function') return null;
    try {
      const bytes = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(text)));
      if (bytes.length !== 32) return null;
      return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch { return null; }
  }
  async function handle(creating) {
    const root = await storage.getDirectory();
    const directory = await root.getDirectoryHandle(DIRECTORY, { create: creating });
    return directory.getFileHandle(FILE, { create: creating });
  }
  async function read() {
    if (busy) return result('busy');
    if (typeof storage?.getDirectory !== 'function') return result('unsupported');
    busy = true;
    try {
      const file = await (await handle(false)).getFile();
      if (file.size > 4096) return result('corrupt');
      const text = await file.text();
      if (text.length > 4096) return result('corrupt');
      let data;
      try { data = JSON.parse(text); } catch { return result('corrupt'); }
      if (!validPayload(data)) return result('corrupt');
      const fingerprint = await calculateFingerprint(text);
      return fingerprint ? result('read-ok', { fingerprint }) : result('fingerprint-unavailable');
    } catch (error) { return classify(error, true); }
    finally { busy = false; }
  }
  async function write(marker) {
    if (busy) return result('busy');
    if (typeof marker !== 'string' || !MARKER.test(marker)) return result('invalid-marker');
    if (typeof storage?.getDirectory !== 'function') return result('unsupported');
    const payload = Object.freeze({ schemaVersion: 1, purpose: PURPOSE, marker, savedAt: new Date().toISOString() });
    const text = JSON.stringify(payload);
    busy = true;
    let writable;
    try {
      const fingerprint = await calculateFingerprint(text);
      if (!fingerprint) return result('fingerprint-unavailable');
      writable = await (await handle(true)).createWritable();
      await writable.write(text);
      await writable.close();
      return result('written', { fingerprint });
    } catch (error) {
      try { await writable?.abort(); } catch { /* Keep the original failure classification. */ }
      return classify(error, false);
    } finally { busy = false; }
  }
  return Object.freeze({ write, read, getState: () => Object.freeze({ busy }) });
}

export function bootstrap({ document: doc = globalThis.document, navigator: nav = globalThis.navigator,
  matchMedia = globalThis.matchMedia, storage = nav?.storage } = {}) {
  if (!doc) return null;
  const probe = createStorageProbe({ storage });
  const el = id => doc.getElementById(id);
  const writeButton = el('btnWrite'), readButton = el('btnRead'), marker = el('testData'), consent = el('confirmWrite');
  let media;
  try { media = matchMedia?.call(globalThis, '(display-mode: standalone)'); } catch { /* The runtime API may be unavailable. */ }
  const standalone = nav?.standalone === true || media?.matches === true;
  const modeKnown = typeof nav?.standalone === 'boolean' || typeof media?.matches === 'boolean';
  el('runtime').textContent = '실행 모드: ' + (standalone ? '홈 화면·standalone' : modeKnown ? '브라우저' : '확인 불가') +
    '\nuserAgent: ' + String(nav?.userAgent || '확인 불가').slice(0, 500) + '\n기종·OS는 사용자 기록과 화면 증거로 별도 확인해 주세요.';
  function render() {
    const busy = probe.getState().busy;
    readButton.disabled = marker.disabled = consent.disabled = busy;
    writeButton.disabled = busy || !consent.checked;
    el('results').setAttribute('aria-busy', String(busy));
  }
  async function run(action) {
    const pending = action(); render();
    const outcome = await pending;
    const item = doc.createElement('li');
    item.textContent = outcome.message + (outcome.fingerprint ? '\nSHA-256: ' + outcome.fingerprint : '');
    el('results').appendChild(item); render();
  }
  consent.addEventListener('change', render);
  writeButton.addEventListener('click', () => {
    if (!consent.checked || probe.getState().busy) return;
    const value = marker.value; consent.checked = false;
    return run(() => probe.write(value));
  });
  readButton.addEventListener('click', () => run(probe.read));
  render();
  return probe;
}

if (typeof document !== 'undefined') bootstrap();
