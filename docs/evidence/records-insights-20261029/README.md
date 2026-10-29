# Records insights verification

## Final results

- `npm test`: 632 tests passed, 0 failed. Full output: `npm-test-final.txt`.
- `npm run build:pages`: passed, build version `9cdb7caa5faa`. Output: `build-pages.txt`.
- `npm run check:pages`: passed. Output: `check-pages.txt`.
- `node docs/evidence/records-insights-20261029/browser-validation.mjs`: passed against the built Pages output. Output: `browser-validation.txt`.
- `git diff --check`: passed.

The browser run covered widths 320, 550, 768, 1024, and 1440 CSS pixels. Each final screenshot is saved as `records-<width>.png`. `records-320-overflow-before-fix.png` shows the initial 320px header overflow before the fix.

The browser used a memory-backed OPFS fixture and a fake test token. All 75 Notion API requests were intercepted and answered locally; no Notion account or real connection data was used. The run found no page or console errors, failed responses, unmocked external requests, or horizontal page overflow. It exercised the recent-bean list, date-spaced chart, text alternative, best record and snapshot conditions, selected-bean changes, recipe-filter isolation, and the record create/delete dialogs.

The bean control is a labelled, enabled native `<select>` and the browser check confirmed it can receive focus; selecting another option updated the chart and best record. Synthetic ArrowDown/End key events did not change this native control in headless Chrome, so the browser automation used Playwright's native `selectOption` operation for the selection-change assertion. The control retains the browser's built-in keyboard behavior; the run did not independently verify that behavior with a physical keyboard.

## Failure and repair history

The first full suite run reported 603/631 passing. The initial output was overwritten by later successful runs, so the final output is preserved separately above; the failure categories and repairs were:

- 15 HTTP integration cases could not bind listeners under the default sandbox (`listen EPERM`). The full suite was rerun with the authorized escalation, and the final run passed.
- 10 isolated build fixtures did not include the newly required insights modules; fixture contents were updated.
- 1 Service Worker cache-list assertion did not include the new modules; the expected app-file list was updated.
- 1 SVG namespace test leaked a modified module into cleanup; the test now saves and restores the exact source.
- 1 one-point chart DOM assertion expected a selector the fake DOM did not implement; the selector check was corrected.

Initial browser attempts also exposed two test/production issues. The built insights module imported `../../lib/domain.mjs`, which escaped the Pages bundle and requested `/lib/domain.mjs` (404); it now imports the bundled `../domain.mjs`, with a build regression test. The browser fixture initially stringified snapshot objects as `"[object Object]"`; it now JSON-encodes snapshots and checks that the production repository decodes all fixture records before launching Chrome.

The browser run then found the real 320px overflow: the navigation tabs and header tools occupied one row and extended the document to 381px. At widths up to 360px the tabs now wrap below the logo and header tools. The final five-width run passed.

The first loopback server attempt was denied by the sandbox (`listen EPERM`); the validation was rerun with escalation on a temporary loopback-only server. Notion traffic remained intercepted by the test fixture throughout.
