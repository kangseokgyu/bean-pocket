# Records demo alignment evidence

## Result

Production `#/records` now follows the approved demo's hierarchy: a recent-bean sidebar beside the selected-bean summary, rating trend, best-rated record, and comparison table. At mobile widths the same sections stack in order and comparison rows become cards. Existing search, filters, paging, drafts, save, and delete remain under the collapsed **전체 기록 조회·관리** section.

Trend and best-record summaries use the selected bean's entire loaded insight sample; recipe filtering and comparison sorting affect only comparison rows. The page states its loaded-record scope. Snapshot values remain historical, and no roast age or total brew duration is inferred.

The final UI fix keeps record management available when the bounded insight state is absent or still loading. Its regression test was first confirmed failing in [management-fallback-red.txt](management-fallback-red.txt), then passed in the focused and full suites.

## Verification

All final checks used the same source revision and Pages output build `c7ff26136829`:

- `node --test test/pwa-ui.view.test.mjs test/pwa-records-insights.test.mjs` — 147 passed, 0 failed ([ui-insights-green.txt](ui-insights-green.txt)).
- `npm test` — 636 passed, 0 failed ([npm-test.txt](npm-test.txt)).
- `npm run build:pages` — passed, output build `c7ff26136829` ([build-pages.txt](build-pages.txt)).
- `npm run check:pages` — passed ([check-pages.txt](check-pages.txt)).
- `git diff --check` — passed.
- Production browser fixture — passed at 320, 550, 768, 1024, and 1440px ([browser-validation.txt](browser-validation.txt)). It checked paired demo/production captures, desktop and mobile layout, no horizontal overflow, selected summaries, score labels and chart scale/spacing, Enter/Space bean selection, recipe filters and sort orders isolated from trend/best, plus management search/filter, create, and delete. There were no console or page errors, failed responses, or unmocked external requests. Its 80 requests used synthetic fixtures; Notion API calls were intercepted.

Paired screenshots are saved as `demo-<width>.png` and `production-<width>.png` for each tested viewport. The browser fixture is [browser-validation.mjs](browser-validation.mjs). It uses no real Notion account or user records.

## Failure history

The first sandbox `npm test` run reported 607/635 passing. Fifteen HTTP tests could not bind localhost (`listen EPERM`); the remaining 13 failures were 12 UI cases where record management disappeared before insights loaded, plus one assertion expecting obsolete scope wording. The UI fallback was fixed, the stale assertions were updated, and the full suite was rerun with loopback permission; the final result is 636/636. The initial log is preserved as [npm-test-sandbox.txt](npm-test-sandbox.txt).

The browser iteration logs and the narrow table-overlap regression capture are retained in this folder. The table spacing was corrected before the final build and final five-width browser run.
