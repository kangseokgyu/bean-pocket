import test from 'node:test';
import assert from 'node:assert/strict';
import { invalidateReadCaches, optionCacheKey, readCache, routeCacheKey, saveCache } from '../pwa/ui/controller/cache.mjs';
import { fetchScreen, mergeScreenData, routeSchemas } from '../pwa/ui/controller/loader.mjs';

test('controller read caches separate revision, filter, cursor, and favorite scopes', t => {
  let now = 100;
  t.mock.method(Date, 'now', () => now);
  const screens = new Map();
  const options = new Map();
  const records = routeCacheKey('r1', '/records', { beanId: 'bean', recipeId: '' });
  const route = routeCacheKey('r1', '/brew/bean', {});
  const favoriteOptions = optionCacheKey('r1', 'brew', 'beans', '', true, null);
  const allOptions = optionCacheKey('r1', 'brew', 'beans', '', false, null);
  const result = { items: [{ id: 'bean' }] };
  saveCache(screens, records, result);
  saveCache(screens, route, result);
  saveCache(options, favoriteOptions, result);

  now += 60000;
  assert.equal(readCache(screens, records), result);
  assert.equal(readCache(screens, routeCacheKey('r2', '/records', { beanId: 'bean', recipeId: '' })), null);
  assert.equal(readCache(screens, routeCacheKey('r1', '/records', { beanId: '', recipeId: '' })), null);
  assert.equal(readCache(screens, routeCacheKey('r1', '/records', { beanId: 'bean', recipeId: '' }, 'next')), null);
  assert.equal(readCache(options, favoriteOptions), result);
  assert.equal(readCache(options, allOptions), null);
  invalidateReadCaches(screens, options, 'favorite-bean');
  assert.equal(readCache(screens, route), null);
  assert.equal(readCache(options, favoriteOptions), null);
  assert.equal(readCache(screens, records), result);

  now += 1;
  assert.equal(readCache(screens, records), null);
  assert.equal(screens.has(records), false, 'an expired page is discarded');
});

test('recipe edit invalidates detail, list, brew, record, and recipe option caches', () => {
  const screens = new Map();
  const options = new Map();
  for (const route of ['/recipes', '/recipes/recipe-id', '/brew/recipe', '/records']) {
    const key = routeCacheKey('revision', route, {});
    saveCache(screens, key, { route });
  }
  const recipeOptions = optionCacheKey('revision', 'form', 'recipes', '', false, null);
  saveCache(options, recipeOptions, { items: [] });

  invalidateReadCaches(screens, options, 'edit-recipe');

  assert.equal(screens.size, 0, 'recipe detail/list, brew options, and history views are refreshed');
  assert.equal(options.size, 0, 'recipe selectors are refreshed');
});

test('screen loader forwards brew search and pagination and preserves the first copy on append', async () => {
  const route = '/brew/bean?q=%20kenya%20&favorite=true';
  const signal = new AbortController().signal;
  const request = [];
  const repository = {
    async listBeans(options) {
      request.push(options);
      return { items: [{ id: 'first', name: 'duplicate' }, { id: 'second' }],
        nextCursor: null, hasMore: false, complete: true };
    },
  };
  assert.deepEqual(routeSchemas(route), ['beans']);
  const fetched = await fetchScreen(repository, route, { cursor: 'next', signal });
  assert.deepEqual(request, [{ cursor: 'next', limit: 20, signal, query: 'kenya', favoriteOnly: true }]);
  const first = { id: 'first', name: 'original' };
  const combined = mergeScreenData({ beans: [first] }, { ...fetched, screen: { ...fetched.screen, append: true } });
  assert.deepEqual(combined.beans, [first, { id: 'second' }]);
  assert.deepEqual(combined.screen, { route, nextCursor: null, hasMore: false, complete: true, append: false });
});
