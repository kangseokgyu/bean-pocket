# Recipe editing evidence

Recipe editing is complete when the existing recipe page keeps its ID, favorite and legacy relation while its editable fields and steps change. Historical record snapshots stay unchanged. A stale baseline or a partial Notion write never silently overwrites another state.

The implementation is split into four verifiable units:

1. Command and client writes for the recipe page and existing step pages.
2. A durable edit journal with fresh-read recovery for exact before and after states.
3. Edit-mode form state keyed by recipe ID, with dirty cancel confirmation.
4. Cache invalidation for recipe detail, recipe lists, and brew choices.

The full completion predicate is `npm test`, `npm run build:pages`, and `npm run check:pages` passing after the complete feature is implemented. Browser behavior is independently checked by the parent agent.

## Test-first evidence

The first command-level regression test was added before production changes. `node test/pwa-commands.test.mjs` failed because `prepareEditRecipe` was not present. The failure and the other two intended missing-command cases are captured in `red-command-test.txt`.
