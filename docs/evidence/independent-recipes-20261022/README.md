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

## Verification history

The previous implementation report is from base commit `ad966b05c4294fd1c98bf9717a1db56b0773ee6b`, before the Critic findings. Its `npm test` result was 428/428 and Pages build version was `cfc9a1d03179`; those historical logs remain at [npm-test.final.txt](npm-test.final.txt), [build-pages.final.txt](build-pages.final.txt), and [check-pages.final.txt](check-pages.final.txt). They are superseded for acceptance by the rework results below.

The Critic rework red-first run had 116/126 passing and 10 expected failures for the newly added snapshot, relation uncertainty, and rating checks. The original failure output is preserved in [critic.red.test.txt](critic.red.test.txt). After implementation, the focused regression set passed 126/126 in [critic.green.test.txt](critic.green.test.txt).

The required checks were rerun against the rework:

| Command | Result | Log |
|---|---:|---|
| `npm test` | exit 0; 437 passed, 0 failed, 0 skipped | [critic.npm-test.final.txt](critic.npm-test.final.txt) |
| `npm run build:pages` | exit 0; build version `a9da5c5ed323` | [critic.build-pages.final.txt](critic.build-pages.final.txt) |
| `npm run check:pages` | exit 0 | [critic.check-pages.final.txt](critic.check-pages.final.txt) |

## Critic browser evidence

The Critic’s normal Chromium run was captured against the previous build `cfc9a1d03179`, before this rework. It verified independent recipe entry with no bean selector; required bean, recipe, date, and rating; bag selection and reset; optional bag and cup note; combined bean/recipe record filters; v2 snapshot storage; and no page errors or external network requests in those normal flows. The reviewed synthetic log and mobile records screenshot are copied as [critic-browser-results.json](critic-browser-results.json) and [critic-records-mobile.png](critic-records-mobile.png). A credential-marker scan checked 104 JSON strings before copying; the displayed records use synthetic content. This is historical browser evidence and must not be read as runtime verification of the rework build. The rework’s browser runtime has not been rerun in this worker session and remains for the Critic’s final review.

The copied browser artifacts do not contain actual Notion identifiers or user records. The malformed-snapshot runtime failure was not copied as a screenshot; it is now covered by the preserved red and passing green repository/UI regression tests. No live Notion writes, device run, merge, push, or publication were performed by this worker.

Pre-change public recovery reference supplied by the operator: published build `d903139c5081`, last successful Pages run `39734457416`, and public head `4c407ecdbf2b630fc2e7045e7f7e4c4c626b8e18`. If the new source has a regression, revert the source and rerun the Pages workflow; do not delete the added relations or existing data.

No source or workflow deployment was performed by this worker.
