# Screen-specific lazy reads — worker evidence

Date: 2026-10-26. All worker verification used synthetic fixtures. No live Notion workspace or personal browser profile was used.

## Implemented behavior

Warm startup verifies the current route's schemas and displays its first 20 rows. The beans list reads bean metadata only; it does not call `readAll()`, load recipes, stages, bags, or records as a startup dependency, or re-read every recipe parent. Bean counts and selected-recipe statistics are deferred and only show exact values after complete scans. Recipe summaries validate stages for the visible page; recipe detail validates the selected parent and all its stages, then loads matching records. Record filters use server-side relation filters; searchable bean/recipe options load in pages when a filter or record form is used. Record cursors bind the filter and connection revision and retain unmatched bagless-v1 snapshot rows across bounded raw scans.

Screen pages and option pages use separate 60-second caches. Connection changes clear both; mutations invalidate affected routes and options. Abort signals and route generations stop stale reads from replacing the current screen. Route schema checks, `queryPage`, and signal-bound selected-page reads use a serialized queue with 350 ms pacing and finite read-only 429 retries (honoring `Retry-After` up to 60 seconds). Legacy unsignalled `queryAll()` preflight remains serialized but keeps its existing no-retry/no-delay behavior. Existing write `readAll()` preflight, source ownership checks, latest-parent reread, stage completeness, journal/locks, unknown recovery, and legacy delete dependencies remain in place.

## RED → GREEN evidence

- `query-page-red.tap` and `first-page-red.tap` capture missing bounded query and first-page behavior before implementation. `first-page-green.tap` and `first-page-focused.tap` record the green query, verification, repository, and startup slices (101 focused tests passed).
- `view-contract-red.tap` / `view-contract-green.tap` capture route notification, continuation-aware empty state, and option paging. `picker-rerender-red.tap` records the selection-loss regression; the corrected option-page behavior is covered by `focused-final.tap`.
- `records-continuation-red.tap` / `records-continuation-green.tap` capture the 20+5 bagless record continuation and bounded empty-scan behavior. `search-continuation-red.tap` / `search-continuation-green.tap` capture title filtering and query-bound continuation.
- `recipe-stats-reuse-red.tap` records the unnecessary selected-parent/stage rereads; the exact validated-detail reuse test passes in `focused-final.tap`.
- `read-rate-limit-red.tap`: `node --test --test-name-pattern='read-only page reads retry rate limits' test/pwa-notion-client.test.mjs` failed before the selected-page 429 retry was implemented; matching green output is in `read-rate-limit-green.tap`.
- `focused-final-after-read-scheduler.tap`: exact command `node --test test/pwa-notion-client.test.mjs test/pwa-read-repository.test.mjs test/pwa-screen-loading.test.mjs test/pwa-ui.integration.test.mjs test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs test/pwa-lifecycle-recovery.test.mjs test/pwa-entity-delete.test.mjs docs/evidence/T26/critic-ui-repro.test.mjs`; **244 passed, exit 0**. This includes the shared-read queue, stale-route response, lazy form options, exact deferred stats, and affected compatibility regressions.
- `compatibility-focused.tap`: exact command `node --test test/pwa-connection.test.mjs test/pwa-lifecycle-recovery.test.mjs test/pwa-entity-delete.test.mjs docs/evidence/T26/critic-ui-repro.test.mjs`; **42 passed, exit 0**.
- `earlier-focused-final.tap` and the individual slice logs preserve the earlier implementation runs.

The first focused run after introducing the shared read scheduler exposed that legacy `queryAll()` had started retrying 429 responses, contrary to its existing contract (expected 3 total calls, observed 5). `focused-after-read-scheduler.tap` preserves that failure. `read-rate-limit-compat-green.tap` records the correction: selected-page GET and `queryPage` reads retry finitely, while the legacy query preflight still makes one attempt.

To keep `git diff --check` clean, captured TAP files have only trailing horizontal whitespace removed; test output lines and results were not otherwise edited.

The initial full-suite run found old controller fakes that only implemented `readAll`, a record-deletion assertion that expected recipe stats on the beans route, and the T26 connection fixture's missing `listBeans`. The first failure output was overwritten by the final successful rerun; no raw initial failure log is retained. Its recorded summary was 526 discovered, 512 passed, 6 failed, and 8 cancelled. The fakes now implement the screen page contract; the T26 test still asserts the same draft preservation and dirty-state behavior. The deletion test navigates to the selected recipe detail and checks the exact deferred total before and after deletion.

## Required final verification

- `npm test` — **527 passed, exit 0**; final full output: `npm-test-after-read-scheduler.tap`.
- `npm run build:pages` — **exit 0**, generated version `e69a4d2793db`; final output: `build-pages-after-read-scheduler.tap`.
- `npm run check:pages` — **exit 0**; final output: `check-pages-after-read-scheduler.tap`.
- `git diff --check` — **exit 0**.
- `node --check docs/evidence/screen-data-loading-20261026/critic/server.mjs` and `node --check docs/evidence/screen-data-loading-20261026/critic/browser.cjs` — both **exit 0**.

The fake-only browser harness is `critic/server.mjs` plus `critic/browser.cjs`. From the project root, run `node docs/evidence/screen-data-loading-20261026/critic/browser.cjs`. It starts a local fixture server, uses the bundled Playwright runtime with installed Chrome and a temporary browser context, injects in-memory OPFS/lock and fake Notion fixtures, blocks non-local requests, and writes results/screenshots under `/private/tmp/screen-data-loading-critic`. It does not read a user Chrome profile or use live credentials. The worker did not run this browser scenario; it is reserved for the parent Critic's independent review and runtime check.

The worker did not run a before/after device performance benchmark or a live Notion API check. The harness is prepared for Critic runtime verification. The Notion request shape follows the existing pinned `Notion-Version: 2025-09-03`; reference: [query a data source](https://developers.notion.com/reference/query-a-data-source) and [request limits](https://developers.notion.com/reference/request-limits).
