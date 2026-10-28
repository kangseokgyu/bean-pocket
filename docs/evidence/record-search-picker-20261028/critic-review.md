# Independent Critic review

Reviewed commit `ee838f3b2b9b81ec93bf331542f0b0c9cebd8c97`, base `8992d94`. Critic: `gpt-6.1-sol`, reasoning effort `medium`. **Verdict: Request changes.** Three required P2 findings remain. No implementation files modified and no push, merge, or deployment performed.

## Required findings

1. **P2 — Keep initial server option pages on append.** `pwa/ui/view.mjs:943-974`, especially line 951: `previousPage` only reads `optionPages`, whereas the first page may arrive through `data.options.beans`, `recipes`, `filterBeans`, or `filterRecipes`. Opening a preloaded picker does not load it again. The first **이름 더 보기** therefore replaces initial rows with page two. Reproduction: render a filter with one preloaded item and `hasMore:true`, then call `setSearchOptions('filters','beans',secondPage,true,'')`. Expected 2 result rows; actual 1. Seed append state from the applicable initial page, scoped to its query.

2. **P2 — Synchronize triggers after draft/prefill restoration.** `pwa/ui/view.mjs:1800` synchronizes during form construction, before `restoreDraft` at line 1515; the `new-record` action at lines 2459-2472 also changes recipeId afterward. Navigate away from an ordinary `/records/new` draft containing beanId/recipeId and return: the hidden values are restored, but the visible trigger still says **원두 선택** / **레시피 선택**. This misrepresents values that will be submitted. Synchronize after all draft and programmatic changes. Include the recipe-card prefill path.

3. **P2 — Retain selected filter options through rerenders.** `pwa/ui/view.mjs:973`, `2036-2060`: a search excluding the selected item preserves the current hidden select, but no longer retains that item in cached option data. The next records render selects the cached search page and assigns the active filter ID to a select without that option. A real browser clears its value; the UI then shows all items while the controller still applies the filter, and changing the other filter can drop the first condition. Reproduction: select bean A, search for B without selecting it, rerender data with A still in `screen.filters`; rebuilt select lacks option A. Preserve the selected ID/name independently from visible search rows and rehydrate on rebuild.

## Verification

Read `code-review-and-quality/SKILL.md`, actual diff, implementation context, tests, and author evidence. Reviewed correctness, accessibility, architecture, security, and performance. No new dependencies or injection sinks found; dynamic names remain text-node content. No implementation mutation performed because this Critic is forbidden to modify code.

Author evidence inspected: full suite 607/607; view 133/133; controller 8/8; build `faa9a116d8c1`; pages check; Chrome fixture at 390px and 1440px. The fixture has synchronous fake option requests and no-op `setRecordFilters`, so it misses initial server-page append and controller-driven filter rerenders.

Independent targeted test file: `/tmp/record-picker-critic.test.mjs` (temporary copy of existing harness, absolute source imports, three new `independent critic` cases). Command:

```sh
node --test --test-name-pattern='independent critic' /tmp/record-picker-critic.test.mjs
```

Exit **1**; tests **3**, pass **0**, fail **3**. Actual behavior failures: result count `1 !== 2`; restored trigger `원두 선택` rather than selected name; missing selected filter option after rerender. No environment errors. The author suite was not redundantly rerun. No live Notion requests, writes, or production browser verification performed.

Re-review required after the three fixes and associated regression tests.

## Re-review — commit 9674a9283bdd246c3fc69f37c3ea21b7cb2fc8a2

**Verdict: Request changes.** Findings 1 and 3 are resolved, and draft restoration in finding 2 is resolved. The programmatic recipe-detail prefill portion of finding 2 remains required P2.

Reviewed the incremental source and test diff and refreshed evidence: full suite 610/610, view 136/136, controller 8/8, build `9899dc883920`, pages check, strengthened browser assertions for initial 5 → appended 10 rows and retained filter selection across a rerender. Independently reran the original temporary three-case reproduction: exit 0, tests 3/3 pass. No redundant full suite run.

Unresolved location: `pwa/ui/view.mjs:2475-2489`, `new-record` action. `restoreDraft` now synchronizes triggers, but the recipe detail button **이 레시피로 추출 기록** still assigns `form.elements.recipeId.value = recipeId` after form construction without syncing its picker. The hidden ID is prefilled while the visible trigger says **레시피 선택**. The added author test covers query-string prefill, which uses a different code path.

Independent additional reproduction `/tmp/record-picker-critic.test.mjs`, test `independent critic followup: recipe detail action prefill synchronizes trigger`: render a recipe detail, click `[data-action="new-record"]`, assert the hidden recipeId, then assert the trigger contains `V60`. Command:

```sh
node --test --test-name-pattern='independent critic followup' /tmp/record-picker-critic.test.mjs
```

Exit 1, tests 1, fail 1; hidden value assertion passes, visible label actual `레시피 선택`, expected `/V60/`. Correct the post-build programmatic assignment and add coverage for this existing action before merge. No code edits, live Notion access, merge, push, or deployment performed.

## Final re-review — commit 75383c7849b3dc0ccec00542cb5115b15189fa62

**Verdict: Approve. All required findings are resolved.**

Reviewed the final incremental fix: the recipe-detail `new-record` action now synchronizes its trigger immediately after assigning recipeId, using the existing helper and current view data. The existing action-path test now asserts the visible V60 label. This directly addresses the previously missed path without introducing a separate state mechanism or changing submission behavior.

Independent targeted verification reran all four original/additional reproduction cases against the final source:

```sh
node --test --test-name-pattern='independent critic' /tmp/record-picker-critic.test.mjs
```

Exit 0; tests 4, pass 4, fail 0. Covered initial server-page append, restored draft labels, selected filter persistence outside search results after rerender, and recipe-detail action prefill labels.

Inspected final author evidence: `npm-test.tap` reports 610/610; `build-pages.txt` version `6b691e271650`; `check-pages.txt` passes; browser harness and `browser.json` explicitly confirm the recipe-detail action hidden ID/visible name agreement at 390px and 1440px, with zero page errors. The full suite was not redundantly rerun by Critic.

No required unresolved issue remains in the reviewed change. Limitations remain: browser coverage uses a local fixture; no live Notion access, production deployment check, or real mobile keyboard/device check was performed by Critic. Original findings and earlier Request changes decisions above are retained as historical review evidence. No implementation edits, push, merge, or deployment were performed by Critic.
