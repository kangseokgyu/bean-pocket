# Critic re-review

2026-11-04. Same Critic role, `gpt-6.1-sol` / `medium`. Reviewed the uncommitted fixes above `2d30279`; did not edit product code/tests or create subagents. The first review remains in `critic-review.md`.

**Decision: changes required. C1/C2 are resolved, but C2 introduced a pagination regression (C3).**

## Original findings

- C1: repeated the original production `createActualSnapshot → encodeProperties → NotionRepository.all()` probe with null source IDs. Result is now `readStatus: valid`, `readDose: 15`. The nullable-source exception applies only to v3; source/relation mismatch checks remain. New HTTP tests cover omitted and explicit-null source recipes followed by GET.
- C2: repeated the original four-bean production model probe. Result is now `availableBeans: [a,b,c,target]`, `selectedBean: target`, `comparisonRecords: [old-right,old-left]`, `trendCount: 3`. Inspected the controller/UI regression that begins with a different selected bean, directly loads an older target pair, checks the actual dose comparison, preserves swapped selectors, and rejects cross-bean/missing/old-generation/invalid-date pairs.

## C3 — Insight pagination and background initialization still use the old helper return shape

Severity: P1. `includeComparisonPair` now returns `{ items, beanId }` instead of an array. `fetchScreen` consumes that new shape, but `pwa/ui/controller.mjs:701` and `:746` still bind the whole object as `items`, then call `saveRecordInsightsPage({ ...page, items })` at lines 704/749. That function spreads `page.items` as an iterable and throws. The catch reports a failed insights read instead of appending records. This also affects background first-page loading after a filtered entry, not only explicit comparison routes.

Independent production-controller probe: connect at ordinary `/records` with a synthetic repository that returns `r1` plus `nextCursor` on its first query and `r2` on its next query, then call `loadMoreInsights()`.

```json
{"stage":"initial","status":"ready","ids":["r1"],"hasMore":true}
{"stage":"more","resultIsNull":true,"status":"ready","ids":["r1"],"error":"인사이트 기록을 불러오지 못했습니다. 다시 시도해 주세요.","queries":2}
```

The full post-review test failure confirms this same path: `test/pwa-ui.records-insights.integration.test.mjs:115` expects four loaded records after `loadMoreInsights()` but receives two (`test-full-post-review.log`, subtest 471). It is a product regression, not a stale assertion.

Required fix: migrate both remaining helper callers to consume `comparison.items`, apply a validated explicit-pair bean consistently where needed, and preserve the existing manual-selection behavior. Run the existing records-insights integration suite and cover the background initial-read path if the existing suite does not exercise it. Re-review after the fix; do not waive the full-suite failure.

## Evidence and limits

Inspected the updated source diff, targeted regression test source, post-review full-test failure, successful two-viewport dist browser log, and post-apply migration dry-run log. The latter reports `already configured` for test and operating environments with preserved existing properties; Critic did not issue live API requests. The browser fixture lacks paginated insights and therefore its passing result does not cover C3. No redundant full test run was performed by Critic.
