import { invalidateReadCaches, invalidateRecordList, readCache, routeCacheKey, saveCache } from './controller/cache.mjs';
import { fetchScreen, mergeScreenData, reusableBrewSelection, routeLocation, routeSchemas, SCREEN_PAGE_SIZE } from './controller/loader.mjs';
import { cachedFilterOptions, loadSearchOptions as loadOptionSearch, readOptionPage } from './controller/search.mjs';
import { emptyRecordInsights, hasRecordInsightBean, includeComparisonPair, mergeRecordInsightsPage,
  projectRecordInsights } from './controller/record-insights.mjs';
import { recipeEditState, recipeFingerprint, recipePageValues, stepPageValues } from '../recipe-edit.mjs';
import { decodePage } from '../data/notion-properties.mjs';

const SOURCE_KEYS = Object.freeze(['beans', 'recipes', 'steps', 'records']);
const SOURCE_BY_OPERATION = Object.freeze({
  'delete-bean': ['beans'], 'delete-recipe': ['recipes'], 'delete-record': ['records'],
  beans: ['beans'], recipes: ['recipes', 'steps'], records: ['records'],
});
const DELETE_TARGET_BY_OPERATION = Object.freeze({
  'delete-bean': 'beans', 'delete-recipe': 'recipes', 'delete-record': 'records',
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
  'schema-unsupported': '새 추출 기록을 저장하려면 Notion records 데이터베이스에 ‘원두’ 관계가 필요합니다. 기존 기록 조회는 계속할 수 있습니다.',
  'favorite-unsupported': '즐겨찾기를 사용하려면 Notion 원두·레시피 데이터베이스에 즐겨찾기 checkbox 속성을 추가하고 연결을 다시 확인해 주세요.',
  'recipe-guide-unsupported': '추출 가이드를 저장하려면 Notion recipes 데이터베이스에 rich_text 속성을 추가해 주세요. 기존 레시피 조회는 계속할 수 있습니다.',
  'micron-range-unsupported': '범위 분쇄 입자를 저장하려면 Notion recipes 데이터베이스에 ‘분쇄 입자 범위(μm)’ rich_text 속성을 추가하고 연결을 다시 확인해 주세요.',
  'best-record-unsupported': '베스트 추출 기능을 쓰려면 Notion beans 데이터베이스에 records를 대상으로 하는 ‘베스트 추출’ 관계를 추가해 주세요. 일반 추출 기록 저장은 계속할 수 있습니다.',
  'stale-read': '조회 중 데이터가 바뀌었습니다. 다시 조회해 주세요.',
  'resolution-read-failed': '확인 중 최신 데이터를 읽지 못했습니다. 원본을 확인한 뒤 다시 시도해 주세요.',
  'invalid-resolution': '확인 입력을 처리하지 못했습니다. 원본 상태와 입력한 페이지를 확인해 주세요.',
  'edit-state-mixed': '레시피의 일부만 수정되었습니다. Notion에서 레시피와 모든 단계를 원하는 내용으로 맞춘 뒤 다시 확인해 주세요.',
  'edit-verification-failed': '레시피 수정 결과를 확인하지 못했습니다. 다시 제출하지 말고 Notion 원본에서 레시피와 단계를 확인해 주세요.',
  'edit-unavailable': '레시피 수정을 사용할 수 없습니다. 연결을 다시 확인해 주세요.',
  input: '입력 내용을 확인해 주세요.',
  'delete-failed': '삭제하지 못했습니다. 연결된 추출 기록이나 확인할 수 없는 관계가 있는지 확인하고 목록을 새로고침해 주세요.',
  'delete-in-use': '이 레시피를 사용하는 추출 기록이 있습니다. 먼저 해당 추출 기록을 삭제한 뒤 다시 시도해 주세요.',
  'delete-dependency-unknown': '연결 관계나 제외된 기록을 확인할 수 없어 안전을 위해 삭제를 막았습니다. 최신 목록을 새로고침해 주세요.',
});

function matchesMicronAssertion(recipe, assertion, decision) {
  if (!assertion) return true;
  const expected = assertion[decision === 'saved' ? 'after' : 'before'];
  const observed = recipe.micronStorage ?? {
    number: typeof recipe.microns === 'number' ? recipe.microns : null,
    range: typeof recipe.microns === 'string' ? recipe.microns : '',
  };
  return observed.number === expected.number && observed.range === expected.range;
}

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
  let dataRevision = null;
  let routeGeneration = 0;
  let routeReadController = null;
  let recordFilters = { beanId: '', recipeId: '' };
  let recordInsights = emptyRecordInsights();
  let insightReadGeneration = 0;
  const screenCache = new Map();
  const optionCache = new Map();
  const optionSearchGeneration = new Map();
  let frozen = false;
  let pending = false;
  const dirtyKinds = new Set();
  let unresolvedOperations = [];

  function hasDirtyWork() { return dirtyKinds.size > 0; }

  function stateChanged() {
    view.setState?.({ dirty: hasDirtyWork(), pending, frozen, unresolved: unresolvedOperations.length > 0,
      connectionRevision: activeConnection?.revision ?? null });
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
      targetKind: operation.deleteTarget?.kind ?? operation.favoriteTarget?.kind,
      favorite: operation.favoriteTarget?.favorite,
      editTarget: operation.editTarget ? { recipeId: operation.editTarget.recipeId,
        createdStepCount: operation.editTarget.pages.filter(page => page.action === 'create').length } : null,
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
    routeReadController?.abort();
    routeGeneration += 1;
    screenCache.clear();
    optionCache.clear();
    optionSearchGeneration.clear();
    resetRecordInsights(connection.revision, false);
    recordFilters = { beanId: '', recipeId: '' };
    dataRevision = null;
    activeConnection = connection;
    client = nextClient;
    repository = nextRepository;
    commands = nextCommands;
    view.clearSearchOptions?.();
    view.showConnection?.({ connected: true });
    stateChanged();
  }

  function dropConnectionData() {
    routeReadController?.abort();
    routeReadController = null;
    routeGeneration += 1;
    screenCache.clear();
    optionCache.clear();
    optionSearchGeneration.clear();
    resetRecordInsights(null, false);
    recordFilters = { beanId: '', recipeId: '' };
    data = null;
    dataRevision = null;
    stateChanged();
    view.clearSearchOptions?.();
    view.renderData?.({ beans: [], recipes: [], records: [], excluded: {},
      screen: { route: currentRoute(), nextCursor: null, hasMore: false, complete: true } });
  }

  function resetRecordInsights(revision = activeConnection?.revision ?? null, preserveSelection = true) {
    const selectedBeanId = preserveSelection ? recordInsights.selectedBeanId : '';
    recordInsights = emptyRecordInsights(revision, selectedBeanId);
    insightReadGeneration += 1;
  }

  function currentRoute() {
    const route = view.currentRoute?.();
    return typeof route === 'string' && route.startsWith('/') ? route : '/home';
  }

  function setRouteReadState(generation, status) {
    if (generation !== routeGeneration) return false;
    view.setRouteReadState?.(status);
    return true;
  }

  async function loadRoute(route = currentRoute(), { cursor = null, append = false, force = false, skipVerify = false,
    notifyCompletion = false, suppressCompletion = false } = {}) {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (!repository || !client) return null;
    routeReadController?.abort();
    insightReadGeneration += 1;
    if (recordInsights.loading) {
      recordInsights = { ...recordInsights, loading: false,
        status: recordInsights.status === 'loading' ? 'idle' : recordInsights.status };
    }
    const controller = new AbortController();
    routeReadController = controller;
    const generation = ++routeGeneration;
    const key = routeCacheKey(activeConnection?.revision, route, recordFilters, cursor);
    const isFirstPage = cursor == null;
    const reusedBrewSelection = isFirstPage ? reusableBrewSelection(route, data, dataRevision, activeConnection?.revision) : null;
    const isRouteTransition = isFirstPage && !append && currentRoute() === route && data?.screen?.route !== route;
    const announceLoad = isRouteTransition || notifyCompletion;
    if (isRouteTransition) setRouteReadState(generation, 'loading');
    else if (isFirstPage && !append && currentRoute() === route && data?.screen?.route === route) {
      setRouteReadState(generation, 'ready');
    }
    if (announceLoad) view.showStatus?.({ type: 'loading', message: '화면을 불러오는 중…' });
    try {
      if (!skipVerify) {
        const kinds = routeSchemas(route);
        if (kinds.length && !reusedBrewSelection) await client.verify(kinds, { signal: controller.signal });
      }
      if (generation !== routeGeneration || controller.signal.aborted) return null;
      const cached = !force && isFirstPage && !reusedBrewSelection ? readCache(screenCache, key) : null;
      const previous = append ? data : null;
      let fetched = cached ?? await fetchScreen(repository, route, {
        cursor, signal: controller.signal, previousData: data, reusedBrewSelection,
        readFormOptions(kind, signal) {
          const revision = activeConnection?.revision;
          const requestRepository = repository;
          return readOptionPage(requestRepository, optionCache, revision, { target: 'form', kind, query: '', cursor: null, signal },
            () => revision === activeConnection?.revision && requestRepository === repository);
        },
        getRecordFilters: () => recordFilters,
        readComparisonPair: (records, route, signal) => includeComparisonPair(repository, records, route, signal),
        readCachedFilterOptions: (kind, rows, selectedId) =>
          cachedFilterOptions(optionCache, activeConnection?.revision ?? 'disconnected', kind, rows, selectedId),
      });
      if (generation !== routeGeneration || controller.signal.aborted) return null;
      if (routeLocation(route).path === '/records') {
        if (recordInsights.revision !== activeConnection?.revision) resetRecordInsights(activeConnection?.revision);
        if (fetched.comparisonBeanId) recordInsights.selectedBeanId = fetched.comparisonBeanId;
        if (recordInsights.status === 'idle') {
          const selectedFilters = fetched.screen?.filters ?? recordFilters;
          if (cursor == null && !selectedFilters.beanId && !selectedFilters.recipeId) {
            recordInsights = mergeRecordInsightsPage(recordInsights, { items: fetched.records, nextCursor: fetched.screen?.nextCursor,
              hasMore: fetched.screen?.hasMore, complete: fetched.screen?.complete });
          } else {
            recordInsights = { ...recordInsights, status: 'loading', loading: false, error: '' };
          }
        } else if (recordInsights.status === 'ready') {
          const params = routeLocation(route).params;
          const pairIds = [params.get('compareSourceRecordId'), params.get('compareRecordId')].filter(Boolean);
          if (pairIds.length === 2) {
            const pair = fetched.records.filter(record => pairIds.includes(record.id));
            if (pair.length === 2) recordInsights = mergeRecordInsightsPage(recordInsights, { items: pair, nextCursor: recordInsights.nextCursor,
              hasMore: recordInsights.hasMore, complete: recordInsights.complete }, true);
          }
        }
        fetched = projectRecordInsights(fetched, recordInsights);
        recordInsights.selectedBeanId = fetched.recordInsights.selectedBeanId;
      }
      fetched.favoriteSupport = { beans: client.beanFavoriteSupported !== false, recipes: client.recipeFavoriteSupported !== false };
      fetched.screen = { ...fetched.screen, append, connectionRevision: activeConnection?.revision ?? null };
      data = mergeScreenData(previous, fetched);
      dataRevision = activeConnection?.revision ?? null;
      saveCache(screenCache, key, data);
      view.renderData?.(data);
      if (isRouteTransition) setRouteReadState(generation, 'ready');
      if (suppressCompletion) {
        if (typeof view.clearStatus === 'function') view.clearStatus();
        else view.showStatus?.({ type: 'ready', message: '' });
      } else {
        view.showStatus?.(announceLoad
          ? { type: 'loaded', message: '화면을 불러왔습니다.' }
          : { type: 'ready', message: '' });
      }
      startDeferredReads(route, generation, key, controller.signal);
      return data;
    } catch (error) {
      if (generation !== routeGeneration || controller.signal.aborted) return null;
      if (isRouteTransition) setRouteReadState(generation, error?.code === 'read-cancelled' ? 'cancelled' : 'error');
      if (error?.code === 'read-cancelled') {
        if (announceLoad) view.showStatus?.({ type: 'cancelled', message: '화면 불러오기를 취소했습니다.' });
        return null;
      }
      showFailure(error, 'read-error');
      throw error;
    }
  }

  function startDeferredReads(route, generation, key, signal) {
    const update = patch => {
      if (generation !== routeGeneration || signal.aborted || currentRoute() !== route || !data) return;
      data = { ...data, ...patch };
      saveCache(screenCache, key, data);
      view.renderData?.(data);
    };
    const batches = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
      items.slice(index * size, (index + 1) * size));
    if (routeLocation(route).path === '/records' && recordInsights.status === 'loading' && !recordInsights.loading) {
      void loadInitialRecordInsights(route, generation, key, signal);
    }
    if (data?.records?.some(record => record.beanNameStatus === 'loading' || record.recipeNameStatus === 'loading') &&
        typeof repository.hydrateRecordParents === 'function') {
      void (async () => {
        let pendingRecords = data.records.filter(record =>
          record.beanNameStatus === 'loading' || record.recipeNameStatus === 'loading');
        while (pendingRecords.length && !signal.aborted) {
          const result = await repository.hydrateRecordParents(pendingRecords, { signal });
          const beanStatuses = result.beanStatuses ?? {};
          const recipeStatuses = result.recipeStatuses ?? {};
          const snapshotName = (record, kind) => {
            const snapshot = record.snapshot;
            if (snapshot?.version >= 2) return kind === 'beans' ? snapshot.bean?.name : snapshot.recipe?.name;
            return kind === 'recipes' ? snapshot?.name : '';
          };
          const visibleRecords = (data?.records ?? []).map(record => {
            const beanStatus = beanStatuses[record.beanId];
            const recipeStatus = recipeStatuses[record.recipeId];
            const beanNameStatus = beanStatus === 'live' ? 'live'
              : beanStatus === 'snapshot' ? snapshotName(record, 'beans') ? 'snapshot' : 'unavailable'
                : beanStatus === 'error' ? 'error' : record.beanNameStatus;
            const recipeNameStatus = recipeStatus === 'live' ? 'live'
              : recipeStatus === 'snapshot' ? snapshotName(record, 'recipes') ? 'snapshot' : 'unavailable'
                : recipeStatus === 'error' ? 'error' : record.recipeNameStatus;
            return { ...record, beanNameStatus, recipeNameStatus,
              beanResolution: beanStatus === 'snapshot' && record.beanId
                ? 'needs-confirmation' : record.beanResolution };
          });
          const mergeKnown = (current, additions) => {
            const byId = new Map((additions ?? []).map(item => [item.id, item]));
            for (const item of current ?? []) byId.set(item.id, item);
            return [...byId.values()];
          };
          update({ beans: mergeKnown(data?.beans, result.beans),
            recipes: mergeKnown(data?.recipes, result.recipes), records: visibleRecords });
          const remainingBeans = new Set(result.remainingBeanIds ?? []);
          const remainingRecipes = new Set(result.remainingRecipeIds ?? []);
          pendingRecords = (data?.records ?? []).filter(record =>
            (record.beanNameStatus === 'loading' && remainingBeans.has(record.beanId)) ||
            (record.recipeNameStatus === 'loading' && remainingRecipes.has(record.recipeId)));
        }
      })().catch(() => {
        if (signal.aborted) return;
        const unresolved = new Set(data?.records?.filter(record =>
          record.beanNameStatus === 'loading' || record.recipeNameStatus === 'loading').map(record => record.id));
        update({ records: (data?.records ?? []).map(record => unresolved.has(record.id) ? {
          ...record,
          beanNameStatus: record.beanNameStatus === 'loading' ? 'error' : record.beanNameStatus,
          recipeNameStatus: record.recipeNameStatus === 'loading' ? 'error' : record.recipeNameStatus,
        } : record) });
      });
    }
    const markCounts = (ids, status, counts = {}) => {
      const selected = new Set(ids);
      update({ beans: (data?.beans ?? []).map(bean => selected.has(bean.id) ? { ...bean, recordCount: {
        status, count: status === 'ready' ? counts[bean.id] ?? null : null,
      } } : bean) });
    };
    const path = routeLocation(route).path;
    if (path === '/beans' && data?.beans?.some(bean => bean.recordCount?.status === 'loading') &&
        typeof repository.getBeanRecordCounts === 'function') {
      const ids = data.beans.filter(bean => bean.recordCount?.status === 'loading').map(bean => bean.id);
      void (async () => {
        try { await client.verify(['records'], { signal }); }
        catch {
          if (!signal.aborted) markCounts(ids, 'error');
          return;
        }
        for (const batch of batches(ids, 20)) {
          try {
            const result = await repository.getBeanRecordCounts(batch, { signal });
            markCounts(batch, result.status === 'ready' ? 'ready' : 'error', result.counts);
          } catch {
            if (signal.aborted) return;
            markCounts(batch, 'error');
          }
        }
      })();
    }
    if (['/recipes', '/recipes/new', '/brew/recipe'].includes(path) && data?.recipes?.some(recipe => recipe.validationStatus === 'checking') &&
        typeof repository.validateRecipeSummaries === 'function') {
      const ids = data.recipes.filter(recipe => recipe.validationStatus === 'checking').map(recipe => recipe.id);
      void (async () => {
        for (const batch of batches(ids, 20)) {
          try {
            const result = await repository.validateRecipeSummaries(batch, { signal });
            const selected = new Set(batch);
            const validated = new Map(result.items.map(item => [item.id, item]));
            update({ recipes: (data?.recipes ?? []).map(summary => {
              if (!selected.has(summary.id)) return summary;
              const item = validated.get(summary.id);
              return item?.status === 'ready' ? { ...summary, ...item.recipe, stats: summary.stats }
                : { ...summary, validationStatus: 'error' };
            }) });
          } catch {
            if (signal.aborted) return;
            const selected = new Set(batch);
            update({ recipes: (data?.recipes ?? []).map(recipe => selected.has(recipe.id)
              ? { ...recipe, validationStatus: 'error' } : recipe) });
          }
        }
      })();
    }
    if (route.startsWith('/recipes/') && route !== '/recipes/new' && typeof repository.getRecipeStats === 'function') {
      const recipe = data?.recipes?.find(item => item.id === route.split('/')[2]);
      if (recipe?.stats?.status === 'loading') {
        void repository.getRecipeStats(recipe.id, { signal, validatedRecipe: recipe }).then(stats => {
          update({ recipes: data.recipes.map(item => item.id === recipe.id ? { ...item, stats } : item) });
        }).catch(() => update({ recipes: data.recipes.map(item => item.id === recipe.id
          ? { ...item, stats: { status: 'error', count: null, average: null } } : item) }));
      }
    }
  }

  async function loadInitialRecordInsights(route, generation, key, signal) {
    if (recordInsights.status !== 'loading' || recordInsights.loading) return;
    const request = ++insightReadGeneration;
    const revision = activeConnection?.revision;
    recordInsights = { ...recordInsights, loading: true };
    publishRecordInsights(key);
    try {
      const page = await repository.listRecords({ cursor: null, limit: SCREEN_PAGE_SIZE, signal });
      if (request !== insightReadGeneration || generation !== routeGeneration || signal.aborted ||
          revision !== activeConnection?.revision || currentRoute() !== route) return;
      const comparison = await includeComparisonPair(repository, page.items, route, signal);
      if (request !== insightReadGeneration || generation !== routeGeneration || signal.aborted ||
          revision !== activeConnection?.revision || currentRoute() !== route) return;
      if (comparison.beanId && !recordInsights.selectedBeanId) recordInsights.selectedBeanId = comparison.beanId;
      recordInsights = mergeRecordInsightsPage(recordInsights, { ...page, items: comparison.items });
      publishRecordInsights(key);
    } catch {
      if (request !== insightReadGeneration || generation !== routeGeneration || signal.aborted ||
          revision !== activeConnection?.revision || currentRoute() !== route) return;
      recordInsights = { ...recordInsights, status: 'error', loading: false,
        error: '원두 인사이트 기록을 불러오지 못했습니다. 다시 시도해 주세요.' };
      publishRecordInsights(key);
    }
  }

  function publishRecordInsights(key = routeCacheKey(activeConnection?.revision, currentRoute(), recordFilters)) {
    if (!data || routeLocation(data.screen?.route).path !== '/records') return;
    data = projectRecordInsights(data, recordInsights);
    recordInsights.selectedBeanId = data.recordInsights.selectedBeanId;
    saveCache(screenCache, key, data);
    view.renderData?.(data);
  }

  async function loadMore() {
    if (!data?.screen?.hasMore || !data.screen.nextCursor) return null;
    return loadRoute(currentRoute(), { cursor: data.screen.nextCursor, append: true });
  }

  async function loadMoreInsights() {
    if (!repository || routeLocation(currentRoute()).path !== '/records' || recordInsights.loading) return null;
    const retryFirstPage = recordInsights.status === 'error' && recordInsights.records.length === 0;
    if (!retryFirstPage && recordInsights.status !== 'ready') return null;
    if (!retryFirstPage && !recordInsights.hasMore && !recordInsights.error) return null;
    const cursor = retryFirstPage ? null : recordInsights.nextCursor;
    const route = currentRoute();
    const generation = routeGeneration;
    const revision = activeConnection?.revision;
    const signal = routeReadController?.signal;
    const key = routeCacheKey(activeConnection?.revision, route, recordFilters);
    const request = ++insightReadGeneration;
    const append = !retryFirstPage && recordInsights.records.length > 0;
    recordInsights = { ...recordInsights, loading: true, status: append ? 'ready' : 'loading', error: '' };
    publishRecordInsights(key);
    try {
      const page = await repository.listRecords({ cursor, limit: SCREEN_PAGE_SIZE, signal });
      if (request !== insightReadGeneration || generation !== routeGeneration || signal?.aborted ||
          revision !== activeConnection?.revision || routeLocation(currentRoute()).path !== '/records') return null;
      const comparison = await includeComparisonPair(repository, page.items, route, signal);
      if (request !== insightReadGeneration || generation !== routeGeneration || signal?.aborted ||
          revision !== activeConnection?.revision || routeLocation(currentRoute()).path !== '/records') return null;
      if (comparison.beanId && !recordInsights.selectedBeanId) recordInsights.selectedBeanId = comparison.beanId;
      recordInsights = mergeRecordInsightsPage(recordInsights, { ...page, items: comparison.items }, append);
      publishRecordInsights(key);
      return data;
    } catch {
      if (request !== insightReadGeneration || generation !== routeGeneration || signal?.aborted ||
          revision !== activeConnection?.revision || routeLocation(currentRoute()).path !== '/records') return null;
      recordInsights = { ...recordInsights, status: append ? 'ready' : 'error', loading: false,
        error: '인사이트 기록을 불러오지 못했습니다. 다시 시도해 주세요.' };
      publishRecordInsights(key);
      return null;
    }
  }

  function setRecordInsightsBean(beanId) {
    if (!data || routeLocation(currentRoute()).path !== '/records') return null;
    if (!hasRecordInsightBean(recordInsights, data, beanId)) return null;
    recordInsights = { ...recordInsights, selectedBeanId: beanId };
    publishRecordInsights();
    return data;
  }

  async function loadSearchOptions(kind, query = '', cursor = null, target = 'form', append = false) {
    if (!repository || !['beans', 'recipes'].includes(kind)) return null;
    const routeEpoch = routeGeneration;
    const connectionRevision = activeConnection?.revision;
    const optionIdentity = target + ':' + kind;
    const optionEpoch = (optionSearchGeneration.get(optionIdentity) ?? 0) + 1;
    optionSearchGeneration.set(optionIdentity, optionEpoch);
    const favoriteOnly = target === 'brew' && routeLocation(currentRoute()).params.get('favorite') === 'true';
    return loadOptionSearch(optionCache, { revision: connectionRevision, target, kind, query, favoriteOnly, cursor, append }, {
      search: options => repository.searchOptions({ ...options, signal: routeReadController?.signal }),
      isCurrent: () => routeEpoch === routeGeneration && optionSearchGeneration.get(optionIdentity) === optionEpoch &&
        connectionRevision === activeConnection?.revision && !routeReadController?.signal.aborted,
      showPage: (...args) => view.setSearchOptions?.(...args),
      showState: (...args) => view.setSearchOptionsState?.(...args),
      reportError: error => showFailure(error, 'read-error'),
    });
  }

  function setRecordFilters(filters = {}) {
    recordFilters = { beanId: filters.beanId || '', recipeId: filters.recipeId || '' };
    invalidateRecordList(screenCache);
    return loadRoute(currentRoute(), { force: true });
  }

  function invalidateScreenCache(kind) {
    if (kind === 'favorite-bean' || kind === 'favorite-recipe') {
      view.clearSearchOptions?.(kind === 'favorite-bean' ? 'beans' : 'recipes');
      invalidateReadCaches(screenCache, optionCache, kind);
      return;
    }
    if (kind === 'beans' || kind === 'delete-bean') repository?.invalidateRecordParentCache?.('beans');
    if (['recipes', 'copy', 'delete-recipe', 'edit-recipe'].includes(kind)) repository?.invalidateRecordParentCache?.('recipes');
    if (kind === 'beans' || kind === 'delete-bean') view.clearSearchOptions?.('beans');
    else if (kind === 'recipes' || kind === 'copy' || kind === 'delete-recipe' || kind === 'edit-recipe') view.clearSearchOptions?.('recipes');
    else if (kind === 'records' || kind === 'delete-record') resetRecordInsights(activeConnection?.revision);
    invalidateReadCaches(screenCache, optionCache, kind);
  }

  function updateVisibleFavorite(kind, id, favorite, connection, requestClient) {
    if (activeConnection !== connection || client !== requestClient ||
        dataRevision !== connection?.revision || data?.screen?.route !== currentRoute()) return;
    const target = kind === 'favorite-bean' ? 'beans' : 'recipes';
    const items = data?.[target];
    if (!Array.isArray(items) || !items.some(item => item.id === id)) return;
    data = { ...data, [target]: items.map(item => item.id === id ? { ...item, favorite } : item) };
    view.renderData?.(data);
  }

  async function readLatest({ skipVerify = false, notifyCompletion = false, suppressCompletion = false } = {}) {
    return loadRoute(currentRoute(), { force: true, skipVerify, notifyCompletion, suppressCompletion });
  }

  async function refresh() {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (pending) throw Object.freeze({ code: 'lock-unavailable' });
    pending = true;
    stateChanged();
    if (routeLocation(currentRoute()).path === '/records') resetRecordInsights(activeConnection?.revision);
    try { return await readLatest({ notifyCompletion: true }); }
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

  async function runInitialization() {
    let canEditConnection = false;
    view.showConnection?.({ connected: !!activeConnection, checkingInitialization: true });
    view.showStatus?.({ type: 'startup-checking', message: '저장된 연결 확인 중' });
    try {
      const loaded = await withStartupLock(async context => {
        // Keep startup failures outside the write-lock adapter's generic action-error boundary.
        try {
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
          canEditConnection = true;
          const kinds = routeSchemas(currentRoute());
          await stack.nextClient.verify(kinds.length ? kinds : SOURCE_KEYS);
          return { connection, ...stack };
        } catch (error) { return { error }; }
      });
      if (loaded?.error) throw loaded.error;
      if (!loaded) {
        activeConnection = null;
        client = repository = commands = null;
        dropConnectionData();
        view.showConnection?.({ connected: false });
        view.showStatus?.({ type: 'disconnected', message: 'Notion 연결 정보를 입력해 주세요.' });
        return null;
      }
      install(loaded.connection, loaded.nextClient, loaded.nextRepository, loaded.nextCommands);
      try { await readLatest({ skipVerify: true }); } catch { /* A verified connection remains usable when its first read fails. */ }
      return true;
    } catch (error) {
      if (error?.code === 'lock-busy') {
        view.showStatus?.({ type: 'startup-busy', message: SAFE_MESSAGES['lock-busy'] });
        view.showConnection?.({ connected: !!activeConnection, retryInitialization: true });
        return false;
      }
      const startupMessage = canEditConnection
        ? messageFor(error)
        : '저장된 연결을 읽지 못했습니다. 기기 저장소를 확인한 뒤 다시 시도해 주세요.';
      const needsRecovery = ['connection-mismatch', 'unresolved-connection'].includes(error?.code);
      if (needsRecovery || error?.code === 'state-blocked') {
        activeConnection = null;
        client = repository = commands = null;
        dropConnectionData();
      }
      view.showStatus?.({ type: 'connection-error', message: needsRecovery || error?.code === 'state-blocked'
        ? messageFor(error)
        : canEditConnection && ![401, 403, 404, 429].includes(error?.httpStatus)
          ? `저장된 연결을 확인하지 못했습니다. ${startupMessage}` : startupMessage });
      view.showConnection?.(needsRecovery
        ? { connected: !!activeConnection, needsRecovery: true }
        : { connected: !!activeConnection, retryInitialization: true, canEditConnection });
      return false;
    } finally {
      view.finishStartup?.();
    }
  }

  async function initialize() {
    if (pending) throw Object.freeze({ code: 'lock-unavailable' });
    pending = true;
    stateChanged();
    try { return await runInitialization(); }
    finally {
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
      view.showConnectionSuccess?.();
      view.showStatus?.({ type: 'connected', message: '연결을 확인하고 저장했습니다.' });
      try { await readLatest({ skipVerify: true }); } catch { /* Saving the connection is independent of its first data read. */ }
      return true;
    } catch (error) {
      showFailure(error, 'connection-error');
      const uncertain = ['connection-save-uncertain', 'connection-mismatch'].includes(error?.code);
      if (uncertain) {
        activeConnection = null;
        client = repository = commands = null;
        dropConnectionData();
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
      return await runInitialization();
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
          if (operation.kind === 'edit-recipe' && operation.editTarget) {
            if (pageIds.length || !['saved', 'not-saved'].includes(resolution.decision) ||
                await fingerprint(current.dataSources) !== operation.targetFingerprint) throw Object.freeze({ code: 'invalid-resolution' });
            const target = operation.editTarget;
            const freshData = await freshStack.nextRepository.readAll();
            const recipe = freshData.recipes?.find(item => item.id === target.recipeId);
            if (!recipe || !matchesMicronAssertion(recipe, target.micronAssertion, resolution.decision)) {
              throw Object.assign(new Error(), { code: 'edit-state-mixed' });
            }
            const observedFingerprint = await recipeFingerprint(recipeEditState(recipe, target.beforeStepIds));
            const expectedFingerprint = resolution.decision === 'saved' ? target.afterFingerprint : target.beforeFingerprint;
            const otherFingerprint = resolution.decision === 'saved' ? target.beforeFingerprint : target.afterFingerprint;
            if (observedFingerprint !== expectedFingerprint) {
              if (observedFingerprint !== otherFingerprint) throw Object.assign(new Error(), { code: 'edit-state-mixed' });
              throw Object.freeze({ code: 'invalid-resolution' });
            }
            const originalIds = new Set(target.beforeStepIds);
            const createdStepIds = resolution.decision === 'saved'
              ? recipe.steps.map(step => step.id).filter(id => !originalIds.has(id)) : [];
            const plannedCreates = target.pages.filter(page => page.action === 'create');
            if (createdStepIds.length !== (resolution.decision === 'saved' ? plannedCreates.length : 0) ||
                new Set(createdStepIds).size !== createdStepIds.length ||
                target.pages.some(page => page.action === 'create' && page.id &&
                  (resolution.decision !== 'saved' || !createdStepIds.includes(page.id)))) {
              throw Object.assign(new Error(), { code: 'edit-state-mixed' });
            }

            const rawSteps = await freshStack.nextClient.queryAll('steps');
            if (!Array.isArray(rawSteps)) throw Object.freeze({ code: 'resolution-read-failed' });
            const activeRelatedIds = [];
            for (const page of rawSteps) {
              if (!UUID.test(page?.id ?? '') || page.parent?.type !== 'data_source_id' ||
                  page.parent.data_source_id !== current.dataSources.steps) continue;
              const relation = page.properties?.['레시피'];
              const relationIds = Array.isArray(relation?.relation)
                ? relation.relation.map(item => typeof item?.id === 'string' && UUID.test(item.id) ? item.id.toLowerCase() : null)
                : null;
              const pageId = page.id.toLowerCase();
              if (relationIds?.includes(target.recipeId)) {
                if (relation?.has_more !== false || relationIds.length !== 1 || relationIds[0] !== target.recipeId) {
                  throw Object.assign(new Error(), { code: 'edit-state-mixed' });
                }
                if (page.in_trash === false && page.archived === false) activeRelatedIds.push(pageId);
                else if (page.in_trash !== true && page.archived !== true) throw Object.assign(new Error(), { code: 'edit-state-mixed' });
              } else if (plannedCreates.length && !originalIds.has(pageId) &&
                  (relation?.has_more !== false || !relationIds)) {
                throw Object.assign(new Error(), { code: 'edit-state-mixed' });
              }
            }
            const actualCreated = activeRelatedIds.filter(id => !originalIds.has(id)).sort();
            if (JSON.stringify(actualCreated) !== JSON.stringify([...createdStepIds].sort())) {
              throw Object.assign(new Error(), { code: 'edit-state-mixed' });
            }
            const createdPages = [];
            const knownCreatedIds = operation.createdPages.filter(page => page.kind === 'steps').map(page => page.id);
            let createIndex = 0;
            for (const plannedPage of target.pages) {
              const isCreate = plannedPage.action === 'create';
              const createId = isCreate ? (plannedPage.id ?? (resolution.decision === 'saved'
                ? createdStepIds[createIndex] : knownCreatedIds[createIndex])) : plannedPage.id;
              if (isCreate) {
                if (plannedPage.id && knownCreatedIds[createIndex] && plannedPage.id !== knownCreatedIds[createIndex]) {
                  throw Object.assign(new Error(), { code: 'edit-state-mixed' });
                }
                createIndex++;
              }
              if (!createId) continue;
              const page = await freshStack.nextClient.getPage(createId);
              const kind = plannedPage.kind;
              const sourceId = current.dataSources[kind];
              const archived = page.in_trash === true || page.archived === true;
              const shouldBeArchived = plannedPage.action === 'archive' ? resolution.decision === 'saved'
                : plannedPage.action === 'create' ? resolution.decision === 'not-saved' : false;
              const expectedFingerprint = plannedPage.action === 'create' ||
                (plannedPage.action === 'update' && resolution.decision === 'saved')
                ? plannedPage.afterFingerprint : plannedPage.beforeFingerprint;
              let valuesFingerprint;
              try {
                if (page.parent?.type !== 'data_source_id' || page.parent.data_source_id !== sourceId ||
                    page.id?.toLowerCase() !== createId || typeof page.in_trash !== 'boolean' ||
                    typeof page.archived !== 'boolean' || archived !== shouldBeArchived) {
                  throw new Error();
                }
                if (kind === 'steps') {
                  const relation = page.properties?.['레시피'];
                  const relationIds = Array.isArray(relation?.relation)
                    ? relation.relation.map(item => typeof item?.id === 'string' && UUID.test(item.id) ? item.id.toLowerCase() : null)
                    : null;
                  if (relation?.type !== 'relation' || relation.has_more !== false ||
                      !relationIds || relationIds.length !== 1 || relationIds[0] !== target.recipeId) throw new Error();
                }
                const decoded = decodePage(kind, page);
                if (kind === 'recipes' && !matchesMicronAssertion(decoded, target.micronAssertion, resolution.decision)) {
                  throw new Error();
                }
                valuesFingerprint = await recipeFingerprint(kind === 'steps'
                  ? stepPageValues(decoded) : recipePageValues(decoded));
              } catch {
                throw Object.assign(new Error(), { code: 'edit-state-mixed' });
              }
              if (valuesFingerprint !== expectedFingerprint) {
                throw Object.assign(new Error(), { code: 'edit-state-mixed' });
              }
              if (isCreate) createdPages.push({ kind: 'steps', id: createId, archiveState: archived ? 'archived' : 'active' });
            }
            const expectedCreatedIds = resolution.decision === 'saved' ? createdStepIds
              : operation.createdPages.filter(page => page.kind === 'steps').map(page => page.id);
            if (createIndex !== plannedCreates.length || createdPages.length !== expectedCreatedIds.length ||
                [...createdPages.map(page => page.id)].sort().join('|') !== [...expectedCreatedIds].sort().join('|')) {
              throw Object.assign(new Error(), { code: 'edit-state-mixed' });
            }
            return { connectionRevision: operation.connectionRevision, targetFingerprint: operation.targetFingerprint,
              outcome: resolution.decision,
              editTarget: { recipeId: target.recipeId, state: resolution.decision === 'saved' ? 'after' : 'before',
                createdStepIds, createdPages } };
          }
          if (operation.updateTarget) {
            if (pageIds.length || !['saved', 'not-saved', 'cancelled'].includes(resolution.decision) ||
                freshStack.nextClient.beanBestRecordRelationSupported !== true) {
              throw Object.freeze({ code: 'invalid-resolution' });
            }
            const target = operation.updateTarget;
            const page = await freshStack.nextClient.getPage(target.id);
            const relation = page.properties?.['베스트 추출'];
            const relationIds = Array.isArray(relation?.relation)
              ? relation.relation.map(item => typeof item?.id === 'string' && UUID.test(item.id) ? item.id.toLowerCase() : null)
              : null;
            if (target.kind !== 'beans' || page.parent?.type !== 'data_source_id' ||
                page.parent.data_source_id !== current.dataSources.beans || page.archived !== false || page.in_trash !== false ||
                relation?.type !== 'relation' || relation.has_more !== false || !relationIds || relationIds.some(id => !id) ||
                relationIds.length > 1) throw Object.freeze({ code: 'invalid-resolution' });
            const currentRecordId = relationIds[0] ?? null;
            const expectedRecordId = resolution.decision === 'saved' ? target.nextRecordId : target.beforeRecordId;
            if (currentRecordId !== expectedRecordId) throw Object.freeze({ code: 'invalid-resolution' });
            if (resolution.decision === 'saved') {
              const selected = await freshStack.nextRepository.getRecord(target.nextRecordId);
              if (!selected || selected.beanId !== target.id || selected.beanResolution === 'needs-confirmation') {
                throw Object.freeze({ code: 'invalid-resolution' });
              }
            }
            return { connectionRevision: operation.connectionRevision, targetFingerprint: operation.targetFingerprint,
              outcome: resolution.decision, updateTarget: { kind: 'beans', id: target.id, recordId: currentRecordId } };
          }
          if (operation.favoriteTarget) {
            if (pageIds.length || !['saved', 'not-saved'].includes(resolution.decision) ||
                await fingerprint(current.dataSources) !== operation.targetFingerprint) throw Object.freeze({ code: 'invalid-resolution' });
            const target = operation.favoriteTarget;
            const supported = target.kind === 'beans'
              ? freshStack.nextClient.beanFavoriteSupported : freshStack.nextClient.recipeFavoriteSupported;
            if (supported === false) throw Object.freeze({ code: 'favorite-unsupported' });
            const item = target.kind === 'beans'
              ? await freshStack.nextRepository.getBean(target.id)
              : await freshStack.nextRepository.getRecipeDetail(target.id);
            if (typeof item.favorite !== 'boolean' || (item.favorite === target.favorite) !== (resolution.decision === 'saved')) throw Object.freeze({ code: 'invalid-resolution' });
            return { connectionRevision: operation.connectionRevision, targetFingerprint: operation.targetFingerprint,
              outcome: resolution.decision, favoriteTarget: { ...target, favorite: item.favorite } };
          }
          if (DELETE_TARGET_BY_OPERATION[operation.kind]) {
            if (pageIds.length || !operation.deleteTarget || !['saved', 'not-saved'].includes(resolution.decision)) {
              throw Object.freeze({ code: 'invalid-resolution' });
            }
            const target = operation.deleteTarget;
            const kind = DELETE_TARGET_BY_OPERATION[operation.kind];
            const page = await freshStack.nextClient.getPage(target.id);
            if (target.kind !== kind || page.parent?.type !== 'data_source_id' ||
                page.parent.data_source_id !== current.dataSources[kind] ||
                typeof page.in_trash !== 'boolean' || typeof page.archived !== 'boolean') {
              throw Object.freeze({ code: 'invalid-resolution' });
            }
            const archived = page.in_trash === true || page.archived === true;
            if (archived !== (resolution.decision === 'saved')) throw Object.freeze({ code: 'invalid-resolution' });
            return { connectionRevision: operation.connectionRevision, targetFingerprint: operation.targetFingerprint,
              outcome: resolution.decision, deleteTarget: { ...target, archiveState: archived ? 'archived' : 'active' } };
          }
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
      screenCache.clear(); optionCache.clear(); view.clearSearchOptions?.();
      await readUnresolved();
      view.showStatus?.({ type: 'resolved', message: '확인 결과를 저장했습니다. 다시 제출하기 전에 최신 목록을 확인해 주세요.' });
      if (activeConnection) {
        try { await readLatest({ skipVerify: true }); } catch { /* Resolution is durable even when the final refresh fails. */ }
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
    routeReadController?.abort();
    routeReadController = null;
    routeGeneration += 1;
    const favorite = kind === 'favorite-bean' || kind === 'favorite-recipe';
    const favoriteSource = kind === 'favorite-bean' ? 'beans' : 'recipes';
    const submissionConnection = activeConnection;
    const submissionClient = client;
    let pendingReleased = false;
    const releasePending = () => {
      if (pendingReleased) return;
      pending = false;
      pendingReleased = true;
      stateChanged();
    };
    pending = true;
    stateChanged();
    const deleteSection = DELETE_TARGET_BY_OPERATION[kind];
    const deleting = Boolean(deleteSection);
    view.showStatus?.({ type: 'saving', message: deleting ? '삭제 중입니다.' : '저장 중입니다.' });
    try {
      if (favorite) await client.verify([favoriteSource]);
      else await client.verify();
      const prepare = {
          'delete-bean': 'prepareDeleteBean', 'delete-recipe': 'prepareDeleteRecipe',
          'delete-record': 'prepareDeleteRecord', 'set-best-record': 'prepareBestRecord',
          beans: 'prepareBean', recipes: 'prepareRecipe', records: 'prepareRecord', brews: 'prepareBrew',
          'favorite-bean': 'prepareFavoriteBean', 'favorite-recipe': 'prepareFavoriteRecipe',
          'edit-recipe': 'prepareEditRecipe',
        }[kind];
      if (kind !== 'copy' && !prepare) throw Object.freeze({ code: 'input' });
      const draft = kind === 'copy'
        ? await commands.prepareCopy(payload.recipeId, payload.changes)
        : kind === 'edit-recipe'
          ? await commands.prepareEditRecipe(payload.recipeId, payload.baseline, payload.changes)
        : await commands[prepare](payload);
      const result = await commands.execute(draft);
      if (result.status === 'succeeded') {
        if (!deleting && !kind.startsWith('favorite-')) {
          const formKind = kind === 'copy' || kind === 'edit-recipe' ? 'recipes' : kind;
          const dirtyKey = kind === 'edit-recipe' ? `recipe-edit:${payload.recipeId}` : formKind;
          dirtyKinds.delete(dirtyKey);
          if (view.showEntrySuccess?.(formKind) !== true) {
            view.clearForm?.(formKind);
            view.clearDraft?.(formKind, kind === 'edit-recipe' ? payload.recipeId : null);
          }
        }
        view.clearStatus?.();
        invalidateScreenCache(kind === 'set-best-record' ? 'records' : kind);
        if (favorite) {
          updateVisibleFavorite(kind, payload.id, payload.favorite, submissionConnection, submissionClient);
          releasePending();
          void readLatest({ skipVerify: true, suppressCompletion: true }).catch(() => {});
          return result;
        }
        if ((deleteSection === 'beans' || deleteSection === 'recipes') &&
            routeLocation(currentRoute()).path === `/${deleteSection}/${payload.id}`) {
          view.renderRoute?.(`/${deleteSection}`, { replaceHistory: true, notify: false });
        }
        stateChanged();
        let deleteMessage = '삭제했습니다.';
        try { await readLatest({ skipVerify: true, suppressCompletion: true }); }
        catch {
          deleteMessage = '삭제는 성공했지만 최신 목록을 불러오지 못했습니다. 목록을 새로고침해 주세요.';
          view.showStatus?.({ type: deleting ? 'deleted-read-error' : 'saved-read-error', message: deleting ? deleteMessage : '저장은 성공했지만 최신 목록을 불러오지 못했습니다. 다시 제출하지 마세요.' });
        }
        if (deleting) view.showDeleteResult?.({ status: 'succeeded', message: deleteMessage });
        return result;
      }
      if (['unknown', 'partial'].includes(result.status)) await readUnresolved();
      if (deleting) {
        const message = result.status === 'unknown'
          ? '삭제 여부 확인이 필요합니다. 다시 삭제하지 말고 Notion 원본을 확인해 주세요.'
          : SAFE_MESSAGES[result.code] ?? SAFE_MESSAGES['delete-failed'];
        view.showStatus?.({ type: result.status, message });
        view.showDeleteResult?.({ status: result.status, message });
      } else showFailure({ code: result.code ?? result.status }, result.status);
      return result;
    } catch (error) {
      if (error?.writeState === 'unknown' || error?.writeState === 'partial') await readUnresolved();
      showFailure(error, error?.writeState === 'unknown' ? 'unknown' : 'validation-error');
      if (deleting) view.showDeleteResult?.({
        status: ['unknown', 'partial'].includes(error?.writeState) ? error.writeState : 'failed',
        message: messageFor(error),
      });
      throw error;
    } finally {
      releasePending();
    }
  }

  function setFrozen(value, details = {}) {
    if (value && (hasDirtyWork() || pending)) return false;
    frozen = !!value;
    view.setFrozen?.(frozen, details);
    stateChanged();
    return true;
  }

  function getState() {
    return Object.freeze({ dirty: hasDirtyWork(), pending, frozen, connected: !!activeConnection,
      unresolved: unresolvedOperations.length > 0 });
  }

  function isDirty(kind) { return dirtyKinds.has(kind); }

  function bind() {
    view.onRouteChange?.(route => client && repository ? loadRoute(route).catch(() => {}) : null);
    view.bind?.({ initialize, connect, refresh, submit, confirmCurrent, resolveOperation, setDirty, setFrozen, getState, isDirty,
      loadMore, loadMoreInsights, loadSearchOptions, setRecordFilters, setRecordInsightsBean });
  }

  return Object.freeze({
    initialize, connect, confirmCurrent, resolveOperation, refresh, submit, setDirty, setFrozen, getState, isDirty, bind,
    loadRoute, loadMore, loadMoreInsights, loadSearchOptions, setRecordFilters, setRecordInsightsBean,
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
