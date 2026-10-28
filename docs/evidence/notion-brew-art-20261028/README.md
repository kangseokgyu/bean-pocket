# Notion-style coffee-brewing artwork

- User follow-up prompt: “그림이 이상해. 노션 스타일로 커피 내리는 그림으로 그려줘.”
- Supplied image: `/Users/kangseokgyu/.codex/generated_images/01a182b5-60f5-7cb2-9803-abbdc2738e77/exec-0fcecdf3-4b59-4adf-a7a5-1ca85b4054bd.png` — transparent 1254×1254 RGBA, copied unchanged to `pwa/icons/home-brew.png`.
- SHA-256: `5ca4eba24ca3a37de5d8363f08bb982f4ea2adea2e95daccd395a05a5ff4d8b2` (source and project asset match).
- Scope: replace only the previous SVG hero artwork; preserve the hero copy, CTA, layout, and CTA route. Add the PNG to the Pages build allowlist, output check, and service-worker cache.
- Focused checks: home hero UI test 1/1 passed; illustration build/cache test 1/1 passed.
- Full validation: `npm test` passed 611/611; `npm run build:pages` passed with version `41bc06ad0638`; `npm run check:pages` passed.
- Browser limitation: when I attempted visual verification, CUA listed no browser, `iab` creation reported unavailable, and the Safari binding call was interrupted after 459.7 seconds. The orchestrator later restored IAB and opened the shared preview at `http://127.0.0.1:4174/pwa/hero-preview.html`; I did not inspect that recovered browser preview. Critic can use the shared tab for visual review.
