# Records insights for the production history screen

## Objective

Add useful bean and rating insights to the existing `#/records` screen using real current record snapshots. Keep the entry form, draft handling, record table filters, pagination, and delete flow intact.

## Data and scope

- Read insight records through a separate unfiltered `listRecords` cursor, bounded to 20 records per request. Reuse the table's first page only when the table is unfiltered. Do not fetch the complete database eagerly.
- Label every aggregate with its loaded scope (for example, “불러온 기록 20건 기준”) and expose a separate “더 불러오기” action for the insight cursor. Do not label loaded-page values as database-wide totals.
- Select up to three distinct, unambiguous bean IDs ordered by each bean's newest valid current-record date descending. Break equal-date ties deterministically by bean ID. Exclude invalid dates and records that fail `isCurrentRecord` from insight calculations.
- Select the newest bean by default. Store the selected bean ID in controller state so recipe filters and table paging do not silently change the insight scope. If it is no longer present in loaded records, fall back to the newest available bean.
- The record table's bean/recipe filters apply to the table only. The selected bean's trend, best-rated record, and comparisons always use the unfiltered loaded insight records.
- Chart and detail ratings must be integers 1–5. Records with invalid or absent ratings do not enter rating aggregates. Existing record cards keep showing invalid-data warnings.

## Insights presentation

- Show the selected bean's date-by-date rating trend in an SVG chart with chronological labels, actual calendar spacing on x, and a fixed 1–5 y-axis. A one-point series shows a point; empty and unrated sets have explicit empty states. Duplicate dates must remain readable and avoid overflow.
- Provide an accessible chart name and a text alternative listing date and rating values. Bean choices must be keyboard operable and announce the selected state.
- Show the selected bean's best-rated record, its date, rating, cup note, and the recipe conditions captured in that record's snapshot. Also show comparable loaded records with a clear date/rating ordering.
- Use v2 `snapshot.bean` and `snapshot.recipe`, or the v1 recipe snapshot, for historical facts. A live parent may supply a missing display name only; current recipe values must never replace historic conditions. Do not infer a total extraction duration from the last recipe step. Do not show roast age because the current schema has no roasting date.
- Handle zero records, one record, no valid snapshots, missing/deleted parents, invalid date/rating, and unresolved bean relations with explicit wording and no fabricated values.

## Boundaries and compatibility

- Production code must not import the sample demo module or sample records.
- Do not add dependencies, change the Notion schema, fetch all records up front, expose the Notion token, or make external requests beyond the existing Notion client.
- Preserve record creation, drafts, save confirmation, deletion confirmation, search filters, and table pagination.
- Create/delete of records refreshes the bounded insight page and table; a still-available selection is preserved.
- Keep data rendering text-safe and the UI usable at 320, 550, 768, 1024, and 1440 CSS pixels without horizontal page overflow.

## Verification

- Test pure selection and chart model rules, including stable ordering, snapshot-only historical conditions, invalid and missing data, and immutable input.
- Test production DOM/controller integration for selection, best record, trend, page bounds, recipe-filter isolation, table paging, record create/delete refresh, and missing or invalid snapshots.
- Run `npm test`, `npm run build:pages`, and `npm run check:pages`.
- Validate the built production screen at the five widths above; check keyboard selection, chart text alternatives, filter isolation, create/delete modal flow, browser console, network requests, and overflow.
- Save the test commands/results and browser evidence under `docs/evidence/records-insights-20261029/`.
