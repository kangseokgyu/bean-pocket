# Bean Pocket UI/controller refactoring

[검색할 수 있는 UI 모듈 지도](ui-module-map.html)에서 각 파일과 직접 import를 확인할 수 있다.

Status: R0-R6 are complete. The [general Pages build](https://kangseokgyu.github.io/bean-pocket/) is `9b8bf554b507`. See the [test and build logs](evidence/ui-refactor-20261106/README.md) and the [browser and publication checks](evidence/ui-refactor-browser-20261106/README.md).

## Goal

Move UI rendering, form construction, event interactions, and safe controller read coordination into small modules. Preserve all user-visible behavior, the current DOM and selectors, and the public createAppView and createAppController interfaces.

The original comparison assigned browser baseline/candidate ownership to main and Node tests/implementation to the worker; that split describes the 2026-11-06 comparison only. The historical baseline source and result files remain unchanged.

## Where to start

| Change | Start here |
| --- | --- |
| Bean form fields | [Bean form](../pwa/ui/forms/bean-form.mjs). The [view](../pwa/ui/view.mjs) composes the dialog and owns the draft. |
| Brew bean or recipe picker | [Brew screen](../pwa/ui/screens/brew.mjs) for cards and result markup. [Events](../pwa/ui/interactions/events.mjs) handles input and selection. [Loader](../pwa/ui/controller/loader.mjs) reads the route and first page. |
| Record form and record filters | [Record form](../pwa/ui/forms/record-form.mjs) and [records screen](../pwa/ui/screens/records.mjs) use the [search picker](../pwa/ui/interactions/search-picker.mjs). |
| Event bindings | [Events](../pwa/ui/interactions/events.mjs) starts at `bindEvents`. [Pull to refresh](../pwa/ui/interactions/pull-to-refresh.mjs) and [status toast](../pwa/ui/interactions/status-toast.mjs) have their own entry points. |
| Read cache keys, expiry, and eviction | [Controller cache](../pwa/ui/controller/cache.mjs). The [controller](../pwa/ui/controller.mjs) owns both cache instances and decides when to invalidate them. |
| Search and record insights | [Controller search](../pwa/ui/controller/search.mjs) handles option reads. [Controller record insights](../pwa/ui/controller/record-insights.mjs) reads comparison pairs and projects the model; [records insights view](../pwa/ui/records-insights-view.mjs) renders it. |

Run `npm test`, `npm run build:pages`, and `npm run check:pages` after product edits. Use `node --test test/pwa-controller-reads.test.mjs test/pwa-screen-loading.test.mjs` for focused read checks. The [verification logs](evidence/ui-refactor-20261106/README.md) distinguish the refactor build from the build after merging `250198d`.

## Pinned interfaces

createAppView(document = globalThis.document, { schedule, cancelSchedule, validateToken } = {}) remains exported. Its returned methods remain showStatus, clearStatus, showConnection, clearSecret, beginConnectionSave, finishConnectionSave, editConnection, cancelConnection, showConnectionSuccess, finishStartup, setState, setFrozen, clearForm, clearDraft, setRouteReadState, renderData, currentRoute, onRouteChange, renderRoute, resolveRecordDraft, showBeanForm, showRecipeForm, showRecordForm, setSearchOptions, setSearchOptionsState, clearSearchOptions, showEntrySuccess, showDeleteResult, showUnresolved, and bind.

createAppController retains its current options object and its returned methods: initialize, connect, confirmCurrent, resolveOperation, refresh, submit, setDirty, setFrozen, getState, bind, loadRoute, loadMore, loadMoreInsights, loadSearchOptions, setRecordFilters, and setRecordInsightsBean.

The controller keeps separate route, search, and insight generations. It owns aborts, the connection revision, stale response checks, and the order of the initial render, deferred reads, and post-save refresh. Read modules receive only the inputs and callbacks they need. Connection-session extraction was left out because the active connection, write lock, journal recovery, and pending state must advance together. Moving them separately would split ownership of the write and recovery sequence.

## Behavior contracts to preserve

- Keep route names, element order where users and tests depend on it, IDs, classes, data actions, labels, and accessibility attributes.
- Preserve the existing draft and field restoration across route and data renders. Keep the active dialog node, values, and focus in the existing in-place `renderData` paths; route and connection transitions retain their existing rebuild/reset behavior.
- Keep cancel paths local. They clear the relevant draft and never submit or change the journal.
- Keep loading, success, error, unknown, and partial states distinct. Preserve button spinners and avoid duplicate progress toasts.
- Keep favorite updates, picker text and selection, search generations, query cursors, route aborts, connection revisions, cache TTL and invalidation independent.
- Keep unknown or partial writes blocked from duplicate submission and connection replacement.
- Keep update preparation blocked while any controlled window has dirty input or pending work.
- Preserve all existing assertions. Static-source assertions may move only with their assertion scope intact and paths updated.

Existing Node characterization remains in test/pwa-ui.view.test.mjs, test/pwa-ui.integration.test.mjs, test/pwa-ui.records-insights.integration.test.mjs, test/pwa-screen-loading.test.mjs, test/pwa-records-insights.test.mjs, and the existing connection, favorite, submission, delete, lifecycle, update, and build tests. New module tests are additive. Do not replace user-facing behavior assertions with implementation-call assertions.

## Structure candidates

Candidate A groups each route's screen, forms, and event handling into route feature modules. It keeps a route's code nearby, but couples rendering to interaction state and duplicates shared button, dialog, and field behavior.

Candidate B keeps shared DOM helpers, screens, forms, and interactions in separate layers. The view facade owns route state, drafts, node reuse, and composition. Screen modules render from explicit inputs. Form modules build controls from explicit inputs. Interaction modules receive only the DOM roots and callbacks they use. Controller helpers move only when their state and safety boundary stay clear.

Candidate B is selected. It matches the requested module groups and the existing view/controller split. The dependency direction is shared helpers to forms to screens, with the facade importing those modules. Event modules do not get imported by screen builders. No module imports the facade. Controller modules use small arguments or focused factories, not one shared context bag. Do not merge route, search, insight, or connection generations.

## R0-R6 execution plan

| Phase | Work | Exit check |
| --- | --- | --- |
| R0 | Record contracts, compare two local shapes, record the baseline tests and build checks, and link the main-owned browser baseline. | Contract and evidence paths are committed. Baseline npm test, npm run build:pages, and npm run check:pages are green. |
| R1 | Extract shared DOM, icon, button, field, dialog, and spinner helpers. Keep UI state, routes, and composition in the view facade. Include new files in build/check, hash, source scan, cache, and fixture contracts; reject the nested `ui/shared` source symlink. | Focused helper tests fail before module creation and pass after extraction. Existing UI tests and PWA security checks remain green. |
| R2 | Move home, beans, recipes, records, and brew screen rendering. Keep view assembly and state in the facade. | Focused screen tests and existing view tests pass. |
| R3 | Move bean, recipe, and record form builders, then event bindings, picker, pull-to-refresh, and status toast behavior. | Form, event, draft, cancel, focus, picker, spinner, and toast tests pass through the facade. |
| R4 | Extract safe screen cache, loader, search-option, and insight logic into pwa/ui/controller/. Keep each abort, route generation, search generation, and connection revision distinct. Leave connection-session logic in controller.mjs unless it can move without splitting lock, journal, and active-connection ownership. | Controller unit and facade tests pass, including pagination, cache TTL/invalidation, stale responses, favorite writes, and connection-boundary cases. |
| R5 | Extend the PWA build/check, source scanning, app cache, version/hash, fixture, SVG, and nested-directory symlink contracts for screen, form, interaction, and controller modules as they are extracted. | Every added module is included and checked. Security-negative tests still reject unsafe sources and symlink ancestors. |
| R6 | Review retained and new tests. Update the source map and verification notes. | npm test, npm run build:pages, and npm run check:pages pass after the last product edit. Main completes browser comparison separately. |

Every implementation phase writes tests first. A focused test for a new module must fail because the module or required behavior check is absent, then pass after the move. After each phase, run all three required commands and save the original command output in docs/evidence/ui-refactor-20261106/. Do not start the next phase until the current phase is green. Commit each verified phase separately.

## PWA build and source checks

For every new file, update both build and check file lists, allowed directory sets, checked-text lists, service-worker cache inputs, expected app-file tests, and fixture paths. Keep the SVG namespace exception limited to local element creation. Add symlink checks for every new nested source and output ancestor. Keep unsafe-URL, secret, API-path, manifest, hash, import-closure, and cache checks. Keep the existing manifests independent; consolidating them is out of scope.

## Browser evidence ownership

The historical baseline harness in docs/evidence/ui-refactor-browser-20261106/ passed 21 cases. That run covered nine screens at 390px and 1280px, two form cancel/no-write cases, dialog identity/input/focus through rerender, and a favorite toggle. It used createAppView, createAppController, memoryPlatform, and fakePwaNotion, with no live Notion access. Recipe-list statistics may remain in the lazy loading state until detail is opened; the comparison must not require that the entire recipe object omit loading status. The baseline and result files remain historical evidence.

Main recorded 22 passing Chromium cases through R3 in `482f2d7`. That run predates R4 and the `250198d` integration. The final browser comparison uses a new baseline at `250198d`.


## Current browser regression

The reusable Chromium regression now lives in scripts/browser/verify.mjs and runs with npm run test:browser. It checks the current checkout with fake Notion data, including 390px and 1280px layouts, bean and recipe dialogs, input/focus preservation, a draft restored after reload, and explicit cancel cleanup. It does not call live Notion. PR and main pushes run this command through .github/workflows/verify.yml. The dated comparison scripts and result files above are retained unchanged.
