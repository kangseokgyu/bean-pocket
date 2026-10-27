# Tab Transition Skeleton Plan

1. Add regression tests first for route-switch skeletons, first-page replacement, stale/cancelled reads, read failures, and navigation/form preservation.
2. Add a route-read loading state independent from write `pending`; show the existing list skeleton only while a new route's first page is unresolved. Keep pagination and deferred hydration out of this state.
3. Guard success, error, and cancellation cleanup with the active request generation so stale reads cannot hide a newer skeleton or expose stale-route content.
4. Run focused tests red then green, full `npm test`, `npm run build:pages`, and `npm run check:pages`; verify tab transitions in a browser fake fixture when available.
5. Record concise commands/results and any limits in `docs/evidence/tab-loading-skeleton-20261027/README.md`, then commit only task files on `codex/tab-loading-skeleton`.
