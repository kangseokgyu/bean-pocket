# Tab loading skeleton — worker-2 fix handoff (2026-10-27)

Scope of this continuation: `pwa/ui/view.mjs`, `test/pwa-ui.view.test.mjs`, this README and verification evidence. Existing controller/screen-loading tests/plan changes were preserved. No agents, commits, merges, pushes or deployment were performed. Main checkout was not edited.

## Fixes

- P1: first route response renders fresh list siblings into a detached container, then updates the existing pane around its live dialog. The dialog/input/form never detach; input focus and draft survive. Same-route background updates continue preserving the form. The detached disposable form does not restore drafts.
- P2: remember only visible children hidden by a loading transition and restore those on completion. Repeated loading does not overwrite the original state; intentionally hidden siblings stay hidden.
- Regression tests: real controller + view, delayed `/recipes/new` first response, modal/form identity, focused input and draft, fresh recipe list before/after modal close; repeated loading/ready with pre-existing hidden sibling and subsequent modal close.

## Actual verification

| Command | Exit | Result / evidence |
| --- | --- | --- |
| `node --test --test-name-pattern='first route data keeps\|route loading-ready restores' test/pwa-ui.view.test.mjs` (before fix) | 1 | 2 behavioral assertion failures, 0 cancelled; `critic-fix-behavior-red.tap`. Dialog identity false; visible siblings remain hidden. |
| `node --test test/pwa-screen-loading.test.mjs test/pwa-ui.view.test.mjs` (first implementation attempt) | 1 | 69 pass, 1 fail, 25 cancelled; `critic-fix-green.tap`. Disposable form attempted draft restoration outside `.data-panel`; corrected by omitting drafts for disposable render. This also caused pending controller test completion. |
| Same affected-test command after correction | 0 | 95/95 pass, 0 fail/cancelled/skipped; `critic-fix-green-final.tap`. |
| `npm run build:pages` | 0 | Build `a75b0bb2ba16`; `critic-fix-build.log`. |
| `npm run check:pages` | 0 | Pages output check passed; `critic-fix-check.log`. |
| `node docs/evidence/tab-loading-skeleton-20261027/worker-fix-browser/browser.cjs` | 0 | With elevated local execution: 390 and 1280 each 10 checks passed / 0 failed / 0 page errors; `worker-fix-browser/browser-escalated.log`, `browser-results.json`, screenshots. |

Browser harness and server are unmodified copies of existing Critic files; original Critic evidence is preserved. First restricted execution exited 2 because Chrome aborted with EPERM (and loopback server was restricted); original output retained as `worker-fix-browser/browser.log`. Elevated rerun succeeded. Existing `critic-fix-red.tap` is the previous worker's generic ~71-second failure, not accepted as behavioral RED evidence. Large cyclic DOM assertion diagnostics were suspected; boolean identity assertions yielded immediate, specific failures.

## Critic next steps / limits

Final full-suite and independent recheck belong to the existing Critic. The earlier independent 542-test/build/check results in `critic/review.md` predate these fixes and are not claimed as post-fix full validation. Critic review file remains the original FAIL report pending independent review. No deployment/public verification, live Notion, service-worker lifecycle handshake, or records-new browser modal scenario was run in this continuation.

## Final independent approval

The final review is **PASS**: [recheck report](critic/recheck/review.md). Full `npm test` passed **544/544, exit 0**; build/check passed with **exit 0**, version **a75b0bb2ba16**. Independent browser verification at 390/1280 passed **12/12 per width**, exit 0, including frame observations with no wrong-route cards/false empty states, dialog DOM/focus/draft preservation, and sibling visibility restoration. Original FAIL evidence remains under `critic/`.

Agent settings: original Worker Faraday (`gpt-6-luna`, `max`) was interrupted by a usage-limit error. Project-authorized replacement Worker Mill used `gpt-6.1-sol`, `medium`; independent Critic Maxwell used `gpt-6.1-sol`, `medium`. Role names are working labels; the tool does not support assigning display names. No further subagents were created by workers or critic.

The parent's earlier inference that initial build/check logs were absent was incorrect: `.gitignore` excludes `*.log` from default file search. Logs exist and are explicitly included as task evidence. No initial build/check success claim is rejected merely for that search omission.

Integration and publication results follow after main validation. Live Notion and iPhone hardware remain unverified; local browser evidence uses synthetic data and an isolated profile.

Captured logs have trailing horizontal whitespace removed for `git diff --check`; result lines and test outcomes are unchanged.

## Main integration and public release

- Feature commit `a63b2c48ac3fa3c85e61dd7f41dca474d174362d` fast-forwarded main from `d2ad677`. Only this task's selected files were committed. Original main checkout was clean at integration.
- Integrated main: `npm test` **544/544, exit 0** (`main-test.log`); `npm run build:pages` **exit 0**, version **a75b0bb2ba16** (`main-build.log`); `npm run check:pages` **exit 0** (`main-check.log`). Local loopback permission was used for HTTP fixtures.
- Main pushed; `pages.yml --ref main -f probes=false` [run 40430739217](https://github.com/kangseokgyu/bean-pocket/actions/runs/40430739217) completed successfully, including build and deploy jobs. Raw run result: `deployment.json`; watch exit 0: `deployment-watch.log`.
- Public URL: https://kangseokgyu.github.io/bean-pocket/ . **20/20** output files returned HTTP 200 and matched the local dist bytes (`public-files.json`, verifier exit 0).
- Fresh isolated Chrome at 390px displayed **a75b0bb2ba16**, contained the skeleton element, cleared skeleton/startup loading after connection checking, had no horizontal overflow and no page errors (`public-browser.json`, `public-390.png`, smoke exit 0).
- Public smoke uses no saved Notion connection. Real Notion data, physical iPhone/Safari and the full installed-service-worker update lifecycle were not verified. Tab loading behavior was verified locally with synthetic data at 390/1280; publication verification establishes matching assets and clean initial screen.
- Reproduce public checks: `node docs/evidence/tab-loading-skeleton-20261027/verify-public.mjs "$PWD" "$PWD/docs/evidence/tab-loading-skeleton-20261027/public-files.json"`; browser smoke: `node docs/evidence/tab-loading-skeleton-20261027/public-smoke.cjs a75b0bb2ba16 "$PWD/docs/evidence/tab-loading-skeleton-20261027"`.
- Rollback: revert the feature commit in a dedicated branch, run the same mandatory checks/review, integrate and dispatch the general Pages workflow again. No data migrations or Notion writes are involved in this change.
