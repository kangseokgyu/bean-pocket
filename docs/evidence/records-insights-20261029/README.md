# Records insights verification

## 통합·게시 완료 (2026-10-29 KST)

- 기능 `4f864fc`, 리뷰 수정 `186c5b8`, 재리뷰 승인 `8d5e35e`를 main에 fast-forward 후 push했다. 검증된 소스와 같아 동일 로컬 전체 검증을 반복하지 않았다.
- 일반판 `probes=false` 게시 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/40819788478 (`deployment.json`). main CI에서도 전체 테스트·일반 빌드·산출물 검사를 통과했다.
- 실제 추출 기록 화면: https://kangseokgyu.github.io/bean-pocket/#/records
- 공개 빌드 **`a5df255ed2d7`**. 공개 정적 파일 26개 모두 HTTP 200, 로컬 최종 빌드와 바이트·SHA256 일치 (`public-verification.json`).
- 실제 계정의 Notion 조회·저장·삭제, 실제 iPhone Safari/홈 화면, Firefox는 확인하지 않았다. 브라우저 검증은 운영 모듈과 테스트 연결·가로챈 Notion 응답을 사용했다.
- 실제 에이전트 설정: Worker `gpt-6-luna`/`max`, Critic `gpt-6.1-sol`/`medium` 재사용. Orchestrator는 구현·테스트를 중복하지 않고 통합·게시 및 공개 파일 확인을 수행했다.
- GitHub 실행의 Node 20 지원 종료·ubuntu-latest 변경 안내가 있었으나 테스트·배포는 성공했다. 워크플로 변경은 이번 범위 밖이다.

## Critic fix verification (latest)

- `npm test`: 633 passed, 0 failed. Output: `review-fix-npm-test.txt`.
- `npm run build:pages`: passed with build version `a5df255ed2d7`. Output: `review-fix-build-pages.txt`.
- `npm run check:pages`: passed. Output: `review-fix-check-pages.txt`.
- `node docs/evidence/records-insights-20261029/browser-validation.mjs`: passed against that production build. Output: `review-fix-browser.txt`.
- `git diff --check`: passed.

The review fixes show up to three recent bean summaries at once as native buttons. Each card shows the latest extraction date, its recipe name, and the rating on that latest record. A missing rating is labelled “별점 없음”; an invalid rating is labelled “별점 확인 필요”. Snapshot bean and recipe names take precedence over live parent names; missing snapshot recipe names can use a live recipe name when available. Pressing Enter or Space selects a focused card, updates `aria-pressed`, and synchronizes the selected bean's chart and best record.

The Pages checker now normalizes only the SVG namespace literal passed directly to `document.createElementNS`. The generated-output mutation test first reproduced a missing rejection for `fetch(SVG_NS)`; after the fix, alias requests and unrelated external URLs are rejected while the local SVG constructor passes. The red/green test outputs are `review-fix-checker-red.txt` and `review-fix-checker-green.txt`.

The latest browser run checked five widths (320, 550, 768, 1024, and 1440px), visible cards, Enter and Space selection, chart synchronization, snapshot bean-name priority, recipe-filter isolation, and record create/delete. Screenshots are `review-fix-records-320.png`, `review-fix-records-550.png`, `review-fix-records-768.png`, `review-fix-records-1024.png`, and `review-fix-records-1440.png`. It reported no horizontal overflow, console/page errors, failed responses, or unmocked external requests. All 75 Notion API requests were intercepted and answered from the local fixture.

TDD regression results are retained separately: `review-fix-model-red.txt` / `review-fix-model-green.txt` and `review-fix-view-red.txt` / `review-fix-view-green.txt`. The browser used a local fixture, not a real Notion connection. Physical-keyboard, Safari, and Firefox behavior were not independently checked.

## Initial implementation verification (before critic fixes)

- `npm test`: 632 tests passed, 0 failed. Full output: `npm-test-final.txt`.
- `npm run build:pages`: passed, build version `9cdb7caa5faa`. Output: `build-pages.txt`.
- `npm run check:pages`: passed. Output: `check-pages.txt`.
- `node docs/evidence/records-insights-20261029/browser-validation.mjs`: passed against the built Pages output. Output: `browser-validation.txt`.
- `git diff --check`: passed.

The browser run covered widths 320, 550, 768, 1024, and 1440 CSS pixels. Each final screenshot is saved as `records-<width>.png`. `records-320-overflow-before-fix.png` shows the initial 320px header overflow before the fix.

The browser used a memory-backed OPFS fixture and a fake test token. All 75 Notion API requests were intercepted and answered locally; no Notion account or real connection data was used. The run found no page or console errors, failed responses, unmocked external requests, or horizontal page overflow. It exercised the recent-bean list, date-spaced chart, text alternative, best record and snapshot conditions, selected-bean changes, recipe-filter isolation, and the record create/delete dialogs.

The bean control is a labelled, enabled native `<select>` and the browser check confirmed it can receive focus; selecting another option updated the chart and best record. Synthetic ArrowDown/End key events did not change this native control in headless Chrome, so the browser automation used Playwright's native `selectOption` operation for the selection-change assertion. The control retains the browser's built-in keyboard behavior; the run did not independently verify that behavior with a physical keyboard.

## Failure and repair history

The first full suite run reported 603/631 passing. The initial output was overwritten by later successful runs, so the final output is preserved separately above; the failure categories and repairs were:

- 15 HTTP integration cases could not bind listeners under the default sandbox (`listen EPERM`). The full suite was rerun with the authorized escalation, and the final run passed.
- 10 isolated build fixtures did not include the newly required insights modules; fixture contents were updated.
- 1 Service Worker cache-list assertion did not include the new modules; the expected app-file list was updated.
- 1 SVG namespace test leaked a modified module into cleanup; the test now saves and restores the exact source.
- 1 one-point chart DOM assertion expected a selector the fake DOM did not implement; the selector check was corrected.

Initial browser attempts also exposed two test/production issues. The built insights module imported `../../lib/domain.mjs`, which escaped the Pages bundle and requested `/lib/domain.mjs` (404); it now imports the bundled `../domain.mjs`, with a build regression test. The browser fixture initially stringified snapshot objects as `"[object Object]"`; it now JSON-encodes snapshots and checks that the production repository decodes all fixture records before launching Chrome.

The browser run then found the real 320px overflow: the navigation tabs and header tools occupied one row and extended the document to 381px. At widths up to 360px the tabs now wrap below the logo and header tools. The final five-width run passed.

The first loopback server attempt was denied by the sandbox (`listen EPERM`); the validation was rerun with escalation on a temporary loopback-only server. Notion traffic remained intercepted by the test fixture throughout.
