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

## Main integration and review

- Critic: **Approve**; no Critical or Required changes. The optional note on the `pathLength` conditional was covered by the direct browser check; no implementation change was needed.
- The feature commit `d83f424be72f30f3e75f76d3b8a8b443fe4ecbc1` was integrated into `main` with fast-forward.
- The first sandboxed `npm test` attempt had 15 localhost HTTP test failures (`listen EPERM: operation not permitted 127.0.0.1`); the other 580 tests passed. Rerunning with the required local network permission passed all 595 tests. No test or application code was changed for this environment issue.
- Main `npm run build:pages` passed with version `1d1477f2d4d9`; `npm run check:pages` passed.

See `main-test.log`, `main-build.log`, and `main-check.log` for the successful main verification runs.
