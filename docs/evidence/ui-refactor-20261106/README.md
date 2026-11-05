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

R1 also updates the module allowlist, text scan, byte/hash coverage, service-worker cache and expected app-file list, SVG exception scope, and import-closure check. `ui/shared/icons.mjs` is the only new helper module exempted for direct SVG element constructors. The view facade and button modules remain subject to external-URL rejection. The main-owned browser baseline and artifacts were not changed.

## Remaining phases

R2-R6 remain pending. Each phase records its commands, exit codes, test counts, and logs here before the next phase starts.
