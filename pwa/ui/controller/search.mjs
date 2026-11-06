import { optionCacheKey, readCache, saveCache } from './cache.mjs';
import { SCREEN_PAGE_SIZE } from './loader.mjs';

export async function readOptionPage(repository, cache, revision, { target, kind, query, cursor, signal }, isCurrent) {
  const key = optionCacheKey(revision, target, kind, query, false, cursor);
  if (cursor == null) {
    const cached = readCache(cache, key);
    if (cached) return cached;
  }
  const result = await repository.searchOptions({ kind, query, cursor, limit: SCREEN_PAGE_SIZE, signal });
  if (!isCurrent() || signal?.aborted) return result;
  saveCache(cache, key, result);
  return result;
}

export function cachedFilterOptions(cache, revision, kind, relatedRows, selectedId) {
  const prefix = [revision, 'filters', kind, ''].join('|');
  const first = readCache(cache, optionCacheKey(revision, 'filters', kind, '', false, null));
  if (!first) return null;
  const items = [...first.items];
  if (selectedId && !items.some(item => item.id === selectedId)) {
    const cached = [...cache.entries()].find(([key, entry]) => key.startsWith(prefix) &&
      entry.value.items.some(item => item.id === selectedId))?.[1]?.value.items.find(item => item.id === selectedId);
    const related = relatedRows.find(item => item.id === selectedId);
    const selected = cached ?? (related ? { id: related.id, name: related.name, status: 'ready' } : null);
    if (selected) items.push(selected);
  }
  return { ...first, items };
}

export async function loadSearchOptions(cache, { revision, target, kind, query, favoriteOnly, cursor, append },
  { search, isCurrent, showPage, showState, reportError }) {
  const key = optionCacheKey(revision, target, kind, query, favoriteOnly, cursor);
  const cached = !append && readCache(cache, key);
  if (cached) {
    showPage(target, kind, cached, false, query);
    return cached;
  }
  showState(target, kind, { status: 'loading', query, append });
  try {
    const result = await search({ kind, query, favoriteOnly, cursor, limit: SCREEN_PAGE_SIZE });
    if (!isCurrent()) return null;
    saveCache(cache, key, result);
    showPage(target, kind, result, append, query);
    return result;
  } catch (error) {
    if (!isCurrent()) return null;
    if (error?.code === 'read-cancelled') {
      showState(target, kind, { status: 'idle', query, append });
      return null;
    }
    showState(target, kind, { status: 'error', query, append });
    reportError(error);
    return null;
  }
}
