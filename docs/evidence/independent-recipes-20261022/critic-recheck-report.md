# Critic re-review

Target: 71f50c424e431265fe286126ae0cbeb7d82b5e67. Reviewed diff ad966b0..71f50c4 only for the prior three required findings and direct regressions. Verdict: approve merge; all three required findings resolved. One nonblocking P3 demo regression is recorded below.

## Required findings resolved

1. Invalid snapshot is sanitized to null with snapshotStatus=damaged; renderer consumes only validated snapshots and checks steps array. Re-ran isolated Chromium against built a9da5c5ed323 with recipe.steps={broken:true}. PWA recipe detail and records render warnings, retain record/rating/note, and continue navigation without pageerrors. Server/public records and recipe detail also render warnings without errors. Evidence: browser-results.json, pwa-malformed-detail.png, public-malformed-detail.png. Repository/UI tests cover malformed v1 and v2; browser reproduction specifically uses v2.
2. Legacy recipe bean candidates and completeness flags are preserved. Re-ran prior multi-candidate and truncated record relation reproductions, plus truncated legacy recipe relation. Every case returns needs-confirmation, deletion failed and zero PATCH. PWA/server results agree for multi/truncated legacy recipe evidence. Evidence: repro-legacy.json, repro-delete.json, repro-truncated-legacy.json, corresponding .mjs harnesses.
3. Rating6 is retained with invalidFields=[rating] and excluded from stats (count0, average null) in both PWA and server. Chromium confirms field-specific warning in PWA records/detail and server/public records/detail, without normal stars for rating6. Evidence: repro-rating.json and browser-results.json. Tests additionally cover invalid dates and valid rating aggregation.

## Direct regression (nonblocking P3)

public/app.js:104 now requires snapshotStatus=valid to display a snapshot, but the demo save path at public/app.js:254 creates a valid v2 snapshot without that status. Reproduce with disconnected /api/status stub, enter public UI demo, save a record with sample bean/recipe and rating5, expand 당시 레시피 확인. It displays 당시 조건이 저장되지 않은 기록입니다 despite the in-memory snapshot. Real repository reads obtain snapshotStatus and are unaffected. Suggested localized fix: set the same validated status for newly generated demo snapshots, or run them through the shared snapshot validation/status path. Evidence: demo-results.json, demo.cjs. No product files changed.

## Worker evidence checked directly

README.md update distinguishes historical browser artifacts from this rework. critic.red.test.txt contains 126 tests /116pass /10fail and failures for the three findings. critic.green.test.txt contains126/126, critic.npm-test.final.txt437/437, critic.build-pages.final.txt builda9da5c5ed323, critic.check-pages.final.txt success. Checked added regression test source and final implementation diff. Full suite, build and pages check were not rerun by Critic.

## Scope and cleanup

All runtime requests used synthetic in-memory fake Notion. Chromium used temporary isolated contexts, blocked service workers and non-local requests. No existing user browser profile, user-device OPFS, .env, production data, schema migration, source code, commit, merge or publication changes. Worktree remained clean at the target commit. Chromium contexts/browser closed and localhost server process (ports4229/4230) terminated. Live Notion/device/SW-update/published Pages behavior not retested; schema/backfill verification remains the already supplied operator evidence.

Harness-only recovery: after resumption a duplicate server start failed with EADDRINUSE and interrupted a temporary boot-file write. Restored only that /private/tmp harness file and reran successfully. This was not a product failure. Existing model/effort configuration was not changed; no agents created.
