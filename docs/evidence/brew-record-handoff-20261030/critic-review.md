# Independent Critic review — 2026-10-30

Decision: approve. No blocking correctness, security, or regression findings in the reviewed change.

Scope: pwa/ui/controller.mjs, pwa/ui/view.mjs, test/pwa-screen-loading.test.mjs, test/pwa-ui.view.test.mjs. Reviewed project AGENTS.md and original controller route/load/connection/save logic plus view route/dialog/picker/draft logic.

## Independent execution

Command: `node /private/tmp/brew-record-handoff-critic-harness.mjs`
Exit code: 0.
Evidence: `/private/tmp/brew-record-handoff-critic-harness.json`; stderr `/private/tmp/brew-record-handoff-critic-harness.err` is empty.
The harness reads the project TestDocument/TestElement implementation from the existing view tests and imports the actual changed controller and view. Repository/client callbacks are fake-only; no real Notion requests or writes occur.

Seven checks passed:
1. Real complete-brew click with all subsequent Notion reads indefinitely blocked: selected names and IDs are shown, a cup note typed immediately survives controller completion, and there are zero Notion calls.
2. Different selection ID rejects the previous run handoff and starts schema verification.
3. Direct new-record URL reads selected bean/recipe and option pages, with zero listRecords calls.
4. Removed connection during initialize clears old selection; later record route shows blank selectors.
5. New connection revision with identical selected IDs and indefinitely blocked detail reads does not prefill previous connection names/IDs.
6. Returning to the brew route and completing again reuses current selection with zero Notion calls.
7. Picker open plus focus event lazily loads bean options without losing selected bean/recipe or fetching record history.

## Source review conclusions

Handoff requires same active revision, exact IDs, source /brew/run data, no source error, and nonempty recipe steps. Install/drop invalidate dataRevision and abort the previous route; route generation and AbortSignal checks prevent late reads from publishing after transition. Direct entry keeps selected-item validation and unavailable-item handling. The new-record screen renders only its entry form; record history/inference remains on /records. Saving still calls client.verify(), prepareRecord rejects unsupported relation schema, and commands.execute retains the connection-bound write lock plus fresh repository.readAll before records writes. No commands/state code changed.

Worker evidence independently read: npm test log reports 641 passed, 0 failed; build-pages log reports bf6e2045f3fe; check-pages log reports success. The full suite was not redundantly rerun.

## Limits

This is a project DOM harness, not a real browser. Browser rendering/layout, native dialog/focus propagation, real Notion service behavior, and deployed public assets were not checked by Critic. The focusin event was explicitly dispatched by the harness because TestElement.focus only changes activeElement. No real Notion write or live save was attempted. Public deployment verification remains with Orchestrator.
