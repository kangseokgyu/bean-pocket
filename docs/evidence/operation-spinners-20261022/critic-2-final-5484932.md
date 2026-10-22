# Erdos / critic-2 — final independent review

Verdict: **APPROVE**. No required findings remain in reviewed commit `54849321d244516533fe3289839513f0df0f8643`; previous P1 and P2 are resolved. Browser-tested build: **53411a0d82cf**. This is a code-review verdict; Orchestrator owns integration and deployment.

## Scope and role

- Erdos = critic-2, newly separated from the previous Critic. User confirmed creation-tool configuration `gpt-6.1-sol`, reasoning `medium`; this runtime does not independently expose those settings.
- Applied `.agents/skills/code-review-and-quality/SKILL.md`. Read inventory-and-verification.md, critic-initial.md and critic-rereview-c5e1295.md; reviewed `c5e1295..5484932` implementation/test delta and relevant original controller entrypoints and view event bindings independently.
- No subagents, implementation edits, commits, merges, installs, real Notion connections, full-suite reruns or build reruns. Mutation experiment used only a `/private/tmp` source copy, subsequently restored from the unchanged worktree file.

## Closed findings and five-axis assessment

- **P1 closed:** `pwa/ui/view.mjs:76–92,121–129` owns one shared spinner inside the body overlay, outside `.page`. `pwa/styles.css:55–64` fixes that overlay to the viewport. Actual touch taps still produce `.page` identity transform; the indicator now remains centered independently of it. Both short-pull release and actual CDP `touchCancel` were exercised before scrolling to the bottom and saving with locator `tap()`.
- **P2 closed:** `test/pwa-ui.view.test.mjs:367–413` checks visible spinner, busy state, success/ready, status timeout, completion and error. An independent inversion of `currentState.pending && !startupChecking` to `currentState.pending && startupChecking` failed the targeted test at its pending visibility assertion as expected (exit 1, 0/1 passed). Evidence: `critic-2-mutation.log`; original source remained untouched.
- **Correctness/inventory:** verified initialize/retry, connect/reconnect, refresh, confirmCurrent recovery, resolveOperation, submit for beans/bags/recipes/steps/records/copy/delete. Their pending owners await nested reads/journal work and final `readLatest`, with `finally` cleanup. No omitted async user CRUD/read/connection/recovery entrypoint found. Local form editing/navigation and recipe-copy form preparation are synchronous; saving the copy enters submit. Existing pull-to-refresh retains its separate reload indicator.
- **Readability/architecture:** one canonical `makeSpinner` and shared overlay reuse avoid competing startup/operation nodes. DOM/CSS delta is localized; existing controller recovery extraction preserves pending across initialization. No additional dependency or unrelated refactor.
- **Security:** diff introduces no endpoint, credential handling, HTML interpolation or auth/storage bypass. Status messages remain textContent. Local QA blocked all non-localhost browser requests; none were attempted.
- **Performance:** no new network operations or unbounded work; one spinner node reused, status timer cleared/deferred while pending. The animation selector and reduced-motion selector both target the body overlay.

## Executed mobile browser QA

Runtime: installed Playwright and Chromium headless shell, isolated contexts, viewport **390×844**, `hasTouch:true`, `isMobile:true`, `serviceWorkers:'block'`; all form submissions used actual `locator.tap()`. No mouse clicks or DOM-dispatched substitute save events.

Server: fresh `/private/tmp/operation-spinners-critic2-server.mjs`, localhost port 4217, fresh synthetic in-memory fixture, 250ms mock request delay. It copies the immutable `/private/tmp/operation-spinners-53411a0d82cf-dist` snapshot. UI displayed the expected build; snapshot `ui/view.mjs`, `ui/controller.mjs` and styles.css matched current source byte-for-byte. Browser routing additionally refused external hosts.

Commands and exits:

1. `node /private/tmp/operation-spinners-critic2-browser.cjs` — **exit 0**. Ordinary and reduced-motion mobile contexts; connection tap, saved form tap, first follow-up-query gate, failure injection. Each normal context performed a short 50px pull/release and another 50px pull/touchCancel (below 240px refresh threshold), then scrolled down and tapped Save. Both reset to idle with hidden pull indicator and no reload.
2. `node /private/tmp/operation-spinners-critic2-last-query.cjs` — **exit 0**. Supplemental stricter gate holds the final `records/query` endpoint after the successful create, rather than the first follow-up query. Both motion modes again tested, including short release/cancel in ordinary mode. This supplement uses the same synthetic server, which retains prior fake rows; browser storage/context remains fresh.
3. `TZ=UTC node --test --test-name-pattern='operation spinner stays visible through success' /private/tmp/operation-spinners-critic2-mutation/test/pwa-ui.view.test.mjs` — **exit 1, expected mutant failure**.

Final-query observations:

| Check | Ordinary motion | Reduced motion |
| --- | --- | --- |
| Bottom-form tap: pending scrollY | 517 | 586 |
| Page transform while saving | matrix(1, 0, 0, 1, 0, 0) | same |
| Indicator center, all 18 gated samples, ≥3.6s | (195, 422) | (195, 422) |
| Visible indicator count / spokes | 1 / 12 | 1 / 12 |
| Animation | pull-refresh-spin, steps(12) | none |
| Pending status | saved, busy=true until query release | same |
| After final response | ready, busy=false, overlay hidden, 0 visible spinners | same |
| Injected create HTTP 429 | pending spinner then cleanup; input retained; Save enabled | same |
| pageerror / external requests | [] / [] | [] / [] |

ARIA checks at connection, saving, gated saved state and rejected-save pending: decorative spinner `aria-hidden=true`, ordinary overlay `aria-hidden=true`, inline `role=status`, `aria-live=polite`, `aria-busy=true`. On success/failure busy becomes false and overlay content/attributes are cleaned. Ordinary operations do not make `.page` inert. Startup body ownership, shared-node transition and startup inert semantics were independently reviewed in source and existing DOM tests; startup/recovery were not separately driven through a full browser fault-injection matrix.

Visual inspection of ordinary/reduced final-read screenshots confirms the existing fading 12-spoke gray spinner at viewport center under the translucent shared overlay. Error screenshot confirms the original bean name remains present after rejection and the overlay is gone. The UI remains consistent with the existing startup loading design; no additional UI blocker found.

## Existing required verification, reviewed rather than repeated

Read latest body-overlay-green-focused.log: **61/61**, fail/cancel/skip 0; body-overlay-npm-test-utc.log: **413/413**, fail/cancel/skip 0. Build log reports **53411a0d82cf**, check log reports success. Their recorded exit codes are 0 in the inventory. Earlier build 51e146ba6592 and its browser screenshots were not used as evidence for the fix.

## Evidence and limits

Durable evidence in this directory: `critic-2-browser-results.json` (first-query gate), `critic-2-last-query-results.json` (final-query gate), both browser logs/scripts, isolated server script, mutation log, and four final-query/rejection PNGs. The final-query JSON records every sample, transforms, positions, ARIA and cleanup. Reviewed implementation locations above are references, not new findings.

No real device/Safari, screen-reader session, live Notion, deployment/public artifact check, exhaustive browser CRUD/recovery/fault matrix or repeat full tests/build. Chromium touch emulation exercised genuine browser touch input; it is not a physical mobile-device test. Evidence writing changes only documentation; no implementation source changed. Local QA server was stopped after verification to release port 4217.
