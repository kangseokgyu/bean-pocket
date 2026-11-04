# Recipe exploration implementation plan

## Goal and confirmed product decisions

For each bean, a person can change a full set of brew conditions for each extraction, save the actual conditions in an immutable record snapshot, compare same-bean records by conditions and evaluation, choose one best record, and save useful conditions as a shared recipe. Decimal ratings and the current record generation remain supported. Old public Node UI requests continue to work.

The agreed model is `BrewDraft { beanId, sourceRecipeId?, sourceRecordId?, actualRecipe }`, where `actualRecipe` is a complete validated recipe-shaped value with derived stages. A saved record stores a versioned snapshot containing the bean, actual recipe, source recipe ID, and source record ID. It never stores only a diff and never replaces the draft with a live recipe reread. A missing source recipe relation is allowed when replaying an old record whose shared recipe was deleted; the historical source ID remains in the snapshot.

The best extraction is a 0/1 relation on each bean to a record. Because Notion relation `single_property` does not enforce one-item cardinality, application reads preserve all IDs and report an invalid multi-item state. A record must belong to the same bean. Missing schema disables only the best-setting feature and explains how to add the property. No automatic best calculation is used.

## Source grounding

- `lib/domain.mjs`: `validateRecipe` enforces first stage at 0 seconds, increasing times, positive pours, total water equality, and `validateRecord` keeps 0.1-point ratings.
- `pwa/commands/index.mjs`: `prepareRecord` currently accepts bean/recipe IDs; `execute` rereads the latest shared recipe and snapshots it. This is the fixed-condition behavior to replace for the PWA while keeping the old command contract.
- `pwa/data/read-repository.mjs`: `readSnapshot` currently accepts v1/v2 and validates the snapshot recipe ID against the relation ID; current records require `bagless-v1`. Existing record reads retain snapshots if the recipe was deleted.
- `pwa/state/submission-state.mjs`: writes are journaled before dispatch, created page IDs and archive targets are read back, and unknown writes block later writes until fresh resolution. Best relation updates need the same durable, uncertain-write treatment.
- `pwa/data/notion-properties.mjs` and `pwa/data/notion-client.mjs`: schemas and create payload validation are centralized here. Optional missing properties must not break reads or other writes.
- `server.mjs`: `/api/records` currently snapshots the live recipe. Add shared validation for optional full actual conditions while preserving the legacy body.
- `pwa/ui/view.mjs`, `pwa/ui/controller.mjs`, `pwa/ui/records-insights*.mjs`: brew run is currently read-only, record form saves evaluation, and record insights already compare same-bean ratings.
- `pwa/sw.js`: explicit app-file allowlist; keep the implementation in existing modules unless a new module's builder/checker/service-worker entries can all be updated.

## Architect phases

### Ground

Confirmed from source: the app already has a complete recipe validator, decimal rating validation, a snapshot reader with strict source-ID matching, record-generation filtering, journaled writes, and existing same-bean insight comparison. The fixed behavior is localized in `commands.execute(records)` and `renderBrewRun`: the former overwrites draft values by rereading a shared recipe; the latter displays recipe values without editing controls.

### Sketch

Two storage shapes were considered:

| Shape | Advantages | Costs and risks |
| --- | --- | --- |
| Copy each variation into a new shared recipe, then point a record at it | Reuses recipe relation and existing recipe editor | Pollutes the shared recipe list for every extraction; couples evaluation to template creation; still needs an actual-at-save snapshot to preserve historical conditions |
| Store a complete actual-condition snapshot on every record, with source recipe and source record provenance | Keeps each extraction self-contained; supports replay after source deletion; shared template remains unchanged; comparison uses actual values | Requires an explicit snapshot version and reader compatibility; source relation can be absent while the stored historical source ID remains |

### Agree

Use the complete actual-condition snapshot. Keep the existing record `recipeId` relation when the source template still exists. In the new snapshot, set `recipe.id` to the historical source ID (or `null` for a brew without a template) and validate it against an explicit `source.recipeId`. The record reader accepts a null relation only when it can validate the versioned snapshot; if a relation exists, it must match. This keeps `record.recipeId` as the origin recipe for existing statistics while preserving full actual values for replay and comparison. Label those statistics as evaluations of brews that started from a recipe because conditions can vary.

Keep record creation, best selection, and shared recipe creation as independent operations. A successful record is never rolled back because a later best or template action fails. The bean relation stores zero or one record ID; malformed multiple IDs and inaccessible or missing records show explicit states.

### Implement

Implement in small verified units: (1) v3 domain snapshot plus legacy API contract tests, (2) repository compatibility and actual-condition command tests, (3) PWA adjustment/replay/evaluation/comparison flow, (4) best relation status/update and explicit migration script, (5) documents, browser scenario, and full checks. Keep current PWA modules to avoid a new allowlist surface.

### Scrap

Discarded per-extraction shared-recipe copies and diff-only snapshots. Diff-only replay would depend on a mutable recipe still existing and could not restore a deleted source. Per-extraction copies would make the shared library noisy and tie record persistence to two writes.

## Throughput checkpoint

- [ ] **Blocking first steps.** Re-ground current source and create behavior tests before edits; prove the missing behavior is the failure cause. Domain snapshot and journal contracts gate the UI flow.
- [ ] **Independent workstreams.** No safe parallel implementation streams: the same snapshot shape crosses domain, repository, command, server, and UI; best updates share the write journal. Work in serial units.
- [ ] **Shared mutable state.** `submission-journal.json` and Notion records/beans are shared persistent state. Keep all writes under the existing lock and journal; do not mutate live Notion schemas in this worktree.
- [ ] **Smallest safe decomposition.** One worker owns the cohesive diff because the project policy forbids nested agents and the data contract must be consistent across every caller. Parent owns independent Critic review, real migration execution, commit, merge, and deploy.

## Feature workflow steps

1. `how` over the affected subsystem: completed for domain, read repository, command, write journal, PWA UI, and legacy `/api/records`.
2. `architect` for parallel design exploration: sequential Ground/Sketch/Agree/Implement/Scrap completed. The project forbids subagents, so design alternatives were compared directly rather than in parallel.
3. Throughput checkpoint: recorded above; revisit at each unit boundary.
4. Delegate code-writing to a subagent: project policy forbids worker subagents; this worker owns the full connected diff and records that review separation is assigned to the parent Critic.
5. Verify on the matching surface: run focused Node tests, a Playwright browser fixture at 390 px and 1440 px, then the required test/build/page checks.
6. Rebase into small, ordered commits: parent owns all commits and branch integration for this task; this worker leaves the worktree uncommitted and records validation evidence.
7. Contested design review: not applicable. The actual-snapshot choice was confirmed by the user; a critic will review the migration script and full diff after this worker finishes.
8. Opening a PR: parent owns PR and integration; no PR is opened by this worker.

## Validation and evidence

- Focused `node --test` red/green runs, including v1/v2/v3 read compatibility, edited actual snapshots and replay, source deletion, condition deltas, same-bean best validation, malformed/missing best relation, and the legacy server route.
- Playwright browser fixture: edit conditions, rate and note, replay, compare, set best, and save a shared recipe at 390 px and 1440 px.
- Final checks: `npm test`, `npm run build:pages`, `npm run check:pages`, `git diff --check`. Preserve commands, exit codes, concise output, and blockers in `verification.md`.
- `migrate-best-record-relation.mjs` is idempotent and requires explicit `--apply`; it preserves and rereads the existing schema. Do not run it here. Parent performs test/operating dry-runs, review, and any authorized application.

## Decisions requiring parent follow-up

- Parent runs the schema migration only after script review; this worker will not access or print private credentials or source IDs.
- Parent owns Critic review, commit, push, merge, publication, and public URL/build confirmation under project policy.
