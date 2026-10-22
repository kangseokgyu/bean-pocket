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

The shared `.app-status` now contains the existing `makeSpinner` 12-spoke element. It is decorative (`aria-hidden="true"`); the status remains `role="status"`/polite live content and exposes `aria-busy` for the full pending interval. The existing 0.8s stepped animation is disabled by the reduced-motion media query. Success/`ready` status updates and status auto-hide cannot end the spinner while controller pending remains true; the success-message timer resumes only after pending ends. Controller `finally` blocks cover error, validation rejection, failed/uncertain writes, and failed follow-up reads, while existing duplicate-submit and lifecycle guards remain in force.

## Verification

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
