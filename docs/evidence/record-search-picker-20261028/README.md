# Record search picker

## Design contract

The record form and record filters share one searchable picker pattern. The form opens it from **원두 선택** or **레시피 선택**; the filters open it from **모든 원두** or **모든 레시피**. Each picker is a native dialog so browser focus trapping and Escape behavior remain available, including when the record form dialog is already open. On narrow screens it is a bottom sheet; on wider screens it is a centered dialog.

The dialog contains a name search, explicit search-term clearing, available result rows, loading/error/empty states, retry, and the existing cursor-based continuation. Selecting an option updates the hidden form control used by `FormData`, updates the visible selection name and any already-available summary, then closes and restores focus. The filter page also offers a reset action. Empty final lists link to the matching bean or recipe page.

The repository `searchOptions` contract, controller request-generation guards, record write lock, form draft handling, selected filter behavior, and paging cursors remain the source of truth. Hidden selects are not natively required because browsers cannot reliably focus a clipped invalid select; required picker values are checked on submit and focus the appropriate trigger.

## Acceptance checks

- Record form and filter controls use the same searchable dialog UI and retain their distinct placeholder labels.
- Keyboard users can open, search, clear, select, close, and return focus; Escape closes only the picker above an open record form.
- Results show names and only details already present in current view data or the search response.
- Loading, retryable errors, empty search results, unregistered lists, and additional pages are visible and actionable.
- Filter selection and reset continue through `setRecordFilters`; record form selection updates its draft/dirty state without replacing the open form.
- Existing search queries and result generations remain guarded against late responses.

## Verification evidence

- RED: `node --test test/pwa-ui.view.test.mjs` initially failed on the three new picker expectations; see `view-red.tap`.
- Critic regressions: the three independently reported issues were reproduced with 3/3 failures, then fixed and passed 3/3; see `critic-red.tap` and `view-critic-green.tap`. The regression checks cover initial-page pagination, draft/route-prefill labels, and selected-filter retention after a search rerender.
- Focused GREEN after fixes: `node --test test/pwa-ui.view.test.mjs` passed 136/136; `node --test test/pwa-screen-loading.test.mjs` passed 8/8. See `view-critic-green.tap` and `controller-critic-green.tap`.
- Full suite after fixes: `npm test` passed 610/610; see `npm-test.tap`.
- Build after fixes: `npm run build:pages` passed and produced version `9899dc883920`; `npm run check:pages` passed. See `build-pages.txt` and `check-pages.txt`.
- Browser after fixes: `browser-check.cjs` drove a local fixture with fake initial and searched option pages and no Notion calls or writes. `browser.txt` and `browser.json` record success at 390px and 1440px, including initial-page pagination, search/clear, selected-filter retention after rerender, details, filter reset, nested Escape, and custom required validation. Screenshots are `picker-390.png` and `picker-1440.png`.
- Browser setup notes: the bundled Playwright default headless shell was unavailable, so the fixture used installed Chrome. Three initial harness issues (fixture selector interpolation and accessible-name locator assumptions) are preserved in the `*-failure.txt` files and were corrected before the passing run.
- `git diff --check` passed after the fixes.

Browser use is limited to a local fixture and does not save to Notion.
