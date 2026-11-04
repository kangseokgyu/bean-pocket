// Synthetic repository query-count probe; no network and no timing claims.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const baselineRef = '93f2c65b55c56eb62b35811377cd39a9cf36bba0';
const baseline = await mkdtemp(path.join(tmpdir(), 'favorite-request-baseline-'));
try {
  for (const file of ['pwa/data/read-repository.mjs', 'pwa/data/notion-properties.mjs', 'pwa/domain.mjs', 'lib/domain.mjs']) {
    const destination = path.join(baseline, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, execFileSync('git', ['show', `${baselineRef}:${file}`], { cwd: root }));
  }
  const sides = {};
  for (const [side, dir] of [['trunk', baseline], ['head', root]]) {
    sides[side] = {
      ...await import(pathToFileURL(path.join(dir, 'pwa/data/read-repository.mjs'))),
      ...await import(pathToFileURL(path.join(dir, 'pwa/data/notion-properties.mjs'))),
    };
  }
  const sources = Object.fromEntries(['beans', 'recipes', 'steps', 'records'].map((kind, index) =>
    [kind, `a1111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`]));
  const measurements = [];
  for (let run = 1; run <= 5; run++) {
    for (const [side, favoriteOnly] of [['trunk', false], ['head', false], ['head', true]]) {
      const { encodeProperties, createReadRepository } = sides[side];
      const calls = [];
      const rows = Array.from({ length: 20 }, (_, index) => ({
        object: 'page', id: `b1111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
        parent: { type: 'data_source_id', data_source_id: sources.beans }, archived: false, in_trash: false,
        last_edited_time: '2026-11-03T00:00:00.000Z',
        properties: Object.fromEntries(Object.entries(encodeProperties('beans', { name: `Bean ${index}`, favorite: true }))
          .map(([name, value]) => [name, { type: Object.keys(value)[0], ...value }])),
      }));
      const repository = createReadRepository({ dataSources: sources,
        async queryAll() { throw new Error('unexpected full query'); },
        async getPage() { throw new Error('unexpected per-item read'); },
        async queryPage(kind, options) {
          calls.push({ kind, filter: options.filter ?? null });
          return { items: rows, nextCursor: null, hasMore: false, complete: true };
        },
      });
      const result = await repository.listBeans({ limit: 20, favoriteOnly });
      assert.equal(result.items.length, 20);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].filter, favoriteOnly ? { property: '즐겨찾기', checkbox: { equals: true } } : null);
      if (side === 'head') assert.ok(result.items.every(item => item.favorite === true));
      measurements.push({ run, side, favoriteOnly, rows: result.items.length, queries: calls.length, errors: 0 });
    }
  }
  console.log(JSON.stringify({ baselineCommit: baselineRef, measurements }, null, 2));
} finally {
  await rm(baseline, { recursive: true, force: true });
}
