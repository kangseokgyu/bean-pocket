# Critic re-review — 2026-11-12

Verdict: **REQUEST CHANGES — publication gate not passed.** The original P1 and P2 are fixed, but an additional P2 in the draft restoration boundary is reproduced in Chromium.

Reviewed HEAD `a3e6e141141235bf7ac0701b2df1b2675494e021`, the fix diff, and the integration against `a443f37`. `git merge-base --is-ancestor a443f37 HEAD` exits 0. `a5b2128` integrates that main revision. Product code was not modified; no subagent, merge, push or deployment was performed. The runtime does not expose a control to set the review model/effort to sol/medium, so that setting is not claimed.

## Original findings — resolved

- **P1 target isolation:** `setDraftScope` now captures A into A, retires the old form/dialog DOM before changing scope, and restores B independently. The old independent reproduction now shows a blank B form and no A draft stored under B. A further independent assertion run covers late input on the detached A form, repeated renders, subsequent B editing, disconnect and A reconnect: A retains `A only`, B retains `B only`, and reconnecting A restores its dirty barrier.
- **P2 restored dirty state:** `install`/`dropConnectionData` reconcile form draft keys returned by the view. The original reproduction now prints `dirty: true freezeAccepted: false`. Independent live-edit → persistence → fresh-store/controller tests also restore a hidden recipe edit key, block freeze, and open the discard confirmation before cancellation. Stable step IDs, the captured edit baseline, edited water values and the integrated derived recipe water total survive reload.
- Latest-main coupling: `pwa/ui/forms/recipe-form.mjs`, `pwa/ui/interactions/events.mjs` and `pwa/styles.css` match `a443f37` (diff exits 0). The recipe editor correctly has no totalWater input; the independent restored step test derives `총 물 양 275g`. Untouched recipe/brew forms do not create meaningful persisted drafts in the focused fixture run.

## New P2 — Persisted brew drafts are never applied to the brew form

Locations: `pwa/ui/view.mjs:1217–1222` (brew early return), `:1468–1469` (new persisted brew baseline), `:1530–1542` (unreachable brew restoration branch).

The new store persists `brews` values/steps and the controller restores their dirty key, but `renderPane` returns immediately after `renderBrewFlow`. It never reaches the shared `restoreDraft` call at line 1340. The newly supported brew baseline/step restoration cannot run on `/brew/run`.

**Actual Chromium reproduction**, using the canonical browser harness, real View/Controller and real OPFS with fake Notion:

1. Open `/brew/run` for the seeded bean/recipe.
2. Change the condition name to `CRITIC BREW DRAFT` and first-stage water from 50 to 75.
3. Wait until the draft is present in the real OPFS file, then reload and reopen the same brew URL.
4. The UI shows the source recipe's name and 50g instead of the persisted input; controller dirty remains true and freeze is refused.

Observed output, command exit 0 (the probe prints actual values):

```text
before reload {"name":"CRITIC BREW DRAFT","water":"75","dirty":true}
after reload {"name":"매일 아침 V60","water":"50","dirty":true,"freezeAccepted":false}
```

Independent assertion-based reproduction also fails on restored second-stage water: actual `200`, expected `'225'`. The OPFS file contains the edited 225g value. This is a UI restoration omission, not a failed storage write.

**Risk:** users resume a different set of brewing conditions from the one they entered. A later submit can save the reset source conditions; a rerender/input can overwrite the still-persisted draft. The update barrier also represents an invisible draft rather than the visible form.

**Required correction:** apply a brew draft before returning from the brew render branch, preserving its route/source association, original-condition baseline, stage rules and updated comparison/total. Add a regression that actually types into the integrated form, reloads with a fresh controller/store, and checks restored fields/stages, dirty/freeze behavior, then explicit cancel/save cleanup. Recheck source/route isolation when wiring this call. This addresses the existing new draft feature; it does not request a separate UX feature.

The early return predates this change. The issue is reported here because the current implementation newly persists/reconciles `brews` and adds brew baseline handling while leaving restoration unreachable. It is a missing part of the new draft contract, not a claim that this patch originally introduced the early return.

## Independent execution and evidence limits

- Original probe: `node /tmp/critic-project-improvements-repro.mjs`, exit 0. P1/P2 observations changed to the expected safe results against this HEAD.
- Extended assertion probe: `/tmp/critic-project-improvements-rerepro.mjs`. Three scenario groups pass (target boundaries; hidden recipe edit + integrated steps; untouched defaults); the fourth fails on brew draft restoration as described above. Initial fixture-only numeric `.value` behavior was corrected in the probe to emulate the browser's string values before relying on its persistence checks. No product change was made.
- Browser probe: `node /tmp/critic-project-improvements-brew-browser.mjs`, exit 0, outputs quoted above. Uses `scripts/browser/server.mjs`, repository Playwright and installed system Google Chrome; external network requests are blocked. The first attempt was blocked by sandbox `listen EPERM`; the same probe succeeded with the approved execution permission. It runs fake Notion, not an account or production API.
- Read committed final logs directly: Node tests 801/801, build `c6f67c2ee464`, Pages check passed, browser regression 23 cases passed. These remain Worker-run evidence; the full commands were not redundantly rerun. Their browser suite does not exercise brew draft reload, explaining why it does not detect this omission.
- This re-review did not modify product files or the original workspace CSS. Existing `critic-review.md` is preserved. Real Notion, iPhone, remote Actions, deployed Pages and full service-worker lifecycle remain outside this review.

## Worker correction — 2026-11-12

Status: **fixed and validated; awaiting Critic re-review**.

- The regression was added first and failed before the render fix: expected `CRITIC BREW DRAFT`, actual `V60`. The original failure is preserved in [`failures/critic-brew-restore-red.txt`](failures/critic-brew-restore-red.txt); the focused post-fix run passes 1/1 in [`critic-brew-node-final.txt`](critic-brew-node-final.txt).
- `renderPane` now applies a brew draft before the `/brew/run` early return. It checks the saved route and source bean/recipe/record IDs before restoring, then uses the existing shared restoration path for fields, stages, baseline and derived total.
- The Chromium scenario edits the real OPFS-backed form, waits for the test store's queued writes to finish, verifies the stored name and 75g, then reloads into a fresh page/controller. It verifies the name, 75g, 275g derived total, dirty state, rejected freeze, and that explicit cancel removes the draft. The earlier unsynchronized browser attempt and its old-file observation are preserved in [`failures/critic-brew-browser-before-flush.txt`](failures/critic-brew-browser-before-flush.txt). The harness now flushes pending test writes before reload; no storage implementation change was needed.
- Final validation: `npm test` 802/802; `npm run build:pages` artifact `5627dbe9659f`; `npm run check:pages` passed; Chromium regression 24 cases passed. Raw outputs are [`critic-final-npm-test.txt`](critic-final-npm-test.txt), [`critic-final-build-pages.txt`](critic-final-build-pages.txt), [`critic-final-check-pages.txt`](critic-final-check-pages.txt), [`critic-final-browser-test.txt`](critic-final-browser-test.txt), and [`critic-final-browser-results.json`](critic-final-browser-results.json).

The fix does not alter the user workspace CSS. This worktree is ready for the main agent's Critic re-review; this worker has not pushed or published it.
