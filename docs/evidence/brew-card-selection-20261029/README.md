# Brew card selection and overview evidence

Worktree: `codex/brew-card-selection-resume`. Feature commit `80818d3`; integration merge commit `dbeef33` brought in main commits `b4eafa3` and `cd28f43`. This validation turn made no code changes or commit/deployment.

## Changes

- Bean and recipe cards are each one full-width native button. Their content uses `strong` and `span`, selected labels and `aria-pressed` remain, and recipes without ready steps stay disabled after global view state is applied.
- Brew routes show the active 원두 → 레시피 → 추출 step. Selected bean and recipe summaries keep their change actions and routes.
- Extraction conditions are grouped using the fields already shown. Pour rows have explicit elapsed-time, this-pour, and cumulative-water columns. The existing extraction guide and completion action remain.
- The horizontal pour-table region is keyboard focusable (`tabindex="0"`), named as a region, and uses the existing visible `.table-scroll:focus-visible` outline.

## Review status

The initial Critic review passed 19/19 relevant tests and reported one P2: the horizontally scrollable pour table was not keyboard focusable. The fix adds `tabindex="0"`; a focused test showed RED before the change and GREEN after it. The post-merge overlap review is pending.

Recipe step meanings were checked in `lib/domain.mjs`: `seconds` is the elapsed timestamp, `interval` is the time since the previous step, `water` is the current step's pour amount, and `cumulativeWater` is the running total. The overview labels the columns accordingly and displays the interval as secondary text under elapsed time.

## Verification

- `logs/step1-red.txt`: expected failure because the rendered card was an `article` instead of a native button.
- `logs/step1-debug.txt`: exposed `applyState()` resetting an intrinsically disabled incomplete recipe; that state is now preserved.
- `logs/step1-green.txt`: focused card behavior passed.
- `logs/step2-red.txt`: expected failure because the brew flow had no step indicator.
- `logs/step2-green.txt`: overview behavior passed.
- `logs/pwa-ui.view.test.txt`: 146/146 passed.
- `logs/npm-test.txt`: integrated run passed 637/637 using loopback test networking.
- `logs/build-pages.txt`: integrated build passed; version `f9acf1f6d151`.
- `logs/check-pages.txt`: integrated artifact check passed for `f9acf1f6d151`.
- `logs/critic-scroll-red.txt`: expected failure because the labeled region lacked `tabindex`.
- `logs/critic-scroll-green.txt`: focused accessibility regression passed.
- `logs/npm-test-sandbox-denied.txt`: initial default-sandbox run hit `listen EPERM` in HTTP tests; rerun with loopback test networking allowed passed.
- `git diff --check`: passed.
- `logs/browser-check.txt`: local fake-data preview rendered; clicking bean-card detail text navigated to the recipe route with the selected bean ID. The temporary fixture and server were removed.

No real Notion writes were made.

## Final independent review

Worker was explicitly configured as `gpt-6-luna` with `max` effort. Critic used `gpt-6.1-sol` with `medium` effort. Critic approved the keyboard focus fix, then approved integrated commit `dbeef33` after verifying that the recipe-screen changes from main remained intact. The overlap review ran 16 related tests successfully and found no remaining issues. Integrated verification passed 637 tests, the Pages build and artifact check. Final build: `f9acf1f6d151`. Actual mobile devices, browser keyboard scrolling, and real Notion storage remain unverified.

## Main integration and deployment

- Main integration commit: `a6a4d104643ba1a1c33aa510ceeac45af7648c6c`.
- Main verification: `npm test` 637/637 passed, `npm run build:pages` and `npm run check:pages` exited 0. Logs: `logs/main-tests.txt`, `logs/main-build.txt`, `logs/main-check.txt`.
- General Pages deployment (`probes=false`): [Actions run 40900827366](https://github.com/kangseokgyu/bean-pocket/actions/runs/40900827366), build and deploy succeeded on 2026-10-30 00:23 KST.
- Public app: https://kangseokgyu.github.io/bean-pocket/ . Build `f9acf1f6d151` is present in public HTML. HTML, view module, CSS, service worker, and app module matched local output. Four-file HTTP and SHA-256 evidence: `logs/public-verification.json`; repeat with `python3 verify-public.py /absolute/path/to/dist`.
- The existing in-app browser retained cached build `85e18f605e6d` after reload. This does not establish that an already installed client applied the update. Mobile devices, installed-client update adoption, real Notion storage, and browser keyboard scrolling remain unverified.
