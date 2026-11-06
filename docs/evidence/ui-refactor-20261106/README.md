# Bean Pocket UI/controller refactor evidence

Baseline for feature branch codex/bean-pocket-ui-refactor at 0e0c2f3. The original /Users/kangseokgyu/workspace/AX-1day checkout remains untouched.

## R0 Node baseline

| Command | Result | Log |
| --- | --- | --- |
| npm test in the default sandbox | Exit 1. Eighteen localhost HTTP tests failed with listen EPERM; see the full log. | npm-test-sandbox-denied.log |
| npm test with approved loopback access | Exit 0. 748 tests passed, 0 failed. | npm-test-baseline.log |
| npm run build:pages | Exit 0. Pages build 214f2f1363ed. | build-pages-baseline.log |
| npm run check:pages | Exit 0. Pages artifact check passed. | check-pages-baseline.log |

Commands ran in /Users/kangseokgyu/.codex/worktrees/bean-pocket-ui-refactor/AX-1day. The default-sandbox failure is an environment permission result, not a product test failure. The approved rerun passed the complete suite.

## Main-owned browser baseline

Main reported 21 passing cases from docs/evidence/ui-refactor-browser-20261106/. The run used Chromium at 390px and 1280px across nine screens, then checked form cancel without API or journal writes, dialog identity/input/focus after rerender, and favorite toggling. Recipe-list statistics may remain lazy-loading until the detail is opened. Main owns the candidate run and DOM comparison. Worker did not run browser tests or include browser-owned files in its commits.

## R1 shared UI helpers

Extracted the DOM creator and spinner, action/navigation/decorative/trash icons, buttons, form fields/actions, and entry-dialog helpers into `pwa/ui/shared/`. `view.mjs` still owns routes, state, and composition. The pinned `createAppView` method list now includes the existing `finishStartup` and `showDeleteResult` methods; main owns the browser public-key comparison.

The helper DOM tests initially failed because `pwa/ui/shared/dom.mjs` did not exist. The nested source-symlink test initially failed because the builder accepted `ui/shared` as a symlink. Both tests pass with the extraction and the explicit source-directory boundary check.

| Command | Result | Log |
| --- | --- | --- |
| `node --test test/pwa-ui-shared.test.mjs test/check-animation.test.mjs test/pwa-build.test.mjs test/pwa-product-build.test.mjs` | Exit 0. 36 passed, 0 failed. | Included in the full suite output below. |
| `npm test` | Exit 0. 756 passed, 0 failed. | [r1/npm-test.log](r1/npm-test.log) |
| `npm run build:pages` | Exit 0. Pages build `4d78a122c7b1`. | [r1/build-pages.log](r1/build-pages.log) |
| `npm run check:pages` | Exit 0. Artifact and security checks passed. | [r1/check-pages.log](r1/check-pages.log) |
| Critic independent focused suite | Exit 0. 36 passed, 0 failed. | [r1/critic-focused.log](r1/critic-focused.log) |
| Critic independent view suite | Exit 0. 191 passed, 0 failed. | [r1/critic-view.log](r1/critic-view.log) |

R1 also updates the module allowlist, text scan, byte/hash coverage, service-worker cache and expected app-file list, SVG exception scope, and import-closure check. `ui/shared/icons.mjs` is the only new helper module exempted for direct SVG element constructors. The view facade and button modules remain subject to external-URL rejection. The main-owned browser baseline and artifacts were not changed.

## R2/R3-A screens and forms

Moved the home, bean, and recipe renderers into `pwa/ui/screens/`. Moved the bean and recipe form builders into `pwa/ui/forms/`. `view.mjs` still owns route state, drafts, dialog composition, and event bindings. The build and checker cover the eight added modules, including the shared UI helpers. Source symlink tests move the populated screen and form directories outside the source tree before linking to them.

The first focused run after extraction found two failures. The bean detail renderer used the record list's pending message instead of its original message. The service worker test expected the previous cache file list. The fixes restore the bean detail message and add all eight paths to the independent cache expectation.

| Command | Result | Log |
| --- | --- | --- |
| Focused suite after initial extraction | Exit 1. 222 passed, 2 failed. | [r2a/focused-before-fixes.log](r2a/focused-before-fixes.log) |
| `node --test --test-reporter=spec test/pwa-build.test.mjs test/pwa-product-build.test.mjs test/pwa-ui.view.test.mjs` | Exit 0. 224 passed, 0 failed. | [r2a/focused.log](r2a/focused.log) |
| `npm test` with loopback access | Exit 0. 763 passed, 0 failed. | [r2a/npm-test.log](r2a/npm-test.log) |
| `npm run build:pages` | Exit 0. Pages build `5393fb41e8b6`. | [r2a/build-pages.log](r2a/build-pages.log) |
| `npm run check:pages` | Exit 0. Pages artifact check passed. | [r2a/check-pages.log](r2a/check-pages.log) |

## R2/R3-B brew and records

Moved the brew and records screens and the record form. `records-insights-view.mjs` still renders the charts and comparisons. The view facade still owns drafts and refreshes the contents of the existing dialog without replacing it. The record form and records screen receive the existing picker builder and trigger updater until R3-C moves the picker.

| Command | Result | Log |
| --- | --- | --- |
| Pre-extraction behavior and release checks | Exit 1. Five behavior checks passed. The release check could not find `ui/forms/record-form.mjs`. | [r2b/before.log](r2b/before.log) |
| Focused view, insights integration, and Pages tests | Exit 1. 229 passed. The exact output file list had two filenames out of order. | [r2b/focused-before-fixture-fix.log](r2b/focused-before-fixture-fix.log) |
| Focused rerun of the exact output file list test | Exit 0. 1 passed. | [r2b/focused.log](r2b/focused.log) |
| `npm test` with loopback access | Exit 0. 763 passed, 0 failed. | [r2b/npm-test.log](r2b/npm-test.log) |
| `npm run build:pages` | Exit 0. Pages build `a22109eb9b98`. | [r2b/build-pages.log](r2b/build-pages.log) |
| `npm run check:pages` | Exit 0. Pages artifact check passed. | [r2b/check-pages.log](r2b/check-pages.log) |

## R3-C interactions

Moved the search picker DOM and actions, delegated event binding, pull-to-refresh gesture, and status toast into `pwa/ui/interactions/`. The view retains drafts, dialog ownership, save phases, and the decision to suppress the toast when an inline spinner already shows progress. Event listeners retain their existing app lifetime. The public view methods are unchanged.

| Command | Result | Log |
| --- | --- | --- |
| Pre-extraction behavior and release checks | Exit 1. Seven behavior checks passed. The release module was absent and the builder did not reject the new directory symlink. | [r3c/before.log](r3c/before.log) |
| Focused view, UI integration, screen loading, and Pages tests | Exit 0. 273 passed, 0 failed. | [r3c/focused.log](r3c/focused.log) |
| Focused output symlink check | Exit 0. The checker rejected a populated `ui/interactions` directory reached through a symlink. | [r3c/output-symlink.log](r3c/output-symlink.log) |
| `npm test` with loopback access | Exit 0. 765 passed, 0 failed. | [r3c/npm-test.log](r3c/npm-test.log) |
| `npm run build:pages` | Exit 0. Pages build `dbf1cd99429b`. | [r3c/build-pages.log](r3c/build-pages.log) |
| `npm run check:pages` | Exit 0. Pages artifact check passed. | [r3c/check-pages.log](r3c/check-pages.log) |
| Published view import cycle check | Exit 0. No cycles in 27 modules. | [r3c/import-cycles.log](r3c/import-cycles.log) |

## R4-R5 controller reads and Pages integration

Moved cache keys, expiry and eviction, option reads, route loaders, and insight projection into `pwa/ui/controller/`. The controller still owns connection and journal handling, write order, request generations, and the checks before publishing a response. Deferred reads still start after the first screen is published.

| Command | Result | Log |
| --- | --- | --- |
| Controller read tests before extraction | Exit 1. Node could not import the missing cache module. | [r4-r5/before.log](r4-r5/before.log) |
| Release checks before integration | Exit 1. The controller module was missing from the output and the builder accepted the directory symlink. | [r4-r5/release-before.log](r4-r5/release-before.log) |
| Focused controller, UI, connection, write, and Pages tests | Exit 0. 141 passed, 0 failed. | [r4-r5/focused.log](r4-r5/focused.log) |
| `npm test` with loopback access | Exit 0. 769 passed, 0 failed. | [r4-r5/npm-test.log](r4-r5/npm-test.log) |
| `npm run build:pages` | Exit 0. Pages build `bf23f84f2158`. | [r4-r5/build-pages.log](r4-r5/build-pages.log) |
| `npm run check:pages` | Exit 0. Artifact and security checks passed. | [r4-r5/check-pages.log](r4-r5/check-pages.log) |

The release tests check the four modules for byte equality, version hash changes, URL scanning, precache coverage, and imports without cycles. The builder and checker reject symlinks to populated controller directories.

## Feature branch integration with `250198d`

Integrated `250198d` into the feature branch after R4-R5 passed. The three-way comparison showed that `main` added two compact fieldset classes to code that the feature branch had moved. The merge applies those classes in `forms/bean-form.mjs` and `forms/recipe-form.mjs`. The five connection fields keep the incoming class. The source `index.html` and `styles.css` match `250198d` byte for byte.

| Command | Result | Log |
| --- | --- | --- |
| `npm test` with loopback access | Exit 0. 769 passed, 0 failed. | [main-integration/npm-test.log](main-integration/npm-test.log) |
| `npm run build:pages` | Exit 0. Integrated Pages build `9b8bf554b507`. | [main-integration/build-pages.log](main-integration/build-pages.log) |
| `npm run check:pages` | Exit 0. Artifact and security checks passed. | [main-integration/check-pages.log](main-integration/check-pages.log) |
| Built view DOM checks with the Node fixture | Exit 0. Checked five connection fields, two compact fieldsets, and the home wordmark. The first check used a descendant selector the fixture does not support. | [Pass](main-integration/merge-contract.log), [fixture failure](main-integration/merge-contract-selector-failure.log) |

## R6 source map and verification notes

The [source map](../../ui-refactoring.md#where-to-start) links the entry points for forms, screens, events, and controller reads. The README, usage guide, contracts, implementation status, and verification notes point to the map or the logs. R6 changes documentation only. The integrated build and test results above apply to the last product edit. See the [final Chromium comparison and publication record](../ui-refactor-browser-20261106/README.md).
