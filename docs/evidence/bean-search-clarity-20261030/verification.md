# Bean and recipe search clarity verification

- Final code: feature commit `8e18ac5`, integrated with `origin/main` commit `afb2aca` in merge commit `ffe0ff8`.
- TDD red: before the UI change, `node --test --test-name-pattern='brew name search is visibly labeled' test/pwa-ui.view.test.mjs` failed because the visible `원두 이름 검색` label was absent (`actual: undefined`). The new test passed after implementation.
- Critic regression red: with focusin bubbling enabled in the test DOM, a single clear-search click made two requests (`actual 2`, `expected 1`). See [critic-red.txt](critic-red.txt).
- Focused UI suite: `node --test test/pwa-ui.view.test.mjs` passed, 153/153 tests. See [brew-view-regression.txt](brew-view-regression.txt).
- Final tests: `npm test` passed, 642/642 tests after the focus fix. The earlier sandbox run could not bind HTTP integration test servers on `127.0.0.1` (`EPERM`); the full suite passed with loopback access. See [npm-test-final.txt](npm-test-final.txt).
- Pages build: `npm run build:pages` passed; updated output build version `20f7c100636c`. See [build-pages-final.txt](build-pages-final.txt).
- Pages artifact check: `npm run check:pages` passed. See [check-pages-final.txt](check-pages-final.txt).
- Commit whitespace check: `git show --check --oneline HEAD` passed.
- Mobile UI QA: not performed. The available browser inventory was empty and reported that the browser access host was unavailable; no mobile viewport or device rendering was inspected.

The view test double now emits bubbling `focusin` from `focus()`, matching browser behavior. The brew search test confirms that clear and browse-all actions each make one request for both beans and recipes. The fix marks the request in flight before focusing the search input, so the focus handler does not send a duplicate request. Existing paging, selection, and record-picker tests pass in the focused suite.
