# Independent recipe edit review

Approved: no blocking correctness findings on integrated commit `20bb4c519f4e746fd0116be9c61c7fc45277b4fa` (feature `0893446`, merged with current main `3e7f901`). Critic reviewed product changes without changing product code. Applied the local `principle-prove-it-works` skill.

Reviewed editable field allowlists, recipe and step identity, relation/favorite preservation, historical snapshot isolation, fresh baseline comparison, per-page durable processing and outcome ledger, partial/unknown write blocking, exact before/after recovery, independent ledger-page reads, draft keys, dirty cancel, cache invalidation, and build/SW module lists. Notion has no transactional conditional multi-page writes; the feature detects stale reads and blocks incomplete outcomes for manual repair.

Real `/usr/bin/chromium`, controlled by installed Playwright-core, ran against the actual view/controller/commands/client/repository/state modules and the repository's fake Notion + in-memory native platform. Both 390×844 mobile and 1440×1000 desktop passed:

- Entry from recipe detail with prefilled fields and three existing steps.
- Dirty cancellation: continue editing retains changes; discard restores the original value.
- Route navigation preserves the same recipe's draft and step IDs.
- Editing name, equipment, grind, microns and guide, removing an existing step, adding a new step, and saving succeeds with four confirmed ledger entries.
- Recipe identity, existing relation/favorite property values, and the historical record page remain unchanged.
- A concurrent remote rename rejects submission with zero page writes.
- No page JavaScript errors or horizontal overflow. Edit and success screenshots were inspected.

An additional real-browser fault injection passed both recovery paths. A saved PATCH with lost response recorded `unknown`; an attempted retry was blocked with `unresolved-operation`; exact-after fresh read resolved `succeeded`. A PATCH that never persisted also recorded `unknown`; exact-before fresh read resolved `failed`. Recovery issued zero writes. See `recovery-results.json`.

Rerun from repository root:

```sh
node docs/evidence/recipe-edit-critic-20261106/server.mjs "$PWD" "$PWD"
node docs/evidence/recipe-edit-critic-20261106/browser.mjs
node docs/evidence/recipe-edit-critic-20261106/recovery.mjs
```

The server binds localhost port4216 only. Browser scripts use `/opt/codex/cua_node/lib/node_modules/playwright-core/index.mjs`. `results.json`, `recovery-results.json`, and screenshots retain independent observations. Scripts write only evidence files.

Limits: no live Notion workspace was modified. Native OPFS/locks are in-memory fixture implementations in this harness. Recovery through controller/state/client is browser-tested; recovery form wording and per-page/mixed-state checks were independently source-reviewed. Service-worker installation/offline update was not rerun; module supply was reviewed and root separately ran the integrated 750-test suite, build (`c9be31d14d6f`), and Pages checker. No redundant full-suite run by Critic.

## Number-shortcut merge re-review

Approved `3e0a2f2fcda06da7337837861f4b671a5bbfc25e`, merging remote main `482bc70` with recipe number shortcuts. No blockers. The narrow conflict-resolution review confirmed shortcut generation and bubbling input events coexist with edit identity, prefill, labels and step IDs. No product files were changed by Critic.

Reran the mobile and desktop Chromium workflows using `browser-remerge.mjs`. Both passed all prior save/cancel/draft/stale/snapshot checks, plus real clicks on dose, temperature and water shortcuts. Clicking a shortcut set the corresponding input and marked the recipe-specific edit dirty. Each save had four confirmed ledger pages; no JavaScript errors or horizontal overflow occurred. New screenshots (`*-remerge-*.png`) were inspected; `remerge-results.json` records results.

Root separately reported 751 integrated tests passed, Pages build `d1e2c5b717d2`, and Pages checker passed. No full-suite or unchanged recovery rerun was needed for this narrow form/style merge.
