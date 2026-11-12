# Critic independent review — 2026-11-12

Verdict: REQUEST CHANGES. Two reproduced findings must be addressed before integration/deployment.

Reviewed `1d86987..d73fda93954923c37e3f61077e31f416fcf2b272` on `codex/project-improvements`, including source, tests, workflows and committed evidence. No product code changes, subagents, merge or deployment. Requested sol/medium could not be set through the available runtime; no claim that this model configuration was applied. `origin/main=a443f37` integration is explicitly outside this review; review its resulting diff separately. The earlier six-item proposal itself was not supplied, so full coverage against its original wording is unverified.

## P1 — Target changes retain the old live dialog and persist its draft under the new target

Locations: `pwa/ui/view.mjs:855–860` (`setDraftScope`); `pwa/ui/view.mjs:960–995` (live dialog retention).

`setDraftScope` changes the target scope and clears the draft map, but leaves the active entry dialog and its input DOM attached. The first `renderData` skips capture once, then returns through the existing open-dialog branch. The second render captures the old target's input into the new target's OPFS file. A user input event can also cause that capture without waiting for a second render.

Reproduction, using the real View/Controller and the existing TestDocument/controller fixture:

1. Connect target A, open the bean dialog, type `OLD CONNECTION DRAFT` and fire a bubbling input event.
2. Call `app.connect` with different `dataSources` (the fixture verifies it), then render data once more and flush the actual draft store.
3. The old dialog still displays `OLD CONNECTION DRAFT`; both target-scoped files now contain that value. A direct View-level reproduction using two distinct valid revision/fingerprint scopes produces the same result.

Observed output:

```text
target-switch visible: TARGET A PRIVATE DRAFT
target-B persisted: TARGET A PRIVATE DRAFT
controller target switch: OLD CONNECTION DRAFT
persisted files: [ 'OLD CONNECTION DRAFT', 'OLD CONNECTION DRAFT' ]
```

Risk: a draft belonging to another Notion target is displayed and can be submitted there, breaking the new isolation boundary. Merely skipping one capture does not establish isolation.

Worker correction: retire/reset the previous scope's active form DOM and entry state when dropping/changing targets, before any new-scope capture; preserve same-target behavior intentionally. Add a real controller/view regression covering an open dialog, distinct targets, subsequent input/render, and reloading B. Include hidden drafts and disconnect/reconnect boundaries.

## P2 — Restored drafts never restore controller dirty state

Location: `pwa/ui/controller.mjs:156–159`; `pwa/ui/view.mjs:854–879`.

`install` awaits draft restoration but does not synchronize restored draft keys with `dirtyKinds`. The new view method restores only its map/open flags. Controller dirty state is set by input events, and restoring values does not generate those events for beans/recipes (nor inform the controller about hidden drafts).

Reproduction: persist a bean draft, construct a fresh View/Controller with a fresh store over the same storage, bind and connect to the matching revision/fingerprint, then call `app.getState()` and `app.setFrozen(true)` without typing.

```text
restored input: RESTORED UNSAVED dirty: false freezeAccepted: true
```

Risk: the update coordinator treats unsaved restored input as clean and can freeze/navigate while it is still being edited; the documented unsaved-input update barrier is bypassed. Restored recipe edits likewise have no dirty key for the discard-confirmation gate in `ui/interactions/events.mjs:417`.

Worker correction: explicitly synchronize dirty keys for restored meaningful drafts, including forms hidden on another route, and reconcile keys on target changes/cancel/save. Add fresh-controller reload tests asserting dirty=true and freeze rejection before any new user input; test restored recipe edit cancellation as well.

## Independent checks and limits

- `/tmp/critic-project-improvements-repro.mjs`: exit 0; reproduced both findings through actual product modules. It reuses the pre-test TestDocument/data helpers and controllerFor from `test/pwa-ui.view.test.mjs`, with only imports rebased to absolute paths. The initial attempt failed solely because a fixture import still pointed into `/tmp`; corrected before the reported observations. No product files were modified.
- `node --test --test-name-pattern='fixed Notion|pull requests|Pages publishing|browser runner' test/pwa-product-build.test.mjs test/verification-workflow.test.mjs`: exit 0, 4/4 pass.
- `node --test --test-name-pattern='recovery cards|resolution controls' test/pwa-ui.view.test.mjs`: exit 0, 2/2 pass.
- Recovery source inspection confirms UUID-only fixed-origin Notion links, noopener/noreferrer/no-referrer, and a correctly labelled `updatedAt` last-change time. The allowlist exception is scoped to the literal origin in the recovery renderer; the executed negative test rejects another external URL.
- Verification workflow covers PR/main test/build/check/browser and has read-only contents permission; the existing Pages workflow remains manually dispatched. Remote Actions execution was not performed.
- Browser harness uses actual View/Controller and real OPFS for drafts, but memory connection/journal fixtures and fake Notion. Its 23 results include 18 route/width checks; regression mode has overflow assertions and captures screenshots/DOM but does not compare them against a visual baseline. Reload seeds fixture rows from sessionStorage rather than restoring a real journal. It does not establish SW update safety, real Notion behavior, target-switch isolation or restored dirty-state correctness. The evidence's explicit SW/iPhone/real-Notion exclusions are appropriate.
- Worker-reported 791/791, build/check and Chromium 23/23 were read as existing evidence, not rerun or represented as independent validation. No blanket security or deployment approval is implied by the focused passes.

After fixes and `origin/main` integration, Worker should run affected regressions and required project checks; Critic should review the resulting integrated diff. Do not merge/deploy this reviewed candidate as-is.
