# Ampere / critic — follow-up review c5e1295

Scope: independent review of 306a1cd4f24f5f0552a06f57a9295023e53bbd9b -> c5e129573a3e705f1dfd99affd7f40089011c668 only, plus directly affected pull-to-refresh behavior. No implementation edits, commits, merges, subagents, full-suite reruns or build reruns. Same Critic runtime/context retained; model/reasoning configuration cannot be independently inspected here.

Verdict: REQUEST CHANGES — previous P2 is resolved; previous P1 remains reproducible on actual touch interaction.

## [P1] A transformed page ancestor defeats the viewport-fixed spinner after a touch

Primary changed location: pwa/styles.css:171–179 (especially position: fixed at line 172).
Related existing code: pwa/ui/view.mjs:366–374 and 383–385; pwa/styles.css:79–81; status is still appended inside .page at pwa/ui/view.mjs:103.

Every touchstart first calls reset(), which leaves .page with data-pull-state="idle" and --pull-offset:0px, even when not at the top and no refresh gesture is available. The unconditional [data-pull-state] CSS computes transform to an identity matrix rather than none. A transformed ancestor establishes the containing block for fixed descendants, so the new pending status stays fixed to the scrolling .page instead of the viewport. Ordinary mobile taps on the save button therefore reproduce the original invisible-spinner defect. This is not limited to having completed a pull-to-refresh.

Independent browser reproduction: reuse the supplied synthetic Notion localhost server and its actual built dist 51e146ba6592, launch a fresh isolated Chromium context with viewport 390x844, hasTouch:true, isMobile:true and blocked service workers; connect via button.tap(), open bean form via .tap(), fill a unique fake bean name, then submit via button.tap(). No external Notion calls. At pending save:
- scrollY: 517
- spinner top: -486.609375; bottom: -462.609375
- inViewport: false
- .page data-pull-state: idle
- .page computed transform: matrix(1, 0, 0, 1, 0, 0)
- status computed position: fixed; aria-busy: true; text: 저장 중입니다.
- pageerror: []

Evidence: /private/tmp/operation-spinners-critic-touch.json; screenshot /private/tmp/operation-spinners-critic-touch.png; reproducible script /private/tmp/operation-spinners-critic-touch.cjs. Runtime command node /private/tmp/operation-spinners-critic-touch.cjs exited 0, demonstrating the defect (the script records measurements rather than asserting success).

Suggested correction: put a single pending indicator outside the transformed .page, as startup/pull indicators already are, or guarantee idle page transform is none and pending transitions cannot retain a transformed ancestor. Preserve normal inline status after completion, one visible spinner, safe-area positioning, reduced-motion and existing controller guards. Add a real mobile touch regression using locator.tap(), not only locator.click(); also check a cancelled/short pull followed by scrolling down and saving. Assert spinner rect intersects the viewport throughout the final follow-up read.

## Previous P2 resolved

The revised test checks spinner.hidden === false in saving/saved/ready, clock advancement past 3500ms, pending cleanup, error-message retention and startup indicator exclusivity. Worker review-visibility-mutant.log records the exact hidden=true mutant failing at the new saving assertion. That closes the previously demonstrated surviving mutant. No additional test-coverage blocker beyond the touch/containing-block scenario above was found in this delta.

## Evidence and review limits

Read Worker review-red-focused.log/review-green-focused.log/review-visibility-mutant.log/review-npm-test-utc.log and build/check logs: expected RED 59/61, GREEN 61/61, exact mutant fails, full UTC suite 413/413, build/check exit 0 and build 51e146ba6592. No repeat full test/build. Read Orchestrator results.json: connection/save/delete/reduced-motion and 320/768/1440 variants pass mouse-click viewport checks; API429 case restores controls, preserves draft and hides spinner, errors empty. The harness source uses .click(), explaining why those checks do not exercise the persistent touch-created transform.

Five-axis delta review: functional defect above; design fix needs an ancestor-independent containing block. Test visibility assertions are now meaningful. No new security, performance, timer, aria, pending/reentrancy/freeze/dirty or controller regression found in the small follow-up delta. Controller code is unchanged by this commit. No live Notion, deployment or assistive-technology session tested. Original implementation remains untouched; review scripts/evidence only reside in /private/tmp.
