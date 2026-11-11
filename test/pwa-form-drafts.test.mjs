import test from 'node:test';
import assert from 'node:assert/strict';
import { createFormDraftStore } from '../pwa/state/form-drafts.mjs';
import { memoryFormDraftStorage } from './fixtures/form-draft-storage.mjs';

const REVISION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REVISION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TARGET_A = 'a'.repeat(64);
const TARGET_B = 'b'.repeat(64);
const scopeA = { revision: REVISION_A, targetFingerprint: TARGET_A };

const recipeDraft = {
  values: { name: '아침 레시피', extractionGuide: '천천히 붓기' },
  steps: [{ stepName: '뜸', time: '0:30', water: '50' }],
  copyId: null,
  route: '/recipes',
};

test('form drafts survive a new store instance for the same connection generation and target', async () => {
  const storage = memoryFormDraftStorage();
  const store = createFormDraftStore({ storage, locks: null });
  assert.equal(await store.save(scopeA, 'recipes', recipeDraft), true);

  const restored = await createFormDraftStore({ storage, locks: null }).read(scopeA);
  assert.deepEqual(restored.get('recipes'), recipeDraft);
});

test('form drafts are isolated by both connection generation and data-source target', async () => {
  const storage = memoryFormDraftStorage();
  const store = createFormDraftStore({ storage, locks: null });
  await store.save(scopeA, 'recipes', recipeDraft);

  assert.equal((await store.read({ revision: REVISION_B, targetFingerprint: TARGET_A })).size, 0);
  assert.equal((await store.read({ revision: REVISION_A, targetFingerprint: TARGET_B })).size, 0);
});

test('explicit removal deletes only the selected form draft', async () => {
  const storage = memoryFormDraftStorage();
  const store = createFormDraftStore({ storage, locks: null });
  await store.save(scopeA, 'beans', { values: { name: '원두 초안' }, steps: [] });
  await store.save(scopeA, 'recipes', recipeDraft);

  assert.equal(await store.remove(scopeA, 'recipes'), true);
  const remaining = await store.read(scopeA);
  assert.deepEqual([...remaining.keys()], ['beans']);
});

test('draft edit markers roundtrip and reject malformed values', async () => {
  const storage = memoryFormDraftStorage();
  const store = createFormDraftStore({ storage, locks: null });
  const edited = { ...recipeDraft, edited: true };

  assert.equal(await store.save(scopeA, 'recipes', edited), true);
  assert.equal((await createFormDraftStore({ storage, locks: null }).read(scopeA)).get('recipes').edited, true);
  await assert.rejects(store.save(scopeA, 'beans', {
    values: { name: 'invalid marker' }, steps: [], edited: 'true',
  }), /draft/i);
});

test('credentials cannot enter a draft scope or persisted form values', async () => {
  const storage = memoryFormDraftStorage();
  const store = createFormDraftStore({ storage, locks: null });

  await assert.rejects(store.read({ ...scopeA, token: 'test-only-credential' }), /scope/i);
  await assert.rejects(store.save(scopeA, 'connection', {
    values: { token: 'test-only-credential' }, steps: [],
  }), /draft/i);
  await store.flush();
  assert.equal([...storage.files.values()].some(value => value.includes('test-only-credential')), false);
});
