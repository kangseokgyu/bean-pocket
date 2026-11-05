# Brew search keyboard preservation

Baseline: main `5cc2013` in worktree `/private/tmp/ax-search-keyboard-20261105` on `codex/search-keyboard-preservation`.

## Cause and change

`setSearchOptions('brew', ...)` previously called `renderCurrentContent()`. That replaced the focused search node when an option response arrived. `renderData()` also rebuilt the full selection screen for same-route data refreshes.

The view now keeps the input and route ancestors mounted for matching search responses and same-route refreshes. It updates only `.brew-option-results`. It ignores responses that do not match the active input value or arrive during IME composition. Route changes and connection revision changes still use the full render path.

The controller API, request generations, and storage shape are unchanged.

## Evidence

- `red.test.txt`: focused regressions fail on the original main revision for detached input, stale query, and composition behavior. Navigation and connection replacement pass.
- `focused.green.test.txt`: focused regressions pass 7/7 after the fix.
- `view.full.test.txt`: complete `test/pwa-ui.view.test.mjs` passes 188/188.
- `npm.test.txt`: `npm test` passes 737/737. The sandbox run first hit `listen EPERM` on loopback HTTP tests; the authorized rerun passed.
- `build.pages.txt`: `npm run build:pages` passes and reports Pages build `b409ff9c6684`.
- `check.pages.txt`: `npm run check:pages` passes.
- `search-keyboard-flow.html`: standalone flow diagram grounded in the view and controller functions.

No iPhone or iOS simulator was available, so native keyboard behavior was not directly exercised. The regression tests verify that the same search input stays attached and focused through updates.
