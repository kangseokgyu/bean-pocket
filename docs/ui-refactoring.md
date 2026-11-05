# Bean Pocket UI/controller refactoring

Status: R0 baseline and R1 shared-helper extraction are complete. R2-R6 are pending.

## Goal

Move UI rendering, form construction, event interactions, and safe controller read coordination into small modules. Preserve all user-visible behavior, the current DOM and selectors, and the public createAppView and createAppController interfaces.

The implementation stays in the feature worktree based on 0e0c2f3. It does not change domain, data, submission, or platform behavior. It does not change CSS, add a framework, or write to a live Notion workspace. Main owns browser baseline and candidate comparison. Worker owns Node tests and implementation.

## Pinned interfaces

createAppView(document = globalThis.document, { schedule, cancelSchedule, validateToken } = {}) remains exported. Its returned methods remain showStatus, clearStatus, showConnection, clearSecret, beginConnectionSave, finishConnectionSave, editConnection, cancelConnection, showConnectionSuccess, finishStartup, setState, setFrozen, clearForm, clearDraft, setRouteReadState, renderData, currentRoute, onRouteChange, renderRoute, resolveRecordDraft, showBeanForm, showRecipeForm, showRecordForm, setSearchOptions, setSearchOptionsState, clearSearchOptions, showEntrySuccess, showDeleteResult, showUnresolved, and bind.

createAppController retains its current options object and its returned methods: initialize, connect, confirmCurrent, resolveOperation, refresh, submit, setDirty, setFrozen, getState, bind, loadRoute, loadMore, loadMoreInsights, loadSearchOptions, setRecordFilters, and setRecordInsightsBean.

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
| R6 | Review all retained and additive tests, update docs/pwa-contracts.md, docs/verification.md, root README.md, docs/implementation-status.md, and docs/pwa-usage.md. Record final limits and verification evidence. | npm test, npm run build:pages, and npm run check:pages pass after the last edit. Main completes browser comparison separately. |

Every implementation phase writes tests first. A focused test for a new module must fail because the module or required behavior check is absent, then pass after the move. After each phase, run all three required commands and save the original command output in docs/evidence/ui-refactor-20261106/. Do not start the next phase until the current phase is green. Commit each verified phase separately.

## PWA build and source checks

For every new file, update both build and check file lists, allowed directory sets, checked-text lists, service-worker cache inputs, expected app-file tests, and fixture paths. Keep the SVG namespace exception limited to local element creation. Add symlink checks for every new nested source and output ancestor. Keep unsafe-URL, secret, API-path, manifest, hash, import-closure, and cache checks. Keep the existing manifests independent; consolidating them is out of scope.

## Browser evidence ownership

Main reported that the baseline harness in docs/evidence/ui-refactor-browser-20261106/ passed 21 cases. The run covered nine screens at 390px and 1280px, two form cancel/no-write cases, dialog identity/input/focus through rerender, and a favorite toggle. It used createAppView, createAppController, memoryPlatform, and fakePwaNotion, with no live Notion access. Recipe-list statistics may remain in the lazy loading state until detail is opened; the comparison must not require that the entire recipe object omit loading status. Main owns the candidate replay and exact DOM comparison. Worker does not run or modify the browser scripts or their artifacts.
