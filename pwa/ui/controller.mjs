const SOURCE_KEYS = Object.freeze(['beans', 'recipes', 'steps', 'records']);
const SOURCE_BY_OPERATION = Object.freeze({
  'delete-bean': ['beans'], 'delete-recipe': ['recipes'], 'delete-record': ['records'],
  beans: ['beans'], recipes: ['recipes', 'steps'], records: ['records'],
});
const DELETE_TARGET_BY_OPERATION = Object.freeze({
  'delete-bean': 'beans', 'delete-recipe': 'recipes', 'delete-record': 'records',
});
const STARTUP_LOCK_RETRY_DELAYS_MS = Object.freeze([100, 200, 300, 500, 700]);
const SCREEN_PAGE_SIZE = 20;
const SCREEN_CACHE_TTL_MS = 60000;
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
  'recipe-guide-unsupported': '추출 가이드를 저장하려면 Notion recipes 데이터베이스에 rich_text 속성을 추가해 주세요. 기존 레시피 조회는 계속할 수 있습니다.',
  'stale-read': '조회 중 데이터가 바뀌었습니다. 다시 조회해 주세요.',
  'resolution-read-failed': '확인 중 최신 데이터를 읽지 못했습니다. 원본을 확인한 뒤 다시 시도해 주세요.',
  'invalid-resolution': '확인 입력을 처리하지 못했습니다. 원본 상태와 입력한 페이지를 확인해 주세요.',
  input: '입력 내용을 확인해 주세요.',
  'delete-failed': '삭제하지 못했습니다. 연결된 추출 기록이나 확인할 수 없는 관계가 있는지 확인하고 목록을 새로고침해 주세요.',
  'delete-in-use': '이 레시피를 사용하는 추출 기록이 있습니다. 먼저 해당 추출 기록을 삭제한 뒤 다시 시도해 주세요.',
  'delete-dependency-unknown': '연결 관계나 제외된 기록을 확인할 수 없어 안전을 위해 삭제를 막았습니다. 최신 목록을 새로고침해 주세요.',
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
  let routeGeneration = 0;
  let routeReadController = null;
  let recordFilters = { beanId: '', recipeId: '' };
  const screenCache = new Map();
  const optionCache = new Map();
  const optionSearchGeneration = new Map();
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
      targetKind: operation.deleteTarget?.kind,
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
    screenCache.clear();
    optionCache.clear();
    optionSearchGeneration.clear();
    activeConnection = connection;
    client = nextClient;
    repository = nextRepository;
    commands = nextCommands;
    view.clearSearchOptions?.();
    view.showConnection?.({ connected: true });
  }

  function routeLocation(route) {
    const [path = '/home', query = ''] = String(route ?? '/home').split('?', 2);
    return { path: path || '/home', params: new URLSearchParams(query) };
  }

  function currentRoute() {
    const route = view.currentRoute?.();
    return typeof route === 'string' && route.startsWith('/') ? route : '/home';
  }

  function routeSchemas(route) {
    const { path } = routeLocation(route);
    const [section, id] = path.split('/').filter(Boolean);
    if (!section || section === 'home') return [];
    if (section === 'brew') {
      if (id === 'bean') return ['beans'];
      if (id === 'recipe' || id === 'run') return ['beans', 'recipes', 'steps'];
      return [];
    }
    if (section === 'beans') return id ? ['beans', 'records', 'recipes'] : ['beans'];
    if (section === 'recipes') return id && id !== 'new' ? ['beans', 'recipes', 'steps', 'records'] : ['recipes', 'steps'];
    if (section === 'records') return id === 'new'
      ? ['beans', 'recipes', 'steps', 'records'] : ['beans', 'recipes', 'records'];
    return [];
  }

  function routeCacheKey(route, cursor = null) {
    const query = route.startsWith('/records') ? recordFilters : {};
    return [activeConnection?.revision ?? 'disconnected', route, JSON.stringify(query), cursor ?? 'first'].join('|');
  }

  function currentCache(key) {
    const entry = screenCache.get(key);
    if (!entry || Date.now() - entry.savedAt > SCREEN_CACHE_TTL_MS) {
      screenCache.delete(key);
      return null;
    }
    return entry.value;
  }

  function saveCache(key, value) {
    screenCache.set(key, { value, savedAt: Date.now() });
  }

  async function readOptionPage(target, kind, query, cursor, signal) {
    const key = [activeConnection?.revision, target, kind, query, cursor ?? 'first'].join('|');
    if (cursor == null) {
      const cached = currentCacheOption(key);
      if (cached) return cached;
    }
    const result = await repository.searchOptions({ kind, query, cursor, limit: SCREEN_PAGE_SIZE, signal });
    optionCache.set(key, { value: result, savedAt: Date.now() });
    return result;
  }

  function mergeScreenData(previous, next) {
    if (!previous || !next?.screen?.append) return next;
    const merged = { ...previous, ...next };
    for (const key of ['beans', 'recipes', 'records']) {
      const seen = new Set();
      merged[key] = [...(previous[key] ?? []), ...(next[key] ?? [])].filter(item => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    }
    merged.screen = { ...next.screen, append: false };
    return merged;
  }

  function unavailableScreen(route, error) {
    if (!['bean-required', 'bean-unavailable', 'recipe-unavailable', 'invalid-input'].includes(error?.code)) return null;
    return { beans: [], recipes: [], records: [], excluded: {},
      screen: { route, error: error.code === 'invalid-input' ? 'bean-unavailable' : error.code,
        nextCursor: null, hasMore: false, complete: true } };
  }

  function optionWithSelectedItem(page, item, kind) {
    if (!item || page.items.some(option => option.id === item.id)) return page;
    return { ...page, items: [{ id: item.id, name: item.name,
      ...(kind === 'recipes' ? { beanId: item.beanId } : {}), status: 'ready' }, ...page.items] };
  }

  async function fetchScreen(route, cursor, signal) {
    const { path, params } = routeLocation(route);
    const [section, id] = path.split('/').filter(Boolean);
    const query = params.get('q')?.trim() ?? '';
    const pageOptions = { cursor, limit: SCREEN_PAGE_SIZE, signal };

    if (!section || section === 'home') {
      return { beans: [], recipes: [], records: [], excluded: {},
        screen: { route, nextCursor: null, hasMore: false, complete: true } };
    }
    if (section === 'brew' && id === 'bean') {
      const page = await repository.listBeans({ ...pageOptions, query });
      return { beans: page.items, recipes: [], records: [], excluded: {},
        screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
    }
    if (section === 'brew' && id === 'recipe') {
      const beanId = params.get('beanId');
      if (!beanId) return unavailableScreen(route, { code: 'bean-unavailable' });
      try {
        const [bean, page] = await Promise.all([
          repository.getBean(beanId, { signal }),
          repository.listRecipeSummaries({ ...pageOptions, query }),
        ]);
        return { beans: [bean], recipes: page.items,
          records: [], excluded: {},
          screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
      } catch (error) {
        const unavailable = unavailableScreen(route, error);
        if (unavailable) return unavailable;
        throw error;
      }
    }
    if (section === 'brew' && id === 'run') {
      const beanId = params.get('beanId');
      const recipeId = params.get('recipeId');
      if (!beanId) return unavailableScreen(route, { code: 'bean-required' });
      if (!recipeId) return unavailableScreen(route, { code: 'recipe-unavailable' });
      try {
        const [bean, recipe] = await Promise.all([
          repository.getBean(beanId, { signal }),
          repository.getRecipeDetail(recipeId, { signal }),
        ]);
        if (!Array.isArray(recipe.steps) || !recipe.steps.length) return unavailableScreen(route, { code: 'recipe-unavailable' });
        return { beans: [bean], recipes: [recipe], records: [], excluded: {},
          screen: { route, nextCursor: null, hasMore: false, complete: true } };
      } catch (error) {
        const unavailable = unavailableScreen(route, error);
        if (unavailable) return unavailable;
        throw error;
      }
    }
    if (section === 'beans' && !id) {
      const page = await repository.listBeans(pageOptions);
      return { beans: page.items.map(bean => ({ ...bean, recordCount: { status: 'loading', count: null } })),
        recipes: [], records: [], excluded: {}, screen: { route, nextCursor: page.nextCursor,
          hasMore: page.hasMore, complete: page.complete } };
    }
    if (section === 'beans' && id) {
      const bean = cursor && data?.screen?.route === route
        ? data.beans.find(item => item.id === id) ?? await repository.getBean(id, { signal })
        : await repository.getBean(id, { signal });
      const page = await repository.listRecords({ beanId: id, ...pageOptions });
      return { beans: [bean], recipes: page.recipes, records: page.items, excluded: {},
        screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
    }
    if (section === 'recipes' && !id) {
      const page = await repository.listRecipeSummaries(pageOptions);
      return { beans: [], recipes: page.items, records: [], excluded: {},
        screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
    }
    if (section === 'recipes' && id && id !== 'new') {
      const detail = cursor && data?.screen?.route === route
        ? data.recipes.find(item => item.id === id) ?? await repository.getRecipeDetail(id, { signal })
        : await repository.getRecipeDetail(id, { signal });
      const page = await repository.listRecords({ recipeId: id, ...pageOptions });
      return { beans: page.beans, recipes: [detail, ...page.recipes.filter(item => item.id !== detail.id)],
        records: page.items, excluded: {},
        screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
    }
    if (section === 'records') {
      let selectedBean = null;
      let selectedRecipe = null;
      if (id === 'new' && cursor == null) {
        const beanId = params.get('beanId');
        const recipeId = params.get('recipeId');
        if (recipeId && !beanId) return unavailableScreen(route, { code: 'bean-required' });
        try {
          [selectedBean, selectedRecipe] = await Promise.all([
            beanId ? repository.getBean(beanId, { signal }) : null,
            recipeId ? repository.getRecipeDetail(recipeId, { signal }) : null,
          ]);
          if (selectedRecipe && (!Array.isArray(selectedRecipe.steps) || !selectedRecipe.steps.length)) {
            return unavailableScreen(route, { code: 'recipe-unavailable' });
          }
        } catch (error) {
          const unavailable = unavailableScreen(route, error);
          if (unavailable) return unavailable;
          throw error;
        }
      }
      const page = await repository.listRecords({ ...recordFilters, ...pageOptions });
      const result = { beans: page.beans, recipes: page.recipes, records: page.items, excluded: {},
        screen: { route, filters: { ...recordFilters }, nextCursor: page.nextCursor,
          hasMore: page.hasMore, complete: page.complete } };
      if (id === 'new' && cursor == null) {
        const beanOptions = await readOptionPage('form', 'beans', '', null, signal);
        const recipeOptions = await readOptionPage('form', 'recipes', '', null, signal);
        const selectedBeans = optionWithSelectedItem(beanOptions, selectedBean, 'beans');
        const selectedRecipes = optionWithSelectedItem(recipeOptions, selectedRecipe, 'recipes');
        result.options = { beans: selectedBeans, recipes: selectedRecipes,
          filterBeans: cachedFilterOptions('beans', page.beans, recordFilters.beanId),
          filterRecipes: cachedFilterOptions('recipes', page.recipes, recordFilters.recipeId) };
        result.beans = selectedBeans.items;
        result.recipes = selectedRecipes.items;
      } else {
        const filterBeans = cachedFilterOptions('beans', page.beans, recordFilters.beanId);
        const filterRecipes = cachedFilterOptions('recipes', page.recipes, recordFilters.recipeId);
        if (filterBeans || filterRecipes) result.options = { filterBeans, filterRecipes };
      }
      return result;
    }
    if (section === 'recipes' && id === 'new') {
      const page = await repository.listRecipeSummaries(pageOptions);
      return { beans: [], recipes: page.items, records: [], excluded: {},
        screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
    }
    return { beans: [], recipes: [], records: [], excluded: {},
      screen: { route, nextCursor: null, hasMore: false, complete: true } };
  }

  function setRouteReadState(generation, status) {
    if (generation !== routeGeneration) return false;
    view.setRouteReadState?.(status);
    return true;
  }

  async function loadRoute(route = currentRoute(), { cursor = null, append = false, force = false, skipVerify = false } = {}) {
    if (frozen) throw Object.freeze({ code: 'lifecycle-frozen' });
    if (!repository || !client) return null;
    routeReadController?.abort();
    const controller = new AbortController();
    routeReadController = controller;
    const generation = ++routeGeneration;
    const key = routeCacheKey(route, cursor);
    const isFirstPage = cursor == null;
    const isRouteTransition = isFirstPage && !append && currentRoute() === route && data?.screen?.route !== route;
    if (isRouteTransition) setRouteReadState(generation, 'loading');
    else if (isFirstPage && !append && currentRoute() === route && data?.screen?.route === route) {
      setRouteReadState(generation, 'ready');
    }
    try {
      if (!skipVerify) {
        const kinds = routeSchemas(route);
        if (kinds.length) await client.verify(kinds, { signal: controller.signal });
      }
      if (generation !== routeGeneration || controller.signal.aborted) return null;
      const cached = !force && isFirstPage ? currentCache(key) : null;
      const previous = append ? data : null;
      const fetched = cached ?? await fetchScreen(route, cursor, controller.signal);
      if (generation !== routeGeneration || controller.signal.aborted) return null;
      fetched.screen = { ...fetched.screen, append };
      data = mergeScreenData(previous, fetched);
      saveCache(key, data);
      view.renderData?.(data);
      if (isRouteTransition) setRouteReadState(generation, 'ready');
      view.showStatus?.({ type: 'ready', message: '' });
      startDeferredReads(route, generation, key, controller.signal);
      return data;
    } catch (error) {
      if (generation !== routeGeneration || controller.signal.aborted) return null;
      if (isRouteTransition) setRouteReadState(generation, error?.code === 'read-cancelled' ? 'cancelled' : 'error');
      if (error?.code === 'read-cancelled') return null;
      showFailure(error, 'read-error');
      throw error;
    }
  }

  function startDeferredReads(route, generation, key, signal) {
    const update = patch => {
      if (generation !== routeGeneration || signal.aborted || currentRoute() !== route || !data) return;
      data = { ...data, ...patch };
      saveCache(key, data);
      view.renderData?.(data);
    };
    const batches = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
      items.slice(index * size, (index + 1) * size));
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
            if (snapshot?.version === 2) return kind === 'beans' ? snapshot.bean?.name : snapshot.recipe?.name;
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

  async function loadMore() {
    if (!data?.screen?.hasMore || !data.screen.nextCursor) return null;
    return loadRoute(currentRoute(), { cursor: data.screen.nextCursor, append: true });
  }

  async function loadSearchOptions(kind, query = '', cursor = null, target = 'form', append = false) {
    if (!repository || !['beans', 'recipes'].includes(kind)) return null;
    const routeEpoch = routeGeneration;
    const connectionRevision = activeConnection?.revision;
    const optionIdentity = target + ':' + kind;
    const optionEpoch = (optionSearchGeneration.get(optionIdentity) ?? 0) + 1;
    optionSearchGeneration.set(optionIdentity, optionEpoch);
    const key = [connectionRevision, target, kind, query, cursor ?? 'first'].join('|');
    const cached = !append && currentCacheOption(key);
    if (cached) {
      view.setSearchOptions?.(target, kind, cached, false, query);
      return cached;
    }
    try {
      const result = await repository.searchOptions({ kind, query, cursor, limit: SCREEN_PAGE_SIZE,
        signal: routeReadController?.signal });
      if (routeEpoch !== routeGeneration || optionSearchGeneration.get(optionIdentity) !== optionEpoch ||
          connectionRevision !== activeConnection?.revision || routeReadController?.signal.aborted) return null;
      optionCache.set(key, { value: result, savedAt: Date.now() });
      view.setSearchOptions?.(target, kind, result, append, query);
      return result;
    } catch (error) {
      if (error?.code !== 'read-cancelled') showFailure(error, 'read-error');
      return null;
    }
  }

  function currentCacheOption(key) {
    const entry = optionCache.get(key);
    if (!entry || Date.now() - entry.savedAt > SCREEN_CACHE_TTL_MS) { optionCache.delete(key); return null; }
    return entry.value;
  }

  function cachedFilterOptions(kind, relatedRows, selectedId) {
    const revision = activeConnection?.revision ?? 'disconnected';
    const prefix = [revision, 'filters', kind, ''].join('|');
    const first = currentCacheOption([revision, 'filters', kind, '', 'first'].join('|'));
    if (!first) return null;
    const items = [...first.items];
    if (selectedId && !items.some(item => item.id === selectedId)) {
      const cached = [...optionCache.entries()].find(([key, entry]) => key.startsWith(prefix) &&
        entry.value.items.some(item => item.id === selectedId))?.[1]?.value.items.find(item => item.id === selectedId);
      const related = relatedRows.find(item => item.id === selectedId);
      const selected = cached ?? (related ? { id: related.id, name: related.name, status: 'ready' } : null);
      if (selected) items.push(selected);
    }
    return { ...first, items };
  }

  function setRecordFilters(filters = {}) {
    recordFilters = { beanId: filters.beanId || '', recipeId: filters.recipeId || '' };
    for (const key of screenCache.keys()) if (key.includes('|/records|')) screenCache.delete(key);
    return loadRoute(currentRoute(), { force: true });
  }

  function invalidateScreenCache(kind) {
    if (kind === 'beans' || kind === 'delete-bean') repository?.invalidateRecordParentCache?.('beans');
    if (['recipes', 'copy', 'delete-recipe'].includes(kind)) repository?.invalidateRecordParentCache?.('recipes');
    if (kind === 'beans') {
      view.clearSearchOptions?.('beans');
      for (const key of screenCache.keys()) if (key.includes('|/beans')) screenCache.delete(key);
      for (const key of optionCache.keys()) if (key.includes('|beans|')) optionCache.delete(key);
    } else if (kind === 'recipes' || kind === 'copy' || kind === 'delete-recipe') {
      view.clearSearchOptions?.('recipes');
      for (const key of screenCache.keys()) if (key.includes('|/recipes') || key.includes('|/records')) screenCache.delete(key);
      for (const key of optionCache.keys()) if (key.includes('|recipes|')) optionCache.delete(key);
    } else if (kind === 'records' || kind === 'delete-record') {
      for (const key of screenCache.keys()) if (key.includes('|/records') || key.includes('|/beans') || key.includes('|/recipes/')) screenCache.delete(key);
    } else if (kind === 'delete-bean') {
      view.clearSearchOptions?.('beans');
      for (const key of screenCache.keys()) if (key.includes('|/beans') || key.includes('|/records')) screenCache.delete(key);
      for (const key of optionCache.keys()) if (key.includes('|beans|')) optionCache.delete(key);
    }
  }

  async function readLatest({ skipVerify = false } = {}) {
    return loadRoute(currentRoute(), { force: true, skipVerify });
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
    pending = true;
    stateChanged();
    const deleting = Boolean(DELETE_TARGET_BY_OPERATION[kind]);
    view.showStatus?.({ type: 'saving', message: deleting ? '삭제 중입니다.' : '저장 중입니다.' });
    try {
      await client.verify();
      const prepare = {
          'delete-bean': 'prepareDeleteBean', 'delete-recipe': 'prepareDeleteRecipe',
          'delete-record': 'prepareDeleteRecord', beans: 'prepareBean', recipes: 'prepareRecipe', records: 'prepareRecord',
        }[kind];
      if (kind !== 'copy' && !prepare) throw Object.freeze({ code: 'input' });
      const draft = kind === 'copy'
        ? await commands.prepareCopy(payload.recipeId, payload.changes)
        : await commands[prepare](payload);
      const result = await commands.execute(draft);
      if (result.status === 'succeeded') {
        if (!deleting) {
          const formKind = kind === 'copy' ? 'recipes' : kind;
          dirtyKinds.delete(formKind);
          if (view.showEntrySuccess?.(formKind) !== true) {
            view.clearForm?.(formKind);
            view.clearDraft?.(formKind);
          }
        }
        stateChanged();
        invalidateScreenCache(kind);
        view.showStatus?.({ type: 'saved', message: deleting ? '삭제했습니다. 최신 목록을 다시 불러옵니다.' : '저장했습니다. 최신 목록을 다시 불러옵니다.' });
        let deleteMessage = '삭제했습니다.';
        try { await readLatest({ skipVerify: true }); }
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
      } else showFailure({ code: result.status }, result.status);
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
    view.onRouteChange?.(route => client && repository ? loadRoute(route).catch(() => {}) : null);
    view.bind?.({ initialize, connect, refresh, submit, confirmCurrent, resolveOperation, setDirty, setFrozen, getState,
      loadMore, loadSearchOptions, setRecordFilters });
  }

  return Object.freeze({
    initialize, connect, confirmCurrent, resolveOperation, refresh, submit, setDirty, setFrozen, getState, bind,
    loadRoute, loadMore, loadSearchOptions, setRecordFilters,
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
