const SOURCE_KEYS = Object.freeze(['beans', 'bags', 'recipes', 'steps', 'records']);
const SOURCE_BY_OPERATION = Object.freeze({
  beans: ['beans'], bags: ['bags'], recipes: ['recipes', 'steps'], records: ['records'],
});
const STARTUP_LOCK_RETRY_DELAYS_MS = Object.freeze([100, 200, 300, 500, 700]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_MESSAGES = Object.freeze({
  unauthorized: 'Notion 토큰을 확인해 주세요.',
  forbidden: '데이터 소스 접근 권한을 확인해 주세요.',
  'not-found': '데이터 소스를 찾을 수 없습니다. 식별자를 확인해 주세요.',
  'rate-limited': '요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  'lock-busy': '다른 창이 기기 저장소를 확인 중입니다. 연결 정보를 입력하지 말고 다시 시도해 주세요.',
  'lock-unavailable': '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.',
  'stale-connection': '연결 설정이 바뀌었습니다. 다시 불러와 주세요.',
  'unresolved-connection': '연결 저장 상태를 확인해야 합니다.',
  'unresolved-operation': '앞선 저장 결과를 먼저 원본에서 확인해 주세요.',
  'connection-mismatch': '연결 파일과 작업 기록이 일치하지 않습니다. 복구가 필요합니다.',
  'connection-save-uncertain': '연결 저장 결과를 확인해야 합니다. 원본 연결 파일을 확인해 주세요.',
  'state-blocked': '저장 작업 상태를 확인할 수 없어 연결을 중단했습니다. 원본 journal을 확인해 주세요.',
  unknown: '저장 여부 확인이 필요합니다. 다시 제출하지 말고 원본을 확인해 주세요.',
  partial: '일부 항목만 저장되었습니다. 원본을 확인한 뒤 복구를 진행해 주세요.',
  'read-failed': '최신 목록을 불러오지 못했습니다. 연결과 권한을 확인해 주세요.',
  'stale-read': '조회 중 데이터가 바뀌었습니다. 다시 조회해 주세요.',
  'resolution-read-failed': '확인 중 최신 데이터를 읽지 못했습니다. 원본을 확인한 뒤 다시 시도해 주세요.',
  'invalid-resolution': '확인 입력을 처리하지 못했습니다. 원본 상태와 입력한 페이지를 확인해 주세요.',
  input: '입력 내용을 확인해 주세요.',
});

const messageFor = error => ({
  401: SAFE_MESSAGES.unauthorized,
  403: SAFE_MESSAGES.forbidden,
  404: SAFE_MESSAGES['not-found'],
  429: SAFE_MESSAGES['rate-limited'],
}[error?.httpStatus] ?? SAFE_MESSAGES[error?.code] ?? SAFE_MESSAGES[error?.writeState] ??
  '요청을 완료하지 못했습니다. 입력과 연결을 확인해 주세요.');

export function createAppController({
  view, state, file, makeClient, makeRepository, makeCommands,
  onStateChange = () => {}, uuid = () => crypto.randomUUID(),
}) {
  let activeConnection = null;
  let client = null;
  let repository = null;
  let commands = null;
  let data = null;
  let frozen = false;
  let pending = false;
  const dirtyKinds = new Set();
  let unresolvedOperations = [];

  function isDirty() { return dirtyKinds.size > 0; }

  function stateChanged() {
    view.setState?.({ dirty: isDirty(), pending, frozen, unresolved: unresolvedOperations.length > 0 });
    try { onStateChange(); } catch { /* Lifecycle notification must not change app behavior. */ }
  }

  function setDirty(value, kind = 'form') {
    if (frozen && value) return false;
    if (value) dirtyKinds.add(kind);
    else dirtyKinds.delete(kind);
    stateChanged();
    return true;
  }

  function showFailure(error, fallback = 'error') {
    view.showStatus?.({ type: fallback, message: messageFor(error) });
  }

  function setUnresolved(operations) {
    unresolvedOperations = operations.filter(operation => ['unknown', 'partial'].includes(operation.status));
    view.showUnresolved?.(unresolvedOperations.map(operation => ({
      kind: operation.kind,
      status: operation.status,
      knownPageCount: operation.createdPages.length,
      resolve: resolution => resolveOperation(operation.key, resolution),
    })));
    stateChanged();
  }

  async function readUnresolved() {
    try {
      const journal = await state.withWriteLock(context => context.readJournal());
      setUnresolved(journal?.operations ?? []);
    } catch {
      // Keep the last confirmed unresolved view. A damaged journal stays fail-closed in storage.
    }
  }

  function install(connection, nextClient, nextRepository, nextCommands) {
    activeConnection = connection;
    client = nextClient;
    repository = nextRepository;
    commands = nextCommands;
    view.showConnection?.({ connected: true });
  }

  async function readLatest() {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (!repository) throw Object.freeze({ code: 'read-failed' });
    try {
      const next = await repository.readAll();
      data = next;
      view.renderData?.(next);
      view.showStatus?.({ type: 'ready', message: '최신 목록을 불러왔습니다.' });
      return next;
    } catch (error) {
      showFailure(error, 'read-error');
      throw error;
    }
  }

  async function refresh() {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (pending) throw Object.freeze({ code: 'lock-unavailable' });
    pending = true;
    stateChanged();
    try { return await readLatest(); }
    finally { pending = false; stateChanged(); }
  }

  function makeStack(connection) {
    const nextClient = makeClient(connection);
    const nextRepository = makeRepository(nextClient);
    const nextCommands = makeCommands({ client: nextClient, repository: nextRepository, submissionState: state });
    return { nextClient, nextRepository, nextCommands };
  }

  async function withStartupLock(action) {
    let retry = 0;
    while (true) {
      let callbackEntered = false;
      try {
        return await state.withWriteLock(async context => {
          callbackEntered = true;
          return action(context);
        });
      } catch (error) {
        if (callbackEntered || error?.code !== 'lock-busy' || retry >= STARTUP_LOCK_RETRY_DELAYS_MS.length) {
          throw error;
        }
        const delay = STARTUP_LOCK_RETRY_DELAYS_MS[retry++];
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async function initialize() {
    if (pending) throw Object.freeze({ code: 'lock-unavailable' });
    pending = true;
    stateChanged();
    view.showConnection?.({ connected: !!activeConnection, checkingInitialization: true });
    view.showStatus?.({ type: 'startup-checking', message: '저장된 연결 확인 중' });
    try {
      const loaded = await withStartupLock(async context => {
        const connection = await file.readConnection();
        const inspection = await context.inspect();
        const journal = await context.readJournal();
        setUnresolved(journal?.operations ?? []);
        const hasUnresolvedOperations = journal?.operations.some(operation => ['unknown', 'partial'].includes(operation.status));
        if (inspection.blocked && !journal?.connectionGuard && !hasUnresolvedOperations) {
          throw Object.freeze({ code: 'state-blocked' });
        }
        if (!connection) return null;
        if (!inspection.initialized || journal?.connectionGuard ||
            journal?.activeConnectionRevision !== connection.revision) {
          throw Object.freeze({ code: journal?.connectionGuard ? 'unresolved-connection' : 'connection-mismatch' });
        }
        const stack = makeStack(connection);
        await stack.nextClient.verify();
        return { connection, ...stack };
      });
      if (!loaded) {
        view.showConnection?.({ connected: false });
        view.showStatus?.({ type: 'disconnected', message: 'Notion 연결 정보를 입력해 주세요.' });
        return null;
      }
      install(loaded.connection, loaded.nextClient, loaded.nextRepository, loaded.nextCommands);
      try { await readLatest(); } catch { /* A verified connection remains usable when its first read fails. */ }
      return true;
    } catch (error) {
      if (error?.code === 'lock-busy') {
        view.showStatus?.({ type: 'startup-busy', message: SAFE_MESSAGES['lock-busy'] });
        view.showConnection?.({ connected: !!activeConnection, retryInitialization: true });
        return false;
      }
      showFailure(error, 'connection-error');
      const needsRecovery = ['connection-mismatch', 'unresolved-connection'].includes(error?.code);
      if (needsRecovery || error?.code === 'state-blocked') {
        activeConnection = null;
        client = repository = commands = null;
      }
      view.showConnection?.({ connected: !!activeConnection, needsRecovery });
      return false;
    } finally {
      pending = false;
      stateChanged();
    }
  }

  async function connect(input) {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (pending) throw Object.freeze({ code: 'lock-unavailable' });
    pending = true;
    stateChanged();
    view.showConnection?.({ connected: !!activeConnection });
    view.showStatus?.({ type: 'checking', message: 'Notion 연결을 확인하고 있습니다.' });
    try {
      const candidate = {
        schemaVersion: 1,
        revision: uuid(),
        token: input.token,
        dataSources: Object.fromEntries(SOURCE_KEYS.map(key => [key, input.dataSources[key]])),
      };
      const stack = makeStack(candidate);
      await state.withWriteLock(async context => {
        const inspection = await context.inspect();
        const journal = await context.readJournal();
        if (journal?.connectionGuard) throw Object.freeze({ code: 'unresolved-connection' });
        if (journal?.operations.some(operation => ['unknown', 'partial'].includes(operation.status))) {
          throw Object.freeze({ code: 'unresolved-operation' });
        }
        if (inspection.blocked) throw Object.freeze({ code: 'unresolved-connection' });
        await stack.nextClient.verify();
        await context.beginConnectionChange(candidate);
        await context.commitConnectionChange();
      });
      install(candidate, stack.nextClient, stack.nextRepository, stack.nextCommands);
      view.clearSecret?.();
      dirtyKinds.delete('connection');
      view.showStatus?.({ type: 'connected', message: '연결을 확인하고 저장했습니다.' });
      try { await readLatest(); } catch { /* Saving the connection is independent of its first data read. */ }
      return true;
    } catch (error) {
      showFailure(error, 'connection-error');
      const uncertain = ['connection-save-uncertain', 'connection-mismatch'].includes(error?.code);
      if (uncertain) {
        activeConnection = null;
        client = repository = commands = null;
      }
      view.showConnection?.({
        connected: !!activeConnection,
        needsRecovery: uncertain || error?.code === 'unresolved-connection',
      });
      throw error;
    } finally {
      pending = false;
      stateChanged();
    }
  }

  async function confirmCurrent(originalConfirmed) {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (pending || !originalConfirmed) throw Object.freeze({ code: 'invalid-resolution' });
    pending = true;
    stateChanged();
    try {
      await state.withWriteLock(async context => context.confirmConnection({
        originalConfirmed: true,
        decision: 'use-current',
        async freshRead({ connectionRevision }) {
          const current = await file.readConnection();
          if (!current || current.revision !== connectionRevision) throw Object.freeze({ code: 'connection-mismatch' });
          const stack = makeStack(current);
          await stack.nextClient.verify();
          await stack.nextRepository.readAll();
          return {
            connectionRevision,
            targetFingerprint: await fingerprint(current.dataSources),
            outcome: 'use-current',
          };
        },
      }));
      pending = false;
      stateChanged();
      return await initialize();
    } finally {
      pending = false;
      stateChanged();
    }
  }

  async function resolveOperation(operationKey, resolution = {}) {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (pending) throw Object.freeze({ code: 'lock-unavailable' });
    if (!resolution.originalConfirmed) throw Object.freeze({ code: 'invalid-resolution' });
    pending = true;
    stateChanged();
    try {
      await state.withWriteLock(async context => context.confirmResolution(operationKey, {
        originalConfirmed: true,
        decision: resolution.decision,
        async freshRead(operation) {
          const pageIds = parseResolutionPageIds(resolution.pageIds);
          if (operation.createdPages.length && (pageIds.length || resolution.decision === 'not-saved')) {
            throw Object.freeze({ code: 'invalid-resolution' });
          }
          const current = await file.readConnection();
          if (!current || current.revision !== operation.connectionRevision || !client || !repository) {
            throw Object.freeze({ code: 'stale-connection' });
          }
          const freshStack = makeStack(current);
          await freshStack.nextClient.verify();
          const freshData = await freshStack.nextRepository.readAll();

          if (resolution.decision === 'not-saved' && pageIds.length) throw Object.freeze({ code: 'invalid-resolution' });
          const pageRefs = [...operation.createdPages.map(page => ({ kind: page.kind, id: page.id })),
            ...pageIds.map(id => ({ kind: null, id }))];
          const confirmed = [];
          const seen = new Set();
          const allowed = SOURCE_BY_OPERATION[operation.kind];
          for (const reference of pageRefs) {
            if (seen.has(reference.id)) continue;
            seen.add(reference.id);
            const page = await freshStack.nextClient.getPage(reference.id);
            const kind = SOURCE_KEYS.find(source => current.dataSources[source] === page.parent?.data_source_id);
            if (!kind || !allowed?.includes(kind) || (reference.kind && reference.kind !== kind)) {
              throw Object.freeze({ code: 'invalid-resolution' });
            }
            const archived = page.archived === true || page.in_trash === true;
            confirmed.push({ kind, id: reference.id, archiveState: archived ? 'archived' : 'active' });
          }

          if (resolution.decision === 'saved' && (!confirmed.length || confirmed.some(page => page.archiveState !== 'active'))) {
            throw Object.freeze({ code: 'invalid-resolution' });
          }
          if (resolution.decision === 'saved' && !isVisibleInFreshRead(operation.kind, confirmed, freshData)) {
            throw Object.freeze({ code: 'invalid-resolution' });
          }
          if (resolution.decision === 'cancelled' && confirmed.some(page => page.archiveState !== 'archived')) {
            throw Object.freeze({ code: 'invalid-resolution' });
          }
          if (!['saved', 'not-saved', 'cancelled'].includes(resolution.decision)) {
            throw Object.freeze({ code: 'invalid-resolution' });
          }
          return {
            connectionRevision: operation.connectionRevision,
            targetFingerprint: operation.targetFingerprint,
            outcome: resolution.decision,
            createdPages: confirmed,
          };
        },
      }));
      await readUnresolved();
      view.showStatus?.({ type: 'resolved', message: '확인 결과를 저장했습니다. 다시 제출하기 전에 최신 목록을 확인해 주세요.' });
      if (activeConnection) {
        try { await readLatest(); } catch { /* Resolution is durable even when the final refresh fails. */ }
      }
      return true;
    } catch (error) {
      showFailure(error, 'resolution-error');
      throw error;
    } finally {
      pending = false;
      stateChanged();
    }
  }

  async function submit(kind, payload) {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (pending || !commands) throw Object.freeze({ code: 'lock-unavailable' });
    if (unresolvedOperations.length) throw Object.freeze({ code: 'unresolved-operation' });
    pending = true;
    stateChanged();
    view.showStatus?.({ type: 'saving', message: '저장 중입니다.' });
    try {
      const prepare = {
          beans: 'prepareBean', bags: 'prepareBag', recipes: 'prepareRecipe', records: 'prepareRecord',
        }[kind];
      if (kind !== 'copy' && !prepare) throw Object.freeze({ code: 'input' });
      const draft = kind === 'copy'
        ? await commands.prepareCopy(payload.recipeId, payload.changes)
        : await commands[prepare](payload);
      const result = await commands.execute(draft);
      if (result.status === 'succeeded') {
        dirtyKinds.delete(kind === 'copy' ? 'recipes' : kind);
        view.clearForm?.(kind === 'copy' ? 'recipes' : kind);
        view.clearDraft?.(kind === 'copy' ? 'recipes' : kind);
        stateChanged();
        view.showStatus?.({ type: 'saved', message: '저장했습니다. 최신 목록을 다시 불러옵니다.' });
        try { await readLatest(); }
        catch { view.showStatus?.({ type: 'saved-read-error', message: '저장은 성공했지만 최신 목록을 불러오지 못했습니다. 다시 제출하지 마세요.' }); }
        return result;
      }
      if (['unknown', 'partial'].includes(result.status)) await readUnresolved();
      showFailure({ code: result.status }, result.status);
      return result;
    } catch (error) {
      if (error?.writeState === 'unknown' || error?.writeState === 'partial') await readUnresolved();
      showFailure(error, error?.writeState === 'unknown' ? 'unknown' : 'validation-error');
      throw error;
    } finally {
      pending = false;
      stateChanged();
    }
  }

  function setFrozen(value, details = {}) {
    if (value && (isDirty() || pending)) return false;
    frozen = !!value;
    view.setFrozen?.(frozen, details);
    stateChanged();
    return true;
  }

  function getState() {
    return Object.freeze({ dirty: isDirty(), pending, frozen, connected: !!activeConnection,
      unresolved: unresolvedOperations.length > 0 });
  }

  function bind() {
    view.bind?.({ initialize, connect, refresh, submit, confirmCurrent, resolveOperation, setDirty, setFrozen, getState });
  }

  return Object.freeze({
    initialize, connect, confirmCurrent, resolveOperation, refresh, submit, setDirty, setFrozen, getState, bind,
  });
}

function parseResolutionPageIds(value) {
  if (value === undefined || value === null || value === '') return [];
  const parts = Array.isArray(value) ? value : String(value).split(/[\s,;]+/).filter(Boolean);
  if (!parts.every(part => typeof part === 'string' && UUID.test(part.trim()))) {
    throw Object.freeze({ code: 'invalid-resolution' });
  }
  const normalized = parts.map(part => part.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) throw Object.freeze({ code: 'invalid-resolution' });
  return normalized;
}

function isVisibleInFreshRead(kind, confirmed, freshData) {
  const hasEntity = resource => Array.isArray(freshData?.[resource]) &&
    confirmed.some(page => page.kind === resource && freshData[resource].some(row => row?.id === page.id));

  if (kind !== 'recipes') return hasEntity(kind);
  if (!Array.isArray(freshData?.recipes)) return false;

  return freshData.recipes.some(recipe => {
    const parent = confirmed.find(page => page.kind === 'recipes' && page.id === recipe?.id);
    if (!parent || !Array.isArray(recipe.steps)) return false;
    const stepIds = new Set(recipe.steps.map(step => step?.id));
    return confirmed.every(page => page.kind === 'recipes'
      ? page.id === parent.id
      : page.kind === 'steps' && stepIds.has(page.id));
  });
}

async function fingerprint(dataSources) {
  const canonical = Object.fromEntries(Object.keys(dataSources).sort().map(key => [key, dataSources[key]]));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(canonical)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
