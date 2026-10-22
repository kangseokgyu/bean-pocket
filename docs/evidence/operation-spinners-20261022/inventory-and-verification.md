# PWA operation spinner inventory and verification

Branch: `codex/operation-spinners`
Base `HEAD` before this change: `dec41556310831098972582bd668c487cb2eb98c`

## Async operation inventory

| User action / controller | Pending covers | Completion and failure behavior |
| --- | --- | --- |
| Startup initialization and retry (`initialize` → `runInitialization` → `withStartupLock`) | Saved-state/journal reads, lock retries, connection verification, install, and first `readLatest` | `initialize` owns pending through every return/error path; existing startup overlay remains available during startup checking. |
| New or replacement connection (`connect`) | Guard/journal reads, remote verification, durable connection commit, secret clearing, and first full `readLatest` | `finally` clears pending; verification/commit/read failures retain existing connection and draft rules. |
| Current connection re-confirmation/recovery (`confirmCurrent`) | Durable confirmation, fresh connection read, verification, repository read, full `runInitialization`, and its final `readLatest` | One pending interval now spans the entire chain; it no longer drops before reinitialization. |
| Manual refresh (`refresh`) | Full `readLatest`/repository read | Duplicate calls are rejected while pending; `finally` clears pending on success or failure. Pull-to-refresh still uses the existing full-page reload path and 12-spoke indicator. |
| Resolve an uncertain/partial operation (`resolveOperation`) | Durable resolution, fresh connection/source verification, page reads and validation, unresolved-journal reread, status update, and final `readLatest` when connected | Validation/read/confirmation failures exit through `finally`; unresolved state remains fail-closed. |
| Bean, bag, recipe (including steps), brew-record save; recipe copy; bean delete (`submit`) | Prepare/validation, durable execution, unresolved-journal reread for unknown/partial outcomes, status and final `readLatest` | `finally` clears pending on rejected validation, uncertain writes, and read errors. Draft/form clearing remains limited to definitive successful non-delete writes. |
| Internal `readLatest`, `readUnresolved`, `withStartupLock` | Run inside one of the pending-owning operations above | Helpers do not create nested pending intervals; their awaited reads remain covered by the caller. |

UI triggers covered by these paths are startup/retry, connection form submit, current-connection verification/recovery, operation-result resolution, bean deletion, all save/copy forms, and refresh. Opening forms, editing inputs, navigation, and synchronous UI validation do not start asynchronous work and do not show an operation spinner. No CRUD capability was added. Lifecycle freeze and dirty-draft guards are unchanged.

## Spinner behavior and guards

The body-level `.startup-loading` overlay now reuses one existing `makeSpinner` 12-spoke element for startup and ordinary pending operations, outside the touch-transformed `.page`. It is decorative (`aria-hidden="true"`); the status remains `role="status"`/polite live content and exposes `aria-busy` for the full pending interval. The existing 0.8s stepped animation is disabled by the reduced-motion media query. Success/`ready` status updates and status auto-hide cannot end the spinner while controller pending remains true; the success-message timer resumes only after pending ends. Controller `finally` blocks cover error, validation rejection, failed/uncertain writes, and failed follow-up reads, while existing duplicate-submit and lifecycle guards remain in force.

## Initial implementation verification (historical)

| Stage | Command | Result |
| --- | --- | --- |
| RED, before implementation | `TZ=UTC node --test test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs` | Exit 1, 60 tests: 58 passed, 2 expected failures (operation spinner absent; recovery-to-initialization pending gap). See `red-focused.log`. |
| GREEN, after implementation | `TZ=UTC node --test test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs` | Exit 0, 60/60 passed. See `green-focused.log`. |
| Environment-limited full test attempt | `TZ=UTC npm test` in default sandbox | Exit 1, 399/412 passed; 13 HTTP integration tests could not bind `127.0.0.1` (`listen EPERM`). Kept separately in `npm-test-sandbox-eprem.log`. This was a sandbox permission failure, not a timezone failure. |
| Required full test rerun | `TZ=UTC npm test` with local test execution elevated | Exit 0, 412/412 passed. See `npm-test-utc.log`. |
| Pages build | `npm run build:pages` | Exit 0; output version `8c6c01ff3dc3`. See `build-pages.log`. |
| Pages check | `npm run check:pages` | Exit 0. See `check-pages.log`. |
| Diff whitespace check | `git diff --check` | Exit 0. |

## Browser QA handoff

Worker did not start browser QA so Critic review and browser execution can proceed in parallel. DevTools MCP is not configured. Existing local harness is `/private/tmp/bean-pocket-browser-server.mjs`; it serves a synthetic `fakePwaNotion` fixture with no external Notion requests, but its `project` constant points at `/Users/kangseokgyu/workspace/AX-1day`. Copy it to a new `/private/tmp` script and retarget that constant to this worktree so its `dist` copy uses the just-built output; its fixture import can remain on the primary workspace. The companion `/private/tmp/startup-spinner-browser.cjs` uses a different worktree's dist and is only a reference for the installed Playwright/Chromium launch.

Verified existing runtime paths (no installation or profile changes):

- Playwright: `/Users/kangseokgyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`
- Chromium headless shell: `/Users/kangseokgyu/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`

Serve the built PWA at `http://127.0.0.1:4196/bean-pocket/`, delay synthetic `/__mock__` requests by about 150–250ms, then verify the operation spinner becomes visible during connection/save, stays visible across `saved`/`ready` and the follow-up query, and hides only after pending completes. Also check its 12 spokes, `aria-hidden`, `aria-busy`, and computed animation under `prefers-reduced-motion: reduce`.

## First Critic follow-up (historical, superseded by body overlay fix)

The P1 review cited Orchestrator's prior 390×844 browser result: at the bottom of the bean form, `scrollY=344` placed the inline spinner outside the viewport (`top=-232.6`, `bottom=-208.6`). Worker did not repeat browser QA. The status element now receives `data-pending="true"` only for ordinary pending work and is fixed below the safe-area top, centered, viewport-width constrained, translucent, and non-intercepting. It remains the single polite live region with `aria-busy`; the spinner stays decorative. Startup checking sets the operation state inactive and continues to show only the existing startup overlay. The operation overlay does not set `inert`; controller pending, duplicate-submit, dirty-draft, and lifecycle-freeze behavior is unchanged. Reduced-motion still disables the shared stepped spinner animation.

The P2 regression now asserts `spinner.hidden === false` for `saving`, `saved`, and `ready`, keeps it visible after 3.5 seconds in both success and ready states, and verifies it hides only after pending ends. The failure path similarly keeps the indicator until cleanup, then hides it while preserving the error message. A focused CSS rule assertion covers viewport positioning and non-interception. The exact `statusSpinner.hidden = true` mutant was applied temporarily: the new test failed at “spinner stays visible during saving” (1 test failed as expected), then the source was restored byte-for-byte. See `review-visibility-mutant.log`.

| Follow-up stage | Command | Result |
| --- | --- | --- |
| RED | `TZ=UTC node --test test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs` | Exit 1, 59/61 passed; the two new checks failed because the fixed viewport rule and pending marker were not implemented. See `review-red-focused.log`. |
| GREEN | `TZ=UTC node --test test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs` | Exit 0, 61/61 passed. See `review-green-focused.log`. |
| Visibility mutation proof | `TZ=UTC node --test --test-name-pattern='operation spinner stays visible through success' test/pwa-ui.view.test.mjs` with `statusSpinner.hidden = true` temporarily substituted | Exit 1 as expected; the visible-state assertion caught the mutant. Source restored byte-for-byte. See `review-visibility-mutant.log`. |
| Full required suite | `TZ=UTC npm test` with local test execution elevated | Exit 0, 413/413 passed. See `review-npm-test-utc.log`. |
| Updated Pages build | `npm run build:pages` | Exit 0; output version `51e146ba6592`. See `review-build-pages.log`. |
| Updated Pages check | `npm run check:pages` | Exit 0. See `review-check-pages.log`. |

Browser QA remains assigned to Orchestrator. Recheck the scrolled bean-save case and reduced-motion state against the rebuilt output; the focused test verifies the fixed CSS rule, but Worker did not make a new viewport measurement.


## Current body overlay fix and verification (2026-10-22)

Worker role mapping: Hegel = `worker-2`; the creation tool does not support assigning a display name. This continuation follows the user-authorized fallback after the previous Worker Dewey hit its usage limit. No subagents were created. Orchestrator owns main integration and deployment; the next Critic owns mobile browser QA.

Critic reproduced P1 with actual mobile `tap()`: `.page` retains an identity transform after touchstart, establishing the containing block for its fixed descendants. The earlier `.app-status` fixed rule therefore did not keep the spinner in the viewport. See `critic-rereview-c5e1295.md`; its temporary JSON/screenshot/script paths remain in that report.

The current fix shares the existing body-level startup overlay and a single spinner node across startup and ordinary operations. Ordinary work keeps its accessible announcement in the inline `.app-status` and marks the decorative overlay `aria-hidden`; only startup checking makes the page inert. The overlay lasts for controller pending, including success/ready transitions and final reads, and clears after success or failure cleanup. The existing 12-spoke stepped animation and reduced-motion rules both target the shared overlay. The ineffective fixed status rule was removed. Controller behavior and operation inventory above remain unchanged.

The regression fixture places the app inside an idle identity-transformed `.page` under body, then checks body ownership, a single reused node, startup/operation transition, ready and timeout visibility, and cleanup/error retention. These are DOM/CSS regression checks; they do not replace actual mobile viewport measurements.

| Current stage | Command | Result and evidence |
| --- | --- | --- |
| Inherited body regression RED | `TZ=UTC node --test test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs` | Exit 1, 57/61 passed. Body ownership/node reuse/ready assertions failed on old code; one null lookup also exposed the test setup issue below. `body-overlay-red.log`. Prior OOM from comparing cyclic mock DOM objects was corrected to identity assertions before this recorded RED (handoff history). |
| First continuation focused run | Same focused command | Exit 1, 60/61 passed. Test queried a spinner before pending attached it to the overlay; corrected test lookup timing. `body-overlay-first-focused.log`. |
| Animation selector RED | Same focused command | Exit 1, 60/61 passed. New CSS assertion caught the remaining `.app-status .operation-spinner` animation selector. `body-overlay-css-red.log`. |
| Final focused GREEN | Same focused command | Exit 0, 61/61 passed, no skipped/cancelled tests. `body-overlay-green-focused.log`. |
| Latest full suite | `TZ=UTC npm test` with elevation for localhost HTTP tests | Exit 0, 413/413 passed, no skipped/cancelled tests. `body-overlay-npm-test-utc.log`. |
| Latest Pages build | `npm run build:pages` | Exit 0, version `53411a0d82cf`. `body-overlay-build-pages.log`. |
| Latest Pages check | `npm run check:pages` | Exit 0. `body-overlay-check-pages.log`. |
| Whitespace check | `git diff --cached --check` | Exit 0 before commit. Test reporter trailing spaces in saved logs were stripped; original logs remain under `/private/tmp/operation-spinners-body-overlay-*.log`. |

Older 413/413 and build `51e146ba6592` results above belong to the earlier implementation and are not evidence for this fix. The previous browser-results and screenshots also predate this fix. Worker did not run browser QA, live Notion or deployment. Next Critic should verify actual mobile tap save plus cancelled/short pull followed by scrolling to the bottom and saving, including the final follow-up read, reduced motion, and error cleanup, against build `53411a0d82cf`.
