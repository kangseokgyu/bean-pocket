const SCREEN_CACHE_TTL_MS = 60000;

export function routeCacheKey(revision, route, recordFilters, cursor = null) {
  const query = route.startsWith('/records') ? recordFilters : {};
  return [revision ?? 'disconnected', route, JSON.stringify(query), cursor ?? 'first'].join('|');
}

export function optionCacheKey(revision, target, kind, query, favoriteOnly, cursor) {
  return [revision, target, kind, query, favoriteOnly, cursor ?? 'first'].join('|');
}

export function readCache(cache, key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.savedAt > SCREEN_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function saveCache(cache, key, value) {
  cache.set(key, { value, savedAt: Date.now() });
}

export function invalidateRecordList(screenCache) {
  for (const key of screenCache.keys()) if (key.includes('|/records|')) screenCache.delete(key);
}

export function invalidateReadCaches(screenCache, optionCache, kind) {
  if (kind === 'favorite-bean' || kind === 'favorite-recipe') {
    const target = kind === 'favorite-bean' ? 'beans' : 'recipes';
    for (const key of screenCache.keys()) if (key.includes(`|/${target}`) || key.includes('|/brew')) screenCache.delete(key);
    for (const key of optionCache.keys()) if (key.includes(`|${target}|`)) optionCache.delete(key);
    return;
  }
  if (kind === 'beans') {
    for (const key of screenCache.keys()) if (key.includes('|/beans')) screenCache.delete(key);
    for (const key of optionCache.keys()) if (key.includes('|beans|')) optionCache.delete(key);
  } else if (kind === 'recipes' || kind === 'copy' || kind === 'delete-recipe') {
    for (const key of screenCache.keys()) if (key.includes('|/recipes') || key.includes('|/records')) screenCache.delete(key);
    for (const key of optionCache.keys()) if (key.includes('|recipes|')) optionCache.delete(key);
  } else if (kind === 'records' || kind === 'delete-record') {
    for (const key of screenCache.keys()) if (key.includes('|/records') || key.includes('|/beans') || key.includes('|/recipes/')) screenCache.delete(key);
  } else if (kind === 'delete-bean') {
    for (const key of screenCache.keys()) if (key.includes('|/beans') || key.includes('|/records')) screenCache.delete(key);
    for (const key of optionCache.keys()) if (key.includes('|beans|')) optionCache.delete(key);
  }
}
