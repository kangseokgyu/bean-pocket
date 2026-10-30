# Contextual button styles

Plain buttons now use a warm ivory outline with forest text. Back controls use a compact arrow pill, main actions use forest fill, pagination uses a wide sand tint, and search utilities stay compact. Existing tab, card, icon, save, and delete styling remains in place.

The browser comparison used the recipe detail page with the same fixture data in both directions.

| Direction | Appearance | Choice |
| --- | --- | --- |
| Warm outline | Ivory surface and warm border with forest text | Selected. It fits the cream page and keeps the forest fill reserved for main actions. |
| Soft sage | Sage surface and sage border with forest text | Compared. It blends with the app’s selected-card colors and weakens the primary-action distinction. |

## Screenshots

- Bean detail: [desktop](bean-detail-desktop.png) and [mobile](bean-detail-mobile.png).
- Direction comparison: [warm outline](direction-warm-outline-1440.png) and [soft sage](direction-soft-sage-1440.png).
- Keyboard focus on the recipe back control: [mobile](recipe-detail-keyboard-focus-mobile.png).
- Search utility and pagination: [mobile brew picker](brew-search-pagination-mobile.png).
- Disabled insight pagination and full-width record pagination: [desktop records page](records-insights-disabled-pagination-desktop.png).

The browser harness verifies the original button labels and `data-action` values, back `data-route` values, 44px minimum hit targets, `:focus-visible`, disabled pending state, wide pagination, horizontal overflow, and browser page errors. Results are in [browser-results.json](browser-results.json). It uses the built app and in-memory fixture data. No showcase page or dependency was added.

## Verification

- `npm test`: exit 0, 665 passed, 0 failed, 0 skipped.
- `npm run build:pages`: exit 0, build version `046426a7f8d0`.
- `npm run check:pages`: exit 0.
- `git diff --check`: exit 0.
- `browser-check.cjs`: exit 0, six scenario groups passed with no page errors.

The first sandboxed browser launch could not bind localhost (`listen EPERM`). The final run used the project’s dist-backed fixture harness with local loopback access. A loading fixture alone did not remain disabled after the view applied its global state, so the disabled screenshot uses the app’s real pending state.

Browser screenshots use Chromium and generated fixture data. iOS Safari, a physical phone, and assistive technology were not tested.
