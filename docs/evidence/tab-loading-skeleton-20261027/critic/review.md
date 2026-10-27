# Critic review — FAIL

Scope: working diff versus HEAD, read-only product/tests. Independent review using code-review-and-quality. No subagents, commits or shipping. Evidence captured 2026-10-27.

## Required fixes

1. **P1 — first data response replaces an editable modal and loses focus.** `pwa/ui/view.mjs:598-602` retains the open dialog only when `routeNeedsDataRender` is false. `renderRoute` sets that flag for `/recipes/new`, renders/opens the dialog immediately, and starts the delayed first read. The user can type during the new route skeleton. When the response arrives, `renderData` rebuilds the whole pane, detaching that dialog/form and its focused input. The draft text survives, but DOM identity and focus do not. Reproduced at both 390 and 1280. This is a requirement gap at an existing rendering path rather than a newly added rebuild statement. Preserve the live dialog/form/focus while updating the underlying list; add a combined controller/view delayed-first-read regression (the new view-only test calls loading/cancelled without completing a real first-route response).

2. **P2 — loading → ready with an open dialog leaves list siblings hidden.** `pwa/ui/view.mjs:574-575` sets `hidden=true` on the header/cards, but the ready branch at `:578-580` only unhides the outer content and removes aria-busy. Header and recipe card remain hidden (both were visible before loading). Reproduced in the actual browser through the public view status API at both widths. This second observation is a view-state contract failure; the harness does not establish a separate normal navigation sequence reaching it today. It becomes directly relevant when fixing #1 by retaining the modal rather than rebuilding its pane. Restore only children hidden by this transition and preserve any intentionally hidden state. Cover loading → renderData → ready with an already-open dialog and subsequent close.

## Independent verification

- `npm test`: exit **0**, **542 tests / 542 pass / 0 fail / 0 cancelled / 0 skipped**. Loopback allowed using require_escalated. `npm-test.log`.
- `npm run build:pages`: exit **0**. `build-pages.log`.
- `npm run check:pages`: exit **0**. `check-pages.log`.
- `node docs/evidence/tab-loading-skeleton-20261027/critic/browser.cjs`: exit **1** (assertion findings, no timeout). Chrome headless with isolated contexts, real controller/view/CSS and deferred fake repository; **390 and 1280**, each **8 passed / 2 failed**, **0 page errors**. `browser-results.json`, `browser.log`, `390-loading.png`, `1280-loading.png`, `390-modal.png`, `1280-modal.png`.
- Browser passing checks: initial skeleton retained; initial data clears; recipe transition hides stale/false empty; navigation enabled; stale rejection cannot clear active records skeleton; records first data appears; current error clears skeleton with no wrong cards/empty; cached return has no artificial delay; typed draft value retained. (The skeleton/navigation checks share one assertion group.)
- Mutation: temporary copy `/private/tmp/tab-critic-mutation.sgqSm2`, invert the added `generation !== routeGeneration` guard in `setRouteReadState`. Run `node --test <copy>/test/pwa-screen-loading.test.mjs <copy>/test/pwa-ui.view.test.mjs`, exit **1**; intended behavior assertions fail. Original product/tests untouched. `mutation.log` contains exact counts.

## Reproduction and limits

Run the browser command above from this worktree. `browser.cjs` starts/stops `server.mjs` at 127.0.0.1:4283 and loads `fixture.html`; no external API/authenticated browser. The first finding uses a real route transition into `/recipes/new` with a queued response; the second deliberately exercises view state transitions. Existing independent harness resolves its root only four parents up from `.../critic/independent`, pointing to `docs` instead of the repository (needs five); this explains failed module loading/readiness timeout in that copy. The new harness uses an explicit repository root and completes.

No live Notion verification, full service-worker update/reload handshake, pagination/browser background-read scenario, or records-new modal browser scenario was executed. Lifecycle code inspection found no new write-lock coupling: route reads remain read-only and pending remains separate; no confirmed lifecycle defect. Full test coverage is passing but does not catch the modal identity/focus issue.
