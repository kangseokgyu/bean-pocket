# Recipe editing evidence

Recipe editing is complete when the existing recipe page keeps its ID, favorite and legacy relation while its editable fields and steps change. Historical record snapshots stay unchanged. A stale baseline or a partial Notion write never silently overwrites another state.

The implementation is split into four verifiable units:

1. Command and client writes for the recipe page and existing step pages.
2. A durable edit journal with fresh-read recovery for exact before and after states.
3. Edit-mode form state keyed by recipe ID, with dirty cancel confirmation.
4. Cache invalidation for recipe detail, recipe lists, and brew choices.

The feature keeps the recipe ID, favorite checkbox, legacy bean relation and historical record snapshots unchanged. Edit writes compare the latest full recipe before dispatch and verify every write afterward. Because Notion updates span multiple pages, the journal records each update/archive/create separately; it does not claim atomic writes. Recovery accepts only an exact full before or after recipe plus independent verification of every affected page and the active step set. Mixed state stays blocked for manual repair.

Validation completed on 2026-11-06: `npm test` passed 791/791; `npm run build:pages` produced build `259d7eb22723`; `npm run check:pages` passed. The focused suites cover command/client/journal behavior, edit form drafts and cancel confirmation, successful controller write/readback, and unknown/partial recovery including stray-step and per-page status checks. Initial red evidence is retained in `red-command-test.txt` and `red-journal-test.txt`. Browser behavior was independently checked by the Critic.

After integrating latest main (`3e7f901`) as `20bb4c5`, all 750 remaining tests passed (legacy server tests were removed upstream), followed sequentially by Pages build `c9be31d14d6f` and artifact validation. Independent Critic review approved this integrated source, including Chromium mobile/desktop editing and injected lost-response recovery. See [Critic evidence](../recipe-edit-critic-20261106/README.md). Worker used `gpt-6-luna` / `max`; Critic used `gpt-6.1-sol` / `medium`. Live Notion writes and physical iPhone Safari were not tested.

## Publication

After the final main integration (`482bc70`, number shortcuts), the resolved source `3e0a2f2` passed 751 tests, Pages build `d1e2c5b717d2`, and artifact checks. Independent Chromium mobile/desktop reruns approved both edit behavior and shortcut dirty tracking. The docs-only review commit `72a67ce` was pushed to main and [Pages run 42242728761](https://github.com/kangseokgyu/bean-pocket/actions/runs/42242728761) succeeded with `probes=false`. [Public file verification](public-files.json) confirms every published file matches the validated local artifact at https://kangseokgyu.github.io/bean-pocket/. [Deployment result](deployment.json) records the CI test, build, artifact check, and deploy results. Live Notion, native OPFS persistence, and physical iPhone Safari were not tested.

## Test-first evidence

The first command-level regression test was added before production changes. `node test/pwa-commands.test.mjs` failed because `prepareEditRecipe` was not present. The failure and the other two intended missing-command cases are captured in `red-command-test.txt`.
