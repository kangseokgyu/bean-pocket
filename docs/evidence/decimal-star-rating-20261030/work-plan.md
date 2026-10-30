# Decimal star rating work plan

## Feature playbook

- [x] `how` over the affected subsystem.
- [ ] `architect` for parallel design exploration. `skip: extra subagents are prohibited; compare two candidates in this worker.`
- [x] Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
  - **Blocking first steps.** Gates run before fan-out.
  - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
  - **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants.
  - **Smallest safe decomposition.** If one worker is best, name why.
- [x] Verify on the matching surface in Chrome using the public flow and PWA `createAppView` form.
- [ ] Rebase into small, ordered commits. Stack follow-ups. `the requested sequence was feature commit 0897e70 followed by merging current main; main merge/publish remains orchestrator-owned.`
- [ ] If the design is contested, `interrogate` before shipping. `skip: two candidates resolve locally; no unresolved design question.`
- [ ] Run **Opening a PR**. `skip: orchestrator owns merge and publishing; worker was told not to commit.`

## Architect phases

- [x] Ground
- [x] Sketch
- [x] Agree
- [x] Implement
- [ ] Scrap

## Throughput checkpoint

- **Blocking first steps.** Trace validation, persistence, draft restoration, statistics and rendering; write regression tests before production changes.
- **Independent workstreams.** `n/a: one cross-cutting rating value must stay consistent across view, domain, reads, and analytics.`
- **Shared mutable state.** Keep one rating value on the form input and one active `pointerId` in its controller closure; no shared writer.
- **Smallest safe decomposition.** One worker owns the connected behavior so every consumer uses the same decimal-rating invariant.

## How the affected subsystem works

The record form in `pwa/ui/view.mjs` submits the named rating control through `FormData`. `pwa/ui/controller.mjs` passes that payload to the commands layer. `pwa/commands/index.mjs` validates the rating in `lib/domain.mjs`, creates a record snapshot, then the Notion properties map stores it as a number. `pwa/data/read-repository.mjs` decodes that number, marks rating validity, and calculates recipe averages through the same domain module. `pwa/ui/records-insights.mjs` separately filters valid ratings and calculates bean averages, comparisons, rankings, and chart coordinates; `records-insights-view.mjs` renders those values. The `/` surface is a second UI in `public/app.js` that also uses `lib/domain.mjs` and can read the same persisted records.

The existing UI has five required integer radios. Persisted rating validation and all three stats paths require integers; the insight chart also uses a 1-to-5 vertical scale. Drafts read `form.elements.rating.value` and restore it to the control, so preserving one named rating input keeps draft behavior intact.

## Design choice

| Candidate | Advantages | Costs |
| --- | --- | --- |
| Native range input, min 0 as empty sentinel | Native slider semantics, keyboard support, simple continuous track | A browser range cannot be blank. Every draft, submission, required check, and clear path must translate sentinel `0` back to `''`. |
| Required decimal number input over a custom five-star surface | Keeps the existing named field, blank form state, native required validation, and decimal payload. Pointer capture and custom arrow keys can drive the same field. | Needs a small controller for SVG fill and pointer lifecycle. |

For the two UI surfaces, duplicating that controller would avoid asset allowlist changes but repeat pointer, keyboard, and SVG rules in both apps. A shared `pwa/ui/star-rating.mjs` adds one builder/checker/service-worker cache entry and one route in the root server. Choose the shared control because both surfaces edit the same rating with the same input and display contract; the allowlist changes are explicit and covered by existing build tests.

Choose the decimal number input over SVG stars. The value shape is `''` before selection or a decimal number string from `0.1` through `5.0`; `validateRecord` converts it once to a finite number in one-tenth increments. Stored rows remain numbers, with `null` reserved for unrated legacy data. One shared domain predicate governs stored validation, averages, insight queries, and UI display. One `activePointerId` in the control closure models the only in-progress drag; another pointer is ignored. Pointer cancel stops updates but keeps the last displayed value.

## Task-specific sequence

- [x] Compare a native range with zero sentinel against a decimal number field enhanced as a pointer slider.
- [x] Choose `rating` as `''` while unselected and a numeric decimal in `[0.1, 5.0]` after domain validation.
- [x] Write behavior tests first and capture the intended failing output in `red-before-fix.txt`.
- [x] Implement the input and consumer changes.
- [x] Run targeted tests.
- [x] Run required package checks after merging current main.
- [x] Verify touch and mouse interaction in the source browser.
- [x] Verify built PWA browser flow after merging current main.
- [x] Record rerunnable evidence and inspect the final diff.

## Critic correction

The star path occupies x=3..21 in its 24×24 SVG viewBox. The old clip used x=0 and width `24 × fraction`, so 0.1 painted no gold pixels and 0.9 and 1.0 painted the same number. Both the input and insight renderer now use x=3 and width `18 × fraction`.

The regression tests first failed on those old coordinates. `red-rating-visual.txt` records the old pixel counts; `rating-visual-dist.txt` records the built module's corrected 0.1, 0.5, 0.9, and 1.0 raster counts. `verify-rating-visual.mjs` resolves project files relative to its own evidence location and accepts `--dist` for reruns.

## Integrated verification

- Feature commit: `0897e70`; merged current `main` (`58377af`) with merge commit `b477740`. New main bean-detail UI, styling, tests, and evidence are preserved in the merge.
- `npm test`: 662 passed, 0 failed. Full output: `npm-test.txt`.
- `npm run build:pages`: passed, build version `ba0b50b0e574`; `npm run check:pages`: passed.
- `node docs/evidence/decimal-star-rating-20261030/verify-rating-browser.mjs --dist`: Chrome 156 on 390×844 touch. Public mouse drag showed 4.3 and saved/read back 4.3; public touch drag showed 3.1. PWA touch selected 2.2 and restored it through draft; clear returned it to empty. Partial fifth-star clip width at 4.3 is 5.4. No JS errors or failed requests. The strict production CSP logged 12 existing inline-style violations from unrelated PWA dynamic styles.
- `node docs/evidence/decimal-star-rating-20261030/verify-rating-visual.mjs --dist`: 0.1/0.5/0.9/1.0 rendered 163/6474/12788/12952 gold pixels; each score differs and increases. Regression tests also assert the same x=3 and width 18 geometry in insight display.
- Browser logs and screenshot are in this directory. `git diff --check` passes.
