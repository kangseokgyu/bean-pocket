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
