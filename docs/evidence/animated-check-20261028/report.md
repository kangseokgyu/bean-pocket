# Animated check

## Changes

- Reversed the check path so the short stroke draws before the long stroke. Normalized its path length for SVG dash animation.
- Applied the 580ms check draw and 240ms settle after a 580ms delay to PWA save, delete, confirmation and completion status icons, and to server-page save/connection icons.
- Reduced-motion keeps the check fully drawn without animation. Repeated success renders keep the same icon nodes and do not restart the animation; failed operations return to idle/error feedback.
- No new runtime dependency was added. Existing success visibility durations were preserved.

## Verification

- `node --test test/check-animation.test.mjs test/pwa-ui.view.test.mjs` — 128 passed, 0 failed.
- `npm test` — 595 passed, 0 failed.
- `npm run build:pages` — passed; build version `1d1477f2d4d9`.
- `npm run check:pages` — passed.
- `node docs/evidence/animated-check-20261028/browser-check.cjs` — 17 Chrome checks passed at 390×844, including failed→success transitions, a 200–250ms mid-draw frame, 1.12 settle, same-success rerender, reduced motion, server demo save and server connection failure. No unexpected console issues or external requests. The recorded 503 console message is the deliberate mocked connection failure.

See `browser-results.json` for computed styles and `*-in-progress.png`, `*-complete.png`, and `*-reduced-motion.png` for browser captures. `red-check.log` records the pre-implementation failures.
