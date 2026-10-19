# T27 lifecycle implementation recheck

Superseded for restart recovery and final navigation behavior by [the 2026-10-20 follow-up](resume-20261020.md). This report preserves the earlier 29-test snapshot.

Date: 2026-10-19
Workspace HEAD: `153167f` (shared uncommitted integration tree)

## Scope and API

This worker's implementation scope is `pwa/platform/app-lifecycle.mjs`, `pwa/platform/update-coordinator.mjs`, `pwa/sw.js` (leaving the parent-owned `APP_FILES` list unchanged), and `test/pwa-lifecycle*.test.mjs`. The lifecycle module's existing `start()`, `stop()`, `isFrozen()`, and `notifyStateChange()` methods remain. No app/domain/user-facing API or payload changed. An optional `navigate` injection point was added for the safe document transition; the worker/page handshake now has internal `commit` and `navigate` phases in addition to prepare/recheck/abort. Existing callers can omit the option and use the default same-URL replacement.

## RED → implementation

The preserved RED is in [fixes-red.txt](fixes-red.txt) and the independent critic reproductions in [critic-review.md](critic-review.md). The RED exposed late prepare completion leaving input frozen, abort/stop racing an awaited freeze, dirty invalidation after the last recheck, and generation/source confusion releasing a newer session. The implementation now serializes freeze/thaw, tombstones cancelled generations, waits for in-flight freeze/lock work before thawing on termination, retains the write lock and freeze across commit, propagates invalidation to the worker over the prepare channel, and only navigates after the committed worker is the registration's active worker. The service worker includes every contacted client in abort handling and checks invalidation/membership before committing and calling `skipWaiting()`.

Regression coverage now includes late timeout/abort/stop, invalidation racing final recheck and commit ACK, unrelated/old generations, a newly active B while the open A page still has controller A, conditional A→B navigation, native-state adapter behavior, and source/scope validation. The existing lifecycle tests preserve their original intent: the simulated registration moves waiting→active only when `skipWaiting()` succeeds, so a failed attempt cannot receive a fabricated activate event.

## Final worker-owned test run

Command:

```text
node --test test/pwa-lifecycle-regression.test.mjs test/pwa-lifecycle.test.mjs
```

Exit code: **0**. Result: **29/29 passed** (16 regression tests + 13 existing lifecycle tests), duration **10.083 s**. This was the focused T27 run; it was not a full-suite, build-checker, or native-browser run. `git diff --check` also passed (exit 0) before this run. No T27 source or test file was edited after the 29-test run; this evidence note is the only worker-owned edit after it.

## Native browser evidence and remaining boundary

The worker did not start the browser server or operate CUA. Before the parent took ownership, port 4197 had no listener; there is no worker-owned browser session or permission error to report. The parent subsequently reported its native CUA run using server session `40464` on the T27 fixture: two A tabs were controlled; a draft in one tab deferred B while both remained on A and the other tab reported no held/pending Web Locks; clearing the draft led both open tabs to the real B title/heading with `dirty=false`, `frozen=false`, and `controlled=true`. The parent reports the screenshot evidence as `native-dirty-deferred.png` and `native-build-b.png`, with `browser-events.jsonl` preserved. Those browser observations are parent-reported and were not independently re-read by this worker.

The parent owns fixture/server/CUA cleanup and independent critic re-review. This worker made no browser attempt after that ownership transfer, did not run the full suite or the parent's F5 checker, and made no commit. Parent-reported F5 verification is 42 passing tests; it is separate from this worker's 29/29 lifecycle result. No native browser claim is based on the Node test doubles.
