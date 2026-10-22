# Critic review — operation spinners

- Role/alias: critic = Ampere. No subagent created; implementation source, commit and merge untouched.
- Reviewed commit: 306a1cd4f24f5f0552a06f57a9295023e53bbd9b; base dec41556310831098972582bd668c487cb2eb98c.
- Verdict: REQUEST CHANGES.

## Required findings

### [P1] Keep the operation indicator visible when submitting a scrolled form
Location: pwa/ui/view.mjs:97–102; pwa/styles.css:51–53.
The new indicator lives only in the app-status paragraph inserted before connection/navigation/content. It has no viewport positioning. Saving from a long form consequently disables controls while displaying no visible progress indicator. This fails the requested visible spinner for existing asynchronous actions in a normal mobile interaction. Reuse a single viewport overlay or position a single operation indicator independently of scrolling, retaining startup exclusivity, reduced-motion, live status, and existing dirty/pending/freeze semantics.
Orchestrator-supplied browser evidence was read independently: /private/tmp/operation-spinners-browser/results.json. On the actual dist at 390x844, bean-save has scrollY=344, spinner top=-232.609375/bottom=-208.609375, inViewport=false; reduced-motion repeats the same. Connection/delete at scrollY=0 remain visible. Screenshot: /private/tmp/operation-spinners-browser/bean-save.png. Critic did not repeat browser execution.
Regression verification: submit at the bottom of bean/connection/long recipe forms with a gated remote request; assert indicator boundingRect intersects viewport until final follow-up read completes, then disappears; repeat reduced-motion and check at most one active indicator during startup/recovery transitions.

### [P2] Assert that the spinner itself is visible during pending work
Location: test/pwa-ui.view.test.mjs:303–313.
The added test asserts spinner existence, identity, spokes and accessibility, plus parent visibility, but never spinner.hidden === false while pending. A mutation changing renderStatus from statusSpinner.hidden = !active to statusSpinner.hidden = true passes all 60 focused tests. Thus a change that completely disables every ordinary operation spinner would ship green. Add visibility assertions at saving/saved/ready while pending. Include mock-clock advancement beyond 3000ms and verify the spinner and busy state survive, then clear on pending=false or failure. The surviving mutant must fail after those assertions.

## Independent verification

Original implementation was not changed. All experimental edits were made only inside /private/tmp/operation-spinners-critic-3vawecqs; the copied source was restored afterward.
- Skill-required condition inversion: currentState.pending && !startupChecking -> currentState.pending && startupChecking. Command: TZ=UTC node --test test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs. Exit 1, 59/60 pass, new spinner test fails at line 313 as intended. Log: mutation-startup-condition.log.
- Additional visibility mutant: statusSpinner.hidden = !active -> statusSpinner.hidden = true. Same focused command. Exit 0, 60/60 pass. Log: mutation-spinner-hidden.log. This is a verified missing assertion, not evidence of an implementation defect in the current hidden flag.
- Worker verification logs reviewed without rerunning full tests/build: UTC npm test 412/412, build/check exit 0, version 8c6c01ff3dc3. Initial sandbox listen-EPERM failures are documented separately; RED records the intended pre-implementation failures.

## Five-axis review and coverage

1. Correctness/functionality: Required viewport issue above. Inventory checked against pwa/app.mjs, all view event handlers, public controller actions and recovery callbacks. No omitted asynchronous CRUD/read user entrypoint found. Synchronous form opening/editing/navigation does not require a spinner. Service-worker discovery/update is lifecycle background work, not another CRUD UI action. Pull-to-refresh retains its own reload spinner. The controller pending interval correctly spans prepare/execute, unresolved-journal reread and final read, including confirmCurrent -> runInitialization; finally ends pending. No new pending/reentrancy/freeze/dirty defect found.
2. Readability/design: Small extraction of runInitialization removes the pending handoff gap; one shared status renderer fits existing conventions. No new dependencies or unrelated refactor. Original file sizes predate this change. Viewport placement needs correction as above.
3. Architecture: Reuses canonical makeSpinner and stepped animation; startup type suppresses the inline operation spinner, preventing a persistent startup double-spinner. Preserve this property when moving to an overlay.
4. Security: No new network endpoints, dependency changes, token exposure, HTML interpolation, or auth/journal bypass found. Status text remains textContent. Review is scoped to this diff and reachable paths; no external service/security penetration testing performed.
5. Performance/test evidence: No new network reads, unbounded loops, or accumulating timers found. scheduleStatusHide clears previous timeout, defers success expiry while pending, and restarts it when pending ends. Reduced-motion styling is present and corroborated by Orchestrator browser evidence. Visibility coverage gap confirmed by mutation.

Additional useful focused coverage (not separate demonstrated production defects): gate unknown/partial journal reread and resolution final read to assert pending remains true and rejects duplicate/freeze attempts; inject confirmCurrent preflight and reinitialization errors to assert final pending=false and preserved drafts. New recovery test currently covers its successful final-read gate only. These cases can be added near the existing harness without repeating the full suite for review.

## Limits

No independent browser rerun, real Notion write, live deployment verification, assistive-technology session, exhaustive fault injection, or full test/build rerun. Browser measurements are explicitly attributed to Orchestrator. Model/reasoning settings cannot be inspected or changed by this Critic runtime; no claim of verified gpt-6.1-sol/high configuration is made.
