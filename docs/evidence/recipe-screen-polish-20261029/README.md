# Recipe screen polish evidence

This folder records the recipe screen design, tests, browser checks, and screenshots for branch `codex/recipe-screen-polish`.

## Verification results

- `npm test` passed: 635 tests, 0 failures.
- `npm run build:pages` passed: build stamp `b58df205f3d1`.
- `npm run check:pages` passed.
- `node docs/evidence/recipe-screen-polish-20261029/browser-validation.mjs` passed at 320, 390, 768, and 1440 pixels.
- `git diff --check` passed.

The browser check found no horizontal page overflow at those widths. It checked the two-line guide preview, long title and guide text at 320 pixels, missing steps and guide text, zero and missing values, and detail navigation from the card metrics. It also opened and cancelled the delete dialog, copied the guide into the recipe form, and opened a prefilled record form.

The browser page uses in-memory Notion-shaped recipe data and a stub submit action. It made no external requests and submitted no create or delete action. No real Notion data changed.

## Evidence files

- `design-sketch.html`, `design-sketch-390.png`, and `design-sketch-1440.png` show the proposed information hierarchy.
- `browser-validation.mjs`, `browser-validation.txt`, and `browser-results.json` contain the browser scenario and its final results.
- `recipe-list-*.png` and `recipe-detail-*.png` show the four viewport sizes.
- `recipe-missing-steps-guide-320.png` shows the missing-data state.
- `recipe-delete-dialog-390.png`, `recipe-copy-dialog-390.png`, and `recipe-record-dialog-390.png` show the action dialogs.
- `red-test.txt` records the expected pre-implementation failures.
- `npm-test.txt`, `build-pages.txt`, and `check-pages.txt` record the final required checks.
- `browser-attempts-notes.txt` records early harness failures and their causes. The `browser-validation-attempt-*.txt` files and `browser-failure-attempt-*.png` files preserve those attempts.

## Existing validation-state behavior

The browser check found that `applyState()` resets every button's `disabled` property when the page is idle. That overrides `recipeReady()` for recipes with invalid steps, so the validation warning remains visible while the copy and record buttons are enabled. This task leaves that shared state rule unchanged. The browser check verifies the warning and tests the copy and record actions with a valid recipe.

## Integration and publication

- Feature commit: `b4eafa38c8f4599288aafe90d5111a21ffb04ed8`, merged into main with fast-forward.
- Critic: approved, with 148 independent view tests passing. See `critic-review.md`.
- The Pages workflow passed the integrated regression tests, build, artifact check, and deployment with `probes=false`.
- Deployment: https://github.com/kangseokgyu/bean-pocket/actions/runs/40899420287
- Public recipes: https://kangseokgyu.github.io/bean-pocket/#/recipes
- Public build: `b58df205f3d1`.
- On 2026-10-30 at 00:15 KST, the public HTML, view module, CSS, service worker, and manifest returned HTTP 200 and matched the tested local build byte for byte. See `public-verification.json`.
- Actual Notion writes, iPhone Safari, installed home-screen mode, and screen-reader narration were not tested.

The Worker used `gpt-6-luna` with `max` reasoning. The Critic used `gpt-6.1-sol` with `medium` reasoning. Their displayed names were Jason and Dirac. The spawn tool does not accept custom names.
