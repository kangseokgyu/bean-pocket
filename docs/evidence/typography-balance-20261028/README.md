# Typography balance evidence — 2026-10-28

The source demo at `/tmp/bean-type-demo/index.html` was reviewed. Only `pwa/styles.css` was changed; the demo, production modules, and permanent test suite were not modified for verification.

## Browser verification

`node /tmp/bean-type-demo-check/check.cjs` — exit code 0. The temporary fixture served the working tree's `pwa/styles.css`, `pwa/ui/view.mjs`, `pwa/domain.mjs`, and `lib/domain.mjs` directly. It checked 25 combinations: 320, 390, 768, 1024, and 1440px across home, beans, recipes, records, and bean detail.

Verified computed styles and layout: menu text 16px; menu gap 4px on mobile and 8px on desktop; card titles 15px and body 14px; bean labels 13px; list heading 17px/1.4; list gap 8px; entity header gap 6px; bean metadata spacing; recipe/record first paragraph top margin 0; delete targets 46×46px with bottom margin −14px. Long titles wrapped without overlapping delete buttons. No page errors or horizontal overflow occurred.

Full output: `browser.txt`.

## Repository verification

| Command | Exit code | Result |
| --- | ---: | --- |
| `npm test` | 0 | 610 passed, 0 failed |
| `npm run build:pages` | 0 | Built version `0761822778f5` |
| `npm run check:pages` | 0 | Pages artifact check passed |
| `git diff --check` | 0 | Clean |

Full output: `npm-test.txt`, `build-pages.txt`, and `check-pages.txt`.

Full logs are preserved as tracked `.txt` evidence.

## Independent review

Critic (`gpt-6.1-sol`, medium) approved the source change before integration with no required findings. The approved demo and CSS selectors were compared against the actual view structure. An independent Chrome check covered 25 screens and 20 short-title cards: no title/delete overlap or horizontal overflow; delete targets remained 46×46px and `elementFromPoint` hit the delete button at its center. The Worker used `gpt-6-luna`, max. Neither agent spawned additional agents.

After fast-forward integration into main, `npm test` again passed 610/610 (exit 0), `npm run build:pages` produced `0761822778f5` (exit 0), and `npm run check:pages` passed (exit 0). Runtime sources were unchanged by integration. Safari and real-device touch were not tested.

## Deployment

- Change commit: `5f3d80d`; fast-forwarded to main and pushed with the feature branch.
- Workflow: https://github.com/kangseokgyu/bean-pocket/actions/runs/40708796194 — completed successfully, manually dispatched on main with `probes=false`.
- Public URL: https://kangseokgyu.github.io/bean-pocket/
- Public build: `0761822778f5`.
- `node /tmp/typography-public-check.mjs` exited 0: all 20 deployed files returned HTTP 200 and matched the local build byte-for-byte (`public-files.json`).
- `node /tmp/typography-public-browser.cjs` exited 0: fresh Chrome contexts at 390/1440px displayed the expected build, loaded menu CSS at 16px and gaps 4px/8px, had no page errors or horizontal overflow (`public-browser.json`). The menu is hidden in the fresh disconnected state; connected menu/card visuals were verified in the local actual-source fixture rather than with a real Notion account.
- Initial public browser assertion incorrectly required the disconnected menu to be visible and timed out after 30 seconds. The check was corrected to inspect attached menu CSS and the visible public build. No product change was needed.
- Safari, existing-client service-worker update adoption, real Notion operations, and real-device touch were not tested.
- Rollback: revert `5f3d80d` on a new feature branch, run the same required checks and review, integrate and dispatch `pages.yml` with `probes=false` under the project deployment policy.
