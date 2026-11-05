# Search keyboard publication

Published source commit `47a5def25c8556a512a9b05a10625387eb8ebe03` on main.

- Public URL https://kangseokgyu.github.io/bean-pocket/
- Build version `50779679988f`.
- Workflow https://github.com/kangseokgyu/bean-pocket/actions/runs/42040140902
- Dispatch command `gh workflow run pages.yml --ref main -f probes=false`.
- Workflow build and deploy jobs both completed successfully.
- Integrated local `npm test` passed 739/739. Pages build and artifact check passed.

Public verification requested `index.html`, `app.mjs`, `ui/view.mjs`, `styles.css`, `sw.js`, and `manifest.webmanifest` over HTTPS with cache-busting build query and Cache-Control no-cache. All returned HTTP 200 and matched the local `dist` bytes exactly. The index and service worker contain the expected build version. SHA-256 results are in `public-check.json`.

This document and public-check.json record deployment only and do not change the source build inputs. No additional deployment is needed for this documentation commit. Existing running iPhone clients may still need to apply the update; native iPhone Safari and home-screen keyboard behavior were not directly exercised.
