# T27 최신 판정 — 2026-10-20 독립 재검토 PASS

[수정·회귀 보고](resume-20261020.md), [독립실행](resume-critic-recheck-executions.txt), [최종native 제품 증거](../T28/resume-20261020/README.md)를 따른다. N1, active retry, hash문서전환, commit후client종료의 추가P1을 수정했다. 42개전용·원래7개·N1원문·추가원문이 모두통과했다. 과거native동결의 정확원인은 미확정이며 native SW강제종료는 미실행이다.

아래는 이전 기록이다.

# T27 — PWA lifecycle and safe service worker apply

Latest source follow-up: [2026-10-20 N1 recovery/product-freeze report](resume-20261020.md). It records 29 original focused tests, 9 recovery tests, the original 7 independent reproductions and N1 recheck, plus the remaining parent native/critic verification boundary. The baseline narrative below predates commit/navigation and restart recovery; use the follow-up for current behavior.

`pwa/platform/app-lifecycle.mjs` exports `createAppLifecycle({ getState, setFrozen, submissionState, serviceWorker })`. The returned public API is `start()`, `stop()`, `isFrozen()`, and `notifyStateChange()`. `start()` wires the message coordinator before requesting a retry from a waiting worker. `stop()` removes listeners and awaits freeze/lock release.

`pwa/platform/update-coordinator.mjs` accepts worker messages only from `sw.js` at the registered scope URL. `prepare` freezes local editing first, then confirms clean memory state and inspects the journal under the native write lock before ACK. Empty connection+journal state is eligible when inspection reports unblocked. A single leader window acquires and holds the origin-wide Web Lock through final checks and `skipWaiting`; every scope window independently stays frozen and reports clean state. Membership is compared around the handshake. Dirty changes invalidate the generation. `activate` releases the held lock and all freezes; any failed phase sends `abort` to prepared windows.

The service worker filters window clients to the same origin and registration scope. Its protocol is `retry`, `prepare`, `lock`, `recheck`, `abort`, and `activate`. It runs one safe-apply attempt at a time, never claims clients or reloads them, and calls `skipWaiting()` only after every scoped client prepared, the leader lock is held, all clients rechecked clean, and membership stayed unchanged. `APP_FILES` remains parent-owned; the parent added both lifecycle modules and other integrated application modules to that list.

The initial RED is preserved in [initial-red.txt](initial-red.txt): Node could not import the not-yet-implemented lifecycle module. Focused coverage is in [lifecycle-test.txt](lifecycle-test.txt), including prepare/recheck races, one-lock multi-window behavior, `/bean-pocket/` scope, foreign-origin exclusion, dirty invalidation, activation release, and `start()` wiring the coordinator. The full suite result is in [npm-test.txt](npm-test.txt).

Validation: `node --test test/pwa-lifecycle.test.mjs` passed 13/13; final `npm test` passed 291/291. The first sandboxed full-suite run could not bind loopback for 13 HTTP tests (`EPERM`); rerunning with the required loopback permission passed. No live browser or real-device lifecycle run was performed; parent integration is preparing browser verification.
