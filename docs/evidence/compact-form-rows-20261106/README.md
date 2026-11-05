# Compact form row evidence

This directory holds the local browser fixture, layout checks, screenshots, and command logs for the compact form row change.

The fixture uses synthetic bean, recipe, token, and data source values. It does not connect to Notion or save data.

## Test history

The first `npm test` run exited with code 1 because the test DOM stub has no `classList` property. The new class assignment now uses the existing `className` API.

The second `npm test` run exited with code 1 after 730 of 748 tests passed. The 18 failures all reported `listen EPERM` while binding to `127.0.0.1` in HTTP tests. See [the sandbox failure log](npm-test-sandbox-failure.txt).

The first browser check exited with code 1 because its parser counted spaces inside the computed `minmax()` value as separate grid tracks. The check now compares the rendered field positions.

The second browser check exited with code 1 because CSS reports a 3 px outline width even when the token input's outline style is `none`. The check now reads the outline style and the visible wrapper outline.

The third browser check exited with code 1 because the fixture has two picker search fields in the DOM. The check now scopes the search field to the open picker dialog.

The fourth browser check exited with code 1 because the picker trigger renders at 46 px. A later `.button` rule overrides its 48 px minimum. The check now preserves the measured 46 px target, and the layout change does not touch picker sizing.

The fifth browser check exited with code 1 because the preview's `view.bind()` stub omitted the `setDirty` callback used by form input events. The fixture now provides that callback.

## Browser checks

`verify-layout.mjs` checks 320 px, 390 px, desktop, and a 320 px high viewport. It checks the bean and recipe rows, Notion fields, and the record selection picker. Screenshots and measured results are stored beside this file.

## Final checks

- `npm test` exited with code 0. All 748 tests passed. See [the test log](npm-test.txt).
- `npm run build:pages` exited with code 0 and produced build `f1f870413165`. See [the build log](build-pages.txt).
- `npm run check:pages` exited with code 0. See [the page check log](check-pages.txt).
- `node docs/evidence/compact-form-rows-20261106/verify-layout.mjs` exited with code 0. Chrome checked 16 cases with no page errors. See [the browser results](browser-results.json) and [the browser log](browser-validation.txt).

The 390 px by 320 px viewport approximates the reduced screen area while a keyboard is open. The check did not run on an iPhone and did not open an iOS keyboard.
