# Optional-schema list compatibility

## Symptom and reproduced request mismatch

The user reported that bean and recipe catalogs could no longer load. Source inspection found that schema verification accepts missing optional properties but list queries still put every modeled property in `filter_properties`. A strict synthetic Notion fixture rejects a requested property that does not exist in its schema, reproducing HTTP 400 for ordinary catalog requests.

This establishes a request/schema mismatch and a synthetic failure, not the actual production Notion response. No credentials, production configuration, real Notion calls or database mutations were used.

## Change

`NotionClient.verify` records the names and IDs returned by each successfully verified data-source schema. `queryPage` restricts its requested property projection to that verified set. Re-verification replaces the set, so adding an optional property restores it to subsequent requests. Queries before schema verification keep their existing behavior.

The change sits at the network boundary and covers all optional fields: bean favorite; recipe favorite, extraction guide and legacy bean relation; record bean relation. It adds no schema or per-item requests. Search filters, sorts, page size, cursor values and repository cursor fingerprints keep their existing logical query shape. First and continuation requests use the same supported projection. Controller cache identities and invalidation are unchanged; the fix does not introduce a new cache.

The synthetic fixture now captures `filter_properties`, rejects unknown projection fields and optionally returns only requested schema properties. The regression integration test enables this strict projection mode and checks both catalogs, both brew-selection routes and both option-search paths with absent optional fields.

## Red-first evidence

`node --test --test-name-pattern='omits absent optional|legacy schemas without optional' test/pwa-notion-client.test.mjs test/pwa-ui.integration.test.mjs`

- Before implementation: exit 1, 0/2 pass. Both tests fail with synthetic HTTP 400 (`red.log`).
- First implementation check: exit 0, 2/2 pass (`green.log`).
- The final focused and full checks also include the stricter projected-response fixture.

## Final verification

| Check | Exit | Result | Evidence |
| --- | --- | --- | --- |
| `node --test test/pwa-notion-client.test.mjs test/pwa-read-repository.test.mjs test/pwa-ui.integration.test.mjs` | 0 | 148/148 passed | `focused.log` |
| `npm test` | 0 | 689/689 passed; 0 failed | `npm-test.log` |
| `npm run build:pages` | 0 | Build `01020123e8b7` | `build-pages.log` |
| `npm run check:pages` | 0 | Pages artifact validation passed | `check-pages.log` |
| `git diff --check` | 0 | No whitespace errors | final worktree check |

The full suite used approved local HTTP listen permission. Raw logs are stored beside this README; `.log` files are ignored by the repository and need explicit inclusion if committed.

## Limits and handoff

Real Notion response behavior, actual schema availability, browser mobile layout and production account behavior remain unverified. Critic review, commit, integration and deployment are handled by the Orchestrator. No production Notion changes were made.
