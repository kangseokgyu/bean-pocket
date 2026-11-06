export const SCREEN_PAGE_SIZE = 20;

export function routeLocation(route) {
  const [path = '/home', query = ''] = String(route ?? '/home').split('?', 2);
  return { path: path || '/home', params: new URLSearchParams(query) };
}

export function routeSchemas(route) {
  const { path, params } = routeLocation(route);
  const [section, id] = path.split('/').filter(Boolean);
  if (!section || section === 'home') return [];
  if (section === 'brew') {
    if (id === 'bean') return ['beans'];
    if (id === 'recipe') return ['beans', 'recipes', 'steps'];
    if (id === 'run') return params.has('recordId') ? ['beans', 'records'] : ['beans', 'recipes', 'steps'];
    return [];
  }
  if (section === 'beans') return id ? ['beans', 'records', 'recipes'] : ['beans'];
  if (section === 'recipes') return id && id !== 'new' ? ['beans', 'recipes', 'steps', 'records'] : ['recipes', 'steps'];
  if (section === 'records') return id === 'new'
    ? ['beans', 'recipes', 'steps'] : ['beans', 'recipes', 'records'];
  return [];
}

export function reusableBrewSelection(route, data, dataRevision, revision) {
  const { path, params } = routeLocation(route);
  const beanId = params.get('beanId');
  const recipeId = params.get('recipeId');
  if (path !== '/records/new' || !beanId || !recipeId || dataRevision !== revision || data?.screen?.error) {
    return null;
  }
  const previous = routeLocation(data?.screen?.route);
  if (previous.path !== '/brew/run' || previous.params.get('beanId') !== beanId ||
      previous.params.get('recipeId') !== recipeId) return null;
  const bean = data.beans?.find(item => item.id === beanId);
  const recipe = data.recipes?.find(item => item.id === recipeId);
  if (!bean || !recipe || !Array.isArray(recipe.steps) || !recipe.steps.length) return null;
  return { bean, recipe };
}

export function mergeScreenData(previous, next) {
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
  if (!['bean-required', 'bean-unavailable', 'recipe-unavailable', 'record-unavailable', 'invalid-input'].includes(error?.code)) return null;
  return { beans: [], recipes: [], records: [], excluded: {},
    screen: { route, error: error.code === 'invalid-input' ? 'bean-unavailable'
      : error.code === 'record-unavailable' ? 'record-unavailable' : error.code,
      nextCursor: null, hasMore: false, complete: true } };
}

function optionWithSelectedItem(page, item, kind) {
  if (!item || page.items.some(option => option.id === item.id)) return page;
  return { ...page, items: [{ id: item.id, name: item.name,
    ...(kind === 'recipes' ? { beanId: item.beanId } : {}), status: 'ready' }, ...page.items] };
}

export async function fetchScreen(repository, route, { cursor = null, signal, previousData, reusedBrewSelection,
  readFormOptions, getRecordFilters, readComparisonPair, readCachedFilterOptions } = {}) {
  const { path, params } = routeLocation(route);
  const [section, id] = path.split('/').filter(Boolean);
  const query = params.get('q')?.trim() ?? '';
  const favoriteOnly = params.get('favorite') === 'true';
  const pageOptions = { cursor, limit: SCREEN_PAGE_SIZE, signal };

  if (!section || section === 'home') {
    return { beans: [], recipes: [], records: [], excluded: {},
      screen: { route, nextCursor: null, hasMore: false, complete: true } };
  }
  if (section === 'brew' && id === 'bean') {
    const page = await repository.listBeans({ ...pageOptions, query, favoriteOnly });
    return { beans: page.items, recipes: [], records: [], excluded: {},
      screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
  }
  if (section === 'brew' && id === 'recipe') {
    const beanId = params.get('beanId');
    if (!beanId) return unavailableScreen(route, { code: 'bean-unavailable' });
    try {
      const [bean, page] = await Promise.all([
        repository.getBean(beanId, { signal }),
        repository.listRecipeSummaries({ ...pageOptions, query, favoriteOnly }),
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
    const recordId = params.get('recordId');
    if (recordId) {
      try {
        const record = await repository.getRecord(recordId, { signal });
        if (!record || record.snapshotStatus !== 'valid' || record.beanResolution === 'needs-confirmation' ||
            !record.beanId || (beanId && beanId !== record.beanId)) {
          return unavailableScreen(route, { code: 'record-unavailable' });
        }
        const bean = await repository.getBean(record.beanId, { signal });
        const recipe = record.snapshot?.version >= 2 ? record.snapshot.recipe
          : record.snapshot?.version === 1 ? record.snapshot : null;
        if (!Array.isArray(recipe?.steps) || !recipe.steps.length) {
          return unavailableScreen(route, { code: 'record-unavailable' });
        }
        return { beans: [bean], recipes: [recipe], records: [record], excluded: {},
          screen: { route, nextCursor: null, hasMore: false, complete: true } };
      } catch (error) {
        const unavailable = unavailableScreen(route, error);
        if (unavailable) return unavailable;
        throw error;
      }
    }
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
    const page = await repository.listBeans({ ...pageOptions, query, favoriteOnly });
    return { beans: page.items.map(bean => ({ ...bean, recordCount: { status: 'loading', count: null } })),
      recipes: [], records: [], excluded: {}, screen: { route, nextCursor: page.nextCursor,
        hasMore: page.hasMore, complete: page.complete } };
  }
  if (section === 'beans' && id) {
    const bean = cursor && previousData?.screen?.route === route
      ? previousData.beans.find(item => item.id === id) ?? await repository.getBean(id, { signal })
      : await repository.getBean(id, { signal });
    const [page, best] = await Promise.all([
      repository.listRecords({ beanId: id, ...pageOptions }),
      typeof repository.resolveBeanBestRecord === 'function'
        ? repository.resolveBeanBestRecord(bean, { signal })
        : Promise.resolve({ status: bean.bestRecordStatus ?? 'unsupported', record: null }),
    ]);
    const beanWithBest = { ...bean, bestRecordStatus: best.status, bestRecord: best.record };
    return { beans: [beanWithBest], recipes: page.recipes, records: page.items, excluded: {},
      screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
  }
  if (section === 'recipes' && !id) {
    const page = await repository.listRecipeSummaries({ ...pageOptions, query, favoriteOnly });
    return { beans: [], recipes: page.items, records: [], excluded: {},
      screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
  }
  if (section === 'recipes' && id && id !== 'new') {
    const detail = cursor && previousData?.screen?.route === route
      ? previousData.recipes.find(item => item.id === id) ?? await repository.getRecipeDetail(id, { signal })
      : await repository.getRecipeDetail(id, { signal });
    const page = await repository.listRecords({ recipeId: id, ...pageOptions });
    return { beans: page.beans, recipes: [detail, ...page.recipes.filter(item => item.id !== detail.id)],
      records: page.items, excluded: {},
      screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
  }
  if (section === 'records' && id === 'new') {
    const beanId = params.get('beanId');
    const recipeId = params.get('recipeId');
    if (recipeId && !beanId) return unavailableScreen(route, { code: 'bean-required' });
    let selectedBean = reusedBrewSelection?.bean ?? null;
    let selectedRecipe = reusedBrewSelection?.recipe ?? null;
    if (!reusedBrewSelection) {
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
    if (reusedBrewSelection) {
      return { beans: [selectedBean], recipes: [selectedRecipe], records: [], excluded: {},
        screen: { route, nextCursor: null, hasMore: false, complete: true } };
    }
    const beanOptions = await readFormOptions('beans', signal);
    const recipeOptions = await readFormOptions('recipes', signal);
    const selectedBeans = optionWithSelectedItem(beanOptions, selectedBean, 'beans');
    const selectedRecipes = optionWithSelectedItem(recipeOptions, selectedRecipe, 'recipes');
    return { beans: selectedBeans.items, recipes: selectedRecipes.items, records: [], excluded: {},
      options: { beans: selectedBeans, recipes: selectedRecipes },
      screen: { route, nextCursor: null, hasMore: false, complete: true } };
  }
  if (section === 'records') {
    const page = await repository.listRecords({ ...getRecordFilters(), ...pageOptions });
    const comparison = await readComparisonPair(page.items, route, signal);
    const recordFilters = getRecordFilters();
    const result = { beans: page.beans, recipes: page.recipes, records: comparison.items,
      comparisonBeanId: comparison.beanId, excluded: {},
      screen: { route, filters: { ...recordFilters }, nextCursor: page.nextCursor,
        hasMore: page.hasMore, complete: page.complete } };
    const filterBeans = readCachedFilterOptions('beans', page.beans, recordFilters.beanId);
    const filterRecipes = readCachedFilterOptions('recipes', page.recipes, recordFilters.recipeId);
    if (filterBeans || filterRecipes) result.options = { filterBeans, filterRecipes };
    return result;
  }
  if (section === 'recipes' && id === 'new') {
    const page = await repository.listRecipeSummaries({ ...pageOptions, query, favoriteOnly });
    return { beans: [], recipes: page.items, records: [], excluded: {},
      screen: { route, nextCursor: page.nextCursor, hasMore: page.hasMore, complete: page.complete } };
  }
  return { beans: [], recipes: [], records: [], excluded: {},
    screen: { route, nextCursor: null, hasMore: false, complete: true } };
}
