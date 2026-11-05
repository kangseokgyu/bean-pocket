# Brew search keyboard preservation

Baseline: main `5cc2013` in worktree `/private/tmp/ax-search-keyboard-20261105` on `codex/search-keyboard-preservation`.

## Cause and change

`setSearchOptions('brew', ...)` previously called `renderCurrentContent()`. That replaced the focused search node when an option response arrived. `renderData()` also rebuilt the full selection screen for same-route data refreshes.

The view now keeps the input and route ancestors mounted for matching search responses and same-route refreshes. It updates only `.brew-option-results`. It ignores responses that do not match the active input value or arrive during IME composition. Route changes and connection revision changes still use the full render path.

The controller API, request generations, and storage shape are unchanged.

An expired cached option page (60 seconds or older) no longer overrides fresh same-route data. Both full page rendering and in-place search refresh use the same freshness and route-scope predicate.

## Evidence

- `red.test.txt`: focused regressions fail on the original main revision for detached input, stale query, and composition behavior. Navigation and connection replacement pass.
- `cache-red.test.txt` / `cache-green.test.txt`: expired cached-page regressions fail for both bean and recipe routes before the cache predicate change, then pass 2/2.
- `focused.green.test.txt`: focused regressions pass 7/7 after the fix.
- `view.full.test.txt`: complete `test/pwa-ui.view.test.mjs` passes 190/190 after both fixes.
- `npm.test.txt`: `npm test` passes 739/739. The sandbox run first hit `listen EPERM` on loopback HTTP tests; the authorized rerun passed.
- `build.pages.txt`: `npm run build:pages` passes and reports Pages build `50779679988f`.
- `check.pages.txt`: `npm run check:pages` passes.
- `search-keyboard-flow.html`: standalone flow diagram grounded in the view and controller functions.

No iPhone or iOS simulator was available, so native keyboard behavior was not directly exercised. The regression tests verify that the same search input stays attached and focused through updates.
