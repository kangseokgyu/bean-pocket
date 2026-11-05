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

## Phase results

R1-R6 are pending. Each phase records the commands, exit codes, test counts, and logs here before the next phase starts.
