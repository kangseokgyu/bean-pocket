# Specification: Production records page demo alignment

## Goal

Restructure `#/records` to use the approved `pwa/records-demo.html` information hierarchy and visual language while keeping production data, route behavior, and record management intact.

## Layout and data

- Desktop: a left sidebar lists up to three recently brewed distinct beans; the right column shows selected bean metadata and loaded-sample count/valid-rating average, the all-loaded-record rating trend, the best rated record with recorded recipe conditions, and a recipe-filtered comparison table.
- At the demo's responsive breakpoints, use the same order in a single column. The comparison table becomes cards on mobile.
- Sidebar, summary, trend, best record, and comparison use a scoped ivory/coffee/green style based on the demo. Keep the app header, navigation, and new-record action unchanged.
- The legacy server-filtered record list, search, paging, empty/error states, delete actions, and draft/save flow remain available inside a collapsed “전체 기록 조회·관리” section.
- Insights remain bounded to the existing unfiltered 20-record cursor. Show the loaded scope explicitly. Recipe filtering and sorting affect only comparisons; trend, average, and best record keep the selected bean's full loaded scope.
- Read bean/recipe metadata and conditions from valid snapshots first. Live parents may fill missing display names and bean metadata, never historical recipe conditions. Do not invent roast age or total brew time.

## Acceptance checks

- Selecting a bean updates its metadata, loaded count, average, trend, best record, and comparison rows; cards remain keyboard-operable with `aria-pressed`.
- Trend uses actual calendar spacing, a fixed 1–5 rating scale, and date/rating text alternatives. Empty and invalid data remain explicit.
- Desktop comparison columns are date, recipe, recorded conditions, star rating, and cup notes; mobile cards retain the same information. Recipe filter and all three demo sort orders work independently of trend/best.
- Existing record search, server filters, pagination, create/save, draft, and delete remain reachable under record management.
- Production-browser checks compare demo and app captures at 320, 550, 768, 1024, and 1440px with fixture data only. Run `npm test`, `npm run build:pages`, and `npm run check:pages` after source changes.

## Boundaries

- Do not import demo data or demo JavaScript/CSS into production.
- Do not change the backend query, cursor, connection lifecycle, or data-security boundaries.
- No dependencies or schema changes.
