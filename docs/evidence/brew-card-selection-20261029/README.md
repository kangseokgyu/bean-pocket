# Brew card selection and overview evidence

Worktree: `codex/brew-card-selection-resume` (resumed 2026-10-30 KST). No commit, merge, push, or deployment was performed; this is ready for sequential Critic review.

## Changes

- Bean and recipe cards are each one full-width native button. Their content uses `strong` and `span`, selected labels and `aria-pressed` remain, and recipes without ready steps stay disabled after global view state is applied.
- Brew routes show the active 원두 → 레시피 → 추출 step. Selected bean and recipe summaries keep their change actions and routes.
- Extraction conditions are grouped using the fields already shown. Pour rows have explicit elapsed-time, this-pour, and cumulative-water columns. The existing extraction guide and completion action remain.
- The horizontal pour-table region is keyboard focusable (`tabindex="0"`), named as a region, and uses the existing visible `.table-scroll:focus-visible` outline.

Recipe step meanings were checked in `lib/domain.mjs`: `seconds` is the elapsed timestamp, `interval` is the time since the previous step, `water` is the current step's pour amount, and `cumulativeWater` is the running total. The overview labels the columns accordingly and displays the interval as secondary text under elapsed time.

## Verification

- `logs/step1-red.txt`: expected failure because the rendered card was an `article` instead of a native button.
- `logs/step1-debug.txt`: exposed `applyState()` resetting an intrinsically disabled incomplete recipe; that state is now preserved.
- `logs/step1-green.txt`: focused card behavior passed.
- `logs/step2-red.txt`: expected failure because the brew flow had no step indicator.
- `logs/step2-green.txt`: overview behavior passed.
- `logs/pwa-ui.view.test.txt`: 146/146 passed.
- `logs/npm-test.txt`: final escalated run passed 633/633.
- `logs/build-pages.txt`: passed; final build version `08d241e310f6`.
- `logs/check-pages.txt`: passed.
- `logs/critic-scroll-red.txt`: expected failure because the labeled region lacked `tabindex`.
- `logs/critic-scroll-green.txt`: focused accessibility regression passed.
- `logs/npm-test-sandbox-denied.txt`: initial default-sandbox run hit `listen EPERM` in HTTP tests; rerun with loopback test networking allowed passed.
- `git diff --check`: passed.
- `logs/browser-check.txt`: local fake-data preview rendered; clicking bean-card detail text navigated to the recipe route with the selected bean ID. The temporary fixture and server were removed.

No real Notion writes were made.
