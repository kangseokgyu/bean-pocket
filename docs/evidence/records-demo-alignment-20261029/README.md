# Records demo alignment evidence

## Result

Production `#/records` now follows the approved demo's hierarchy: a recent-bean sidebar beside the selected-bean summary, rating trend, best-rated record, and comparison table. At mobile widths the same sections stack in order and comparison rows become cards. Existing search, filters, paging, drafts, save, and delete remain under the collapsed **전체 기록 조회·관리** section.

Trend and best-record summaries use the selected bean's entire loaded insight sample; recipe filtering and comparison sorting affect only comparison rows. The page states its loaded-record scope. Snapshot values remain historical, and no roast age or total brew duration is inferred.

The final UI fix keeps record management available when the bounded insight state is absent or still loading. Its regression test was first confirmed failing in [management-fallback-red.txt](management-fallback-red.txt), then passed in the focused and full suites.

## Review fixes and final verification

The two required findings in [critic.md](critic.md) are fixed. Selecting another bean clears its previous recipe filter. Data refresh also clears a recipe filter whose option disappeared after the last matching record was removed, keeping the menu and comparison rows consistent. The duplicate bean-selection handler was removed.

The trend SVG now stays 250px high, matching the demo at all five widths. ResizeObserver recalculates its viewBox and coordinates for the available width, retaining actual calendar-day spacing and the fixed 1–5 scale. Labels and points keep their screen size; crowded intermediate date ticks are hidden while first/last dates and the full text alternative remain available. The final 320/550/768/1024/1440 production screenshots were opened and visually inspected.

Final Pages output build: `cfa4de79469e`.

- `node --test test/pwa-ui.view.test.mjs test/pwa-records-insights.test.mjs` — 149 passed, 0 failed ([review-fix-release-focused.txt](review-fix-release-focused.txt)).
- `npm test` — 638 passed, 0 failed ([review-fix-release-npm-test.txt](review-fix-release-npm-test.txt)).
- `npm run build:pages` and `npm run check:pages` — passed ([build](review-fix-release-build-pages.txt), [check](review-fix-release-check-pages.txt)).
- Source, test, browser-script, and Markdown diff whitespace checks — passed. Full staged whitespace checking reports whitespace-only assertion-diff lines in four raw RED logs; those original logs are intentionally preserved unchanged.
- [Final browser fixture](review-fix-browser-validation.mjs) — passed at 320/550/768/1024/1440px against build `cfa4de79469e` ([log](review-fix-release-browser-validation.txt)). It verifies matching 250px demo/production chart heights, viewport-width coordinates, separated date labels, fixed scale, date spacing, score-label containment, no page overflow, filter reset on bean changes, comparison/trend/best consistency, Enter/Space selection, legacy search/filter, and create/delete. No console/page errors, failed responses, or unmocked external requests; 80 requests, all Notion calls intercepted.

Final paired screenshots: `review-fix-demo-<width>.png` and `review-fix-production-<width>.png`. Real Notion accounts, Safari/Firefox, physical mobile devices, and physical keyboard input were not tested. Chrome keyboard automation was tested. Publishing and public build verification remain the Orchestrator's next step.

The chart-height regression was first confirmed failing at 460px ([red](review-fix-chart-height-red.txt)); the removed-recipe option case failed with a hidden filter and no comparison table ([red](review-fix-deleted-recipe-red.txt)) before both recipe regressions passed ([green](review-fix-recipe-filter-final-green.txt)). The narrow-screen date-label spacing assertion first failed with less than a 1px gap ([red](review-fix-date-label-red.txt)), then passed in the final browser run. Earlier failing logs and screenshots are retained. The review-fix sandbox full-suite attempt had 622/637 passing with 15 `listen EPERM` failures ([log](review-fix-npm-test-sandbox.txt)); the final loopback-authorized run above passed. Intermediate builds and logs are historical, not the final result.

## Initial implementation verification

Initial implementation checks used Pages output build `c7ff26136829`:

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
