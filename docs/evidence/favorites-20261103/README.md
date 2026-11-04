# Favorites implementation evidence

## Scope and storage boundary

Beans and recipes store independent `favorite: boolean` values in an optional Notion **즐겨찾기** checkbox property. The same Notion page and access permissions share those values across devices. This is the recommended shared-storage default. No production Notion database was inspected or changed.

Existing schemas without the checkbox retain reads, creation, copying and deletion; favorite writes and filters are disabled. Missing page values decode as false. New entities and recipe copies start false. Recipe snapshots omit this preference. Setup and behavior are documented in [database setup](../../notion-database-setup.md#즐겨찾기-속성) and [PWA usage](../../pwa-usage.md#원두레시피-즐겨찾기).

Device-local storage was considered but would require a new per-device persistence format and would not share values across devices. The implementation reuses Notion checkbox storage instead.

## Write and recovery safety

Favorite commands use the existing submission lock, validate the latest target and send an explicit desired boolean. The journal persists target kind, page ID, desired value, connection revision and data-source fingerprint before PATCH. Unknown writes remain blocked. Recovery reads the original page on the original connection and compares the actual checkbox value without replaying PATCH. If the checkbox schema disappears, the recovery remains blocked rather than accepting the default false value as proof of a saved change.

A single Worker continued existing changes in dependency order; there were no parallel implementation lanes or nested agents. Controller option caches include the favorite filter, and successful writes invalidate affected catalog and picker caches. Option responses are checked against the route generation and connection before application.

## Red and green evidence

All paths below are relative to this directory. Earlier intermediate failures are retained rather than hidden. Initial codec/snapshot work predated the preserved red logs, so this report does not claim red-first evidence for those initial changes.

| Unit | Red evidence (exit 1) | Passing evidence (exit 0) |
| --- | --- | --- |
| Search + favorite query, cursor isolation, unsupported schema | `repository-red.log`, `repository-followup-red.log`: missing filter/cursor/unsupported behavior | `repository-green.log`: 64/64; final full suite |
| Favorite command + unknown journal | `commands-red.log`: absent favorite command and journal target | `commands-green.log`: 67/67; final full suite |
| PATCH response must confirm desired checkbox | `client-followup-red.log`: unconfirmed value accepted | final full suite |
| Accessible list and picker UI | `ui-red.log`: missing bookmark/filter | `ui-final.log`: 189/189; final full suite |
| Catalog/brew query and adapter round trip | `integration-red.log`: missing filtered integration result | final full suite |
| HTTP permission/rate-limit guidance | `permission-red.log`: 401/403/429 lost safe result codes | `critic-fixes-focused.log`: 93/93; final full suite |
| Recovery after original schema removal | `recovery-schema-red.log`: missing expected rejection | final full suite: recovery stays unresolved |

Focused commands used the existing `node --test` files: `test/pwa-read-repository.test.mjs`, `test/pwa-notion-client.test.mjs`, `test/pwa-commands.test.mjs`, `test/pwa-submission-state.test.mjs`, `test/pwa-ui.view.test.mjs`, `test/pwa-ui.integration.test.mjs` and `test/domain.test.mjs`. The isolated schema-removal red command was `node --test --test-name-pattern='favorite recovery stays blocked' test/pwa-ui.integration.test.mjs`.

`focused.log` and `ui-green.log` retain intermediate failures from assertions that expected only a delete button before the bookmark was added. Assertions were updated to verify two separate controls and preserve native links. `recovery-first-fix.log` retains the first correction run: recovery correctly rejected, but the test initially expected the inner `favorite-unsupported` code instead of the journal's public `resolution-read-failed` code. The assertion now uses that existing public contract and still requires the journal to remain unknown and writes blocked.

## Critic follow-up

The real client represents PATCH 401/403 as `http-rejected` with an HTTP status. The journal previously reduced those responses (and rejected 429 responses) to a generic write failure. Tests first reproduced the missing safe code for all three statuses. For favorite operations, the journal now maps only recognized rejected 401/403/429 responses to `unauthorized`, `forbidden` and `rate-limited`, while preserving unknown-write handling and redacting server diagnostics. The UI then retains its existing token, permission or retry guidance. Each integration test asserts one PATCH, a failed rather than unresolved operation, and no private server text.

`permission-scope-first.log` preserves the first full-suite failure: mapping all operation kinds also changed the existing deletion guidance. The mapping was restricted to favorite journal targets, retaining the deletion contract.

Additional favorite-specific integration tests hold a catalog or brew-picker response, replace the connection, then release the stale response. Both prove that it cannot render or populate the new connection's option cache. Another test changes the connection revision and data-source identity during unknown favorite recovery and verifies that the operation remains unknown without another PATCH. These existing guards already passed the new tests and needed no additional production changes. Focused command: `node --test test/pwa-ui.integration.test.mjs test/pwa-submission-state.test.mjs test/pwa-commands.test.mjs`, exit 0, 93/93, `critic-fixes-focused.log`.

## Final gates

| Command | Exit | Result | Log |
| --- | --- | --- | --- |
| `npm test` | 0 | 687 tests passed; 0 failed | `npm-test.log` |
| `npm run build:pages` | 0 | Build `80bdde6adfa6` | `build-pages.log` |
| `npm run check:pages` | 0 | Pages artifact validation passed | `check-pages.log` |
| `git diff --check` | 0 | No whitespace errors | run in feature worktree |

The initial full test attempt was blocked by local HTTP listen permission (`EPERM`). The final `npm test` run used approved execution permission and passed. The final logs supersede that environment failure.

## Request-count probe

Run `node docs/evidence/favorites-20261103/request-count-probe.mjs`. The script extracts repository modules from the recorded baseline HEAD into a temporary directory, compares them with working-tree modules, and removes the temporary directory. It never sends network requests.

`request-count.log` records baseline `93f2c65b55c56eb62b35811377cd39a9cf36bba0` and five alternating runs per scenario. Each run consumed 20 validated bean rows. Baseline ordinary listing, current ordinary listing and current favorite listing each issued exactly one `queryPage` call (range 1–1), with zero item reads and zero errors. Assertions check the filter and decoded favorite values. This proves the repository adds no per-item requests for this synthetic path; it is not a Notion latency or production throughput measurement. Network pacing, query costs and real Notion filtering are outside this probe.

## Verification limits and handoff

The automated UI fixture verifies bookmark accessibility names and pressed state, distinct card controls, focus restoration after rerender and preservation of search with the brew filter. CSS defines a 44px minimum control size and stacking above the card link. These are automated fixture/source checks, not a real-browser mobile layout or keyboard inspection.

Real-browser screenshots at 320px, live Notion checkbox support and write permissions, cross-device sharing, Critic review, commit/merge, deployment and public-file/version verification remain for the Orchestrator. No production Notion mutation is authorized by this evidence. The feature worktree is `/private/tmp/ax-favorites-20261103`, branch `codex/favorites`.
