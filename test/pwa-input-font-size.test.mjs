import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

for (const page of ['index.html', 'brew-picker-demo.html']) {
  test(`${page} caps automatic focus magnification at the initial viewport scale`, async () => {
    const html = await readFile(new URL(`../pwa/${page}`, import.meta.url), 'utf8');
    const viewport = html.match(/<meta name="viewport" content="([^"]+)">/)?.[1];
    assert.ok(viewport, 'page has a viewport declaration');
    const settings = new Map(viewport.split(',').map(setting => setting.trim().split('=')));
    assert.equal(Number(settings.get('initial-scale')), 1);
    assert.equal(Number(settings.get('maximum-scale')), 1);
  });
}
