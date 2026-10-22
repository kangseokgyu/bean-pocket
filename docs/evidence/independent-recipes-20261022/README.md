# Independent recipes implementation evidence

Date: 2026-10-22 (UTC run window: 07:30–07:48)
Branch: `codex/independent-recipes`
Base checkout revision: `14a1bc3be673a47a808d7e23ac6e44c2c2dd85ab`
Runtime: Node.js `v23.4.0`, npm `10.9.2`

## Public-safe Notion migration facts

- The original and current test databases were extended additively with `records.원두` relation to beans and the reverse `beans.추출 기록` relation. Existing `recipes` bean relations were retained for legacy interpretation.
- In the current test database, seven existing records had version 1 snapshots. Their snapshot bean references were checked against the actual bean parent before only the new record-to-bean relation was backfilled.
- Readback confirmed that date, rating, cup note, recipe, bag, and the snapshot source text stayed unchanged. No existing record, rating, or relation was deleted or rewritten.
- This evidence records the operator-provided migration/readback result; this worker did not make live Notion changes. Actual Notion identifiers and record contents are intentionally omitted.

## Test and build results

All final commands completed on the working tree after implementation and documentation changes:

| Command | Result | Log |
|---|---:|---|
| `npm test` | exit 0; 428 passed, 0 failed, 0 skipped | [npm-test.final.txt](npm-test.final.txt) |
| `npm run build:pages` | exit 0; build version `cfc9a1d03179` | [build-pages.final.txt](build-pages.final.txt) |
| `npm run check:pages` | exit 0 | [check-pages.final.txt](check-pages.final.txt) |
| `node --test test/http.test.mjs` | exit 0; 14 passed | [http.test.green.txt](http.test.green.txt) |

Focused logs also include 7/7 new contract tests, 25/25 command tests, UI coverage, and the intended red-first run where all seven new feature tests failed before implementation. See [red.test.txt](red.test.txt), [focused.test.green.txt](focused.test.green.txt), [pwa-commands.test.green.txt](pwa-commands.test.green.txt), and [pwa-ui.test.green.txt](pwa-ui.test.green.txt).

The first full run after the implementation had one test-harness `ReferenceError` (`fake` was not destructured from `setup`). That focused HTTP test passed after the fixture correction; the first-run output is preserved in [npm-test.first-run.failure.txt](npm-test.first-run.failure.txt). An earlier intermediate full run is retained as [npm-test.initial.txt](npm-test.initial.txt) and is not the final result.

## Runtime scope and rollback

The Chrome DevTools MCP/browser runtime tool is unavailable in this worker session, so no real-browser runtime result is claimed. Browser runtime review remains for the Critic. These runs do not represent a new Pages publication, live app write test, device test, or merge.

Pre-change public recovery reference supplied by the operator: published build `d903139c5081`, last successful Pages run `39734457416`, and public head `4c407ecdbf2b630fc2e7045e7f7e4c4c626b8e18`. If the new source has a regression, revert the source and rerun the Pages workflow; do not delete the added relations or existing data.

No source or workflow deployment was performed by this worker.
