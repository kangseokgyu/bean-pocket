# critic: T16–T20 independent command review

Date: 2026-10-19. Result: PASS within the reviewed command/preflight scope. No actionable product defect found. No additional agents created and no product files modified.

## Scope and evidence

Read PLAN.md T14–T20, SPEC.md, docs/pwa-contracts.md, commands/index.mjs, notion-client preflight diff, shared domain and property codecs, actual T14 submission-state and T15 read-repository, command/client tests, T16–T20 evidence. Baseline /tmp/bean-pocket-before-unrestricted.txt reports 245 passed; docs/evidence/T16/affected-green.txt reports 152 passed. These are historical evidence, not this review run.

Independently verified T14 lock/journal use, durable confirmed IDs before subsequent writes, latest T15 reads under lock, whole-recipe preflight before parent, reverse N→1 creation, parent-first archive, current-operation archive restriction, unknown stop/no retry, independent copy and source revalidation, record snapshots and intentional repeated records. The real T15 integration tests verify historical snapshot preservation, new conditions, average 3/count 2, and incomplete recipe exclusion.

## Execution

1. node --test test/pwa-commands.test.mjs test/pwa-notion-client.test.mjs test/pwa-submission-state.test.mjs test/pwa-read-repository.test.mjs test/pwa-domain.test.mjs
   - Node test runner failed: 147 passed / 1 failed, 148 total.
   - Log: /tmp/critic-t16-t20-affected.txt
   - Failure: pwa-domain.test.mjs top-level buildPages invokes check-pages.mjs:188, which rejects the concurrently changing Service Worker as arbitrary cache write/forced update. Domain assertions did not execute. This is an unfinished parent/lifecycle integration boundary, excluded from command verdict. The shell wrapper returned 0 because its final command was tail; the Node test runner itself failed (see TAP failure).
2. node --test /tmp/critic-t16-t20-extra.test.mjs
   - Exit 0; 24 passed, 0 failed/skipped.
   - Source: /tmp/critic-t16-t20-extra.test.mjs
   - Log: /tmp/critic-t16-t20-extra.txt
   - Uses existing synthetic fixture helpers, independently authored assertions, and actual T14 state implementation. Matrix: all four recipe create positions × not-sent/rejected/unknown (12); all three archive positions × rejected/unknown (6); failed latest read for bag/recipe/record/copy (4); oversized parent and record snapshot preflight (2). Unknown blocks a fresh key and causes no cleanup; failed parent archive stops child cleanup; rejected child archive permits known remaining cleanup; uncertain archive durably records unknown.

## Reviewed file SHA-256

- pwa/commands/index.mjs: df30f21ee4d204e32247cafe3f84c101663ee47647a803b248d0c43843c11475
- pwa/data/notion-client.mjs: 19483c2880878784b7d5561578c06b56585ddffb08a7988b946270efe3c2d622
- test/pwa-commands.test.mjs: 0cc212275f4871dba0b5b9d2cd9096760288fa82c32866c89437a9583e5e83a8
- test/pwa-notion-client.test.mjs: 8043eea52cc0d2bb5d577a7c73050c4e36d212d6ee19a31d7034ea460a2f5439

## Limits / next review

UI T21–T26, lifecycle T27, parent deployment allowlist/checker integration, full-suite integration and real browser/Notion/iPhone validation are not approved by this verdict. Review those once their owners finish. The five-file 152-pass historical result cannot be claimed as reproduced on this concurrent worktree; current domain-build startup is blocked as above. This review is an independent command-scope pass, not whole-project completion or merge approval.

## Evidence archival — 2026-10-19

Archived on user request after the independent review. The original report above and the reproduction source/logs were copied byte-for-byte; this archival section is the only addition to the report.

- [Additional reproduction source (original)](critic-extra-repro.mjs.txt)
- [Additional reproduction TAP: 24 passed, exit 0](critic-extra-green.txt)
- [Affected-run TAP: 147 passed / 1 failed](critic-affected-run.txt)

Privacy check: the archived source uses only fixed synthetic UUIDs from test/pwa-commands.test.mjs and the literal fake credential `synthetic-token`. No actual Notion token, actual data-source/page identifier, or private API response is included. Logs contain test names, assertions, timings and local source paths; no actual connection data appears.

The reproduction source is stored with a `.txt` suffix to preserve its original bytes without adding it to automatic Node test discovery. It retains the original local absolute import paths. To rerun on the original workspace, copy this file to `/tmp/critic-t16-t20-extra.test.mjs` and run `node --test /tmp/critic-t16-t20-extra.test.mjs`.

The user subsequently reported parent build integration passing 16 tests in `/tmp/bean-pocket-product-integration.txt`. This is a handoff update, not a new independent verification; the historical failure above remains recorded as observed. UI/lifecycle and integration review remain pending. No unfinished UI/lifecycle review or new test run was performed during archival.
