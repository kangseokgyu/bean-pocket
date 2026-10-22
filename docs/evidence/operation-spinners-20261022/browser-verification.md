# Browser verification — 2026-10-22

Orchestrator ran the built PWA (`51e146ba6592`) in an isolated Chromium context with service workers blocked. The real app/controller/view/data/state adapters used a local synthetic Notion fixture with 250ms response delays and fake credentials; no actual Notion request or user data was used. DevTools MCP was unavailable, so installed Playwright/Chromium was used without installing packages or changing user profiles.

- At 390×844: connection save, bean save, bean deletion, and reduced-motion mode showed 12 spokes with `aria-busy=true`; the spinner hid after completion. Normal computed animation was `pull-refresh-spin`; reduced-motion was `none`.
- At widths 320, 768, 1440: save indicators stayed inside the viewport. At 320px the form was scrolled 481px and the spinner top remained 30.39px.
- A simulated Notion 429 on save ended the spinner, preserved the entered bean name, and enabled save controls again.
- Page errors: zero. These are representative browser paths; other async entrypoints are covered by the controller inventory, tests, and independent review.
- The initial browser run exposed an offscreen indicator while saving a scrolled form (`top=-232.61px`). `browser-before-fix.json` and its screenshot retain that failure; the final results and screenshots demonstrate the correction.
- The first QA script attempt stopped because its button selectors did not match the UI (`add-bean`/`저장`). The selectors were corrected to `show-bean-form`/`원두 저장` before collecting complete results.

Evidence: [results](browser-results.json), [mobile save](browser-save-mobile.png), [320px](browser-save-320.png), [desktop](browser-save-desktop.png).

Not verified: iPhone/Safari hardware, actual Notion writes, screen-reader speech, and existing installed PWA update behavior. Public deployment verification is recorded separately after release.
