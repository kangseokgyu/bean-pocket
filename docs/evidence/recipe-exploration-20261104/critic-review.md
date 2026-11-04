# Independent Critic review

2026-11-04. Critic: `gpt-6.1-sol` / `medium`, reused role. Product code and tests were not modified. No subagents were created. Reviewed `git diff origin/main` against `ec4472c`, source contracts, migration implementation and tests, verification/decision evidence, final test/browser logs, and the 390px preparation screenshot.

**Decision: changes required before migration/deployment.** Two behavior defects were reproduced by executing the actual exported modules in small Node probes.

## C1 — Valid v3 snapshots without a template become damaged in the Node reader

Severity: P1. `lib/notion.mjs:51` rejects every non-string `recipeId`, including `null`, before calling the versioned snapshot validator. The server actual-condition route and `createActualSnapshot` explicitly accept `sourceRecipeId = null`. Thus a successful record write can become `snapshotStatus: damaged` with `snapshot: null` on the next server read. This is different from the covered deleted-template case, which retains a non-null historical source ID.

Probe: construct a valid actual recipe (15g, 93C, 250g, one 0:00/250g stage), call `createActualSnapshot(bean, recipe, null, null)`, encode the bean/record with production `encodeProperties`, supply them through a synthetic `queryAll` client, and call production `NotionRepository.all()`.

Observed output:

```json
{"storedVersion":3,"source":{"recipeId":null,"recordId":null},"readStatus":"damaged","readSnapshot":null}
```

Required fix: make the legacy Node reader accept the valid v3 nullable-source contract while retaining v1/v2 ID checks and rejecting mismatched relations. Add HTTP/repository regression coverage for omitted/null source IDs and confirm saved conditions survive the subsequent GET.

## C2 — Requested comparison pair does not select/preserve its bean

Severity: P2. `pwa/ui/controller.mjs:224` fetches requested pair records, but `withRecordInsights` at line 186 still uses the previous bean selection. `pwa/ui/records-insights.mjs:132` then truncates bean options to the newest three before resolving selection. A directly requested pair for an older fourth bean is therefore absent from both comparison selectors, despite successful direct record fetches. Even a pair for a visible bean can show another bean until manually switched if a previous selection remains.

Probe: call production `buildRecordsInsights` with current valid snapshots for beans A/B/C dated November 4/3/2, plus two records for target bean dated October 1/2, requesting selected bean `target`.

Observed output:

```json
{"requestedBean":"target","availableBeans":["a","b","c"],"selectedBean":"a","comparisonRecords":["new-a"]}
```

Required fix: when the explicit route pair has been fetched and validated as two current records of the same bean, select that bean and preserve it among comparison options even when outside the recent-three overview. Keep the existing overview limit if desired. Add regression coverage with four beans and a previously selected different bean; assert the actual pair is rendered, not merely present in the raw record list.

## Other reviewed areas

- Full actual-condition snapshot creation, recipe step normalization, provenance, decimal ratings, current-generation filtering, PWA nullable relations, deleted-source replay, shared-template copying, and separation of create/best/template operations.
- Best relation PATCH contains only its own property; favorites PATCH and journal intents remain separate. Before/after intent is persisted before dispatch and uncertain best updates require fresh relation readback.
- Migration defaults to dry-run, requires explicit apply, rejects conflicting type/target/direction, sends only the additive property, checks deep preservation and target after write, and reconciles uncertain responses by readback without a second PATCH. No additional blocker found in this script; live API application was not performed by Critic.
- Comments in the changed paths did not reveal an additional actionable defect. Unsupported Comment Sicko/deslop/control-ui integrations were not invoked.
- The final logs support 714/714 full tests, 16/16 HTTP tests, and two successful production-build Chrome scenarios with zero reported JS/HTTP errors or horizontal overflow. These runs predate the two probes above and do not cover those cases. Critic did not redundantly rerun the full suite.
- Decisions TSV and verification documentation distinguish genuine test-first failures, fixture corrections, failed intermediate runs, and final runs. Model fallback is documented as `gpt-6-luna/max` request-limit interruption followed by `/root/worker_2` at `gpt-6.1-sol/medium`; tool creation history is an Orchestrator attestation, not independently recoverable from repository logs.

Live Notion record writes, real schema migration, iPhone Safari/home-screen PWA, and real-storage recovery were not exercised by this review. Re-review is required after Worker fixes C1/C2.
