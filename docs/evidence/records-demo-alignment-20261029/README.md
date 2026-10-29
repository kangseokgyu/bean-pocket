# Records demo alignment evidence

## 통합·게시 완료 (2026-10-29 KST)

- 데모 동등성 구현 `1cc3826`, 리뷰 수정 `f559bd9`, 검증 정리 `b7fa694`, 독립 재리뷰 승인 `cc1d545`를 main에 fast-forward 후 push했다. 검증한 소스와 동일하여 동일 로컬 전체 검증을 반복하지 않았다.
- 일반판 `probes=false` 배포 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/40850164705 (`deployment.json`). main CI에서도 전체 테스트·일반 빌드·산출물 검사를 통과했다.
- 공개 추출 기록 화면: https://kangseokgyu.github.io/bean-pocket/#/records
- 공개 빌드 **`cfa4de79469e`**. 정적 파일 26개 모두 HTTP 200이며 최종 로컬 빌드와 바이트·SHA256 일치 (`public-verification.json`).
- 독립 재리뷰에서 필터 전환 결과 2건 일치, 데모·운영 그래프 높이 250/250px, 5개 화면 폭의 배치·가독성 및 관측 대상 정리(반복 선택 후 1개/화면 이탈 후 0개)를 확인했다 (`critic.md`).
- 실제 에이전트 설정: Worker `gpt-6-luna`/`max`가 사용량 제한으로 중단되어 정책상 허용 대체 Worker `gpt-6.1-sol`/`medium`이 마무리했다. Critic은 `gpt-6.1-sol`/`medium`을 재사용했다.
- 실제 Notion 계정 조회·저장·삭제, 실제 iPhone Safari/홈 화면, Firefox, 실물 키보드 조작은 확인하지 않았다. 운영 화면 브라우저 검증은 테스트 연결과 가로챈 Notion 응답을 사용했다.
- GitHub 실행에 Node 20 지원 종료와 ubuntu-latest 변경 안내가 있었으나 배포는 성공했다. 워크플로는 이번 범위에서 변경하지 않았다.

## Result

Production `#/records` now follows the approved demo's hierarchy: a recent-bean sidebar beside the selected-bean summary, rating trend, best-rated record, and comparison table. At mobile widths the same sections stack in order and comparison rows become cards. Existing search, filters, paging, drafts, save, and delete remain under the collapsed **전체 기록 조회·관리** section.

Trend and best-record summaries use the selected bean's entire loaded insight sample; recipe filtering and comparison sorting affect only comparison rows. The page states its loaded-record scope. Snapshot values remain historical, and no roast age or total brew duration is inferred.

The final UI fix keeps record management available when the bounded insight state is absent or still loading. Its regression test was first confirmed failing in [management-fallback-red.txt](management-fallback-red.txt), then passed in the focused and full suites.

## Review fixes and final verification

The two required findings in [critic.md](critic.md) are fixed. Selecting another bean clears its previous recipe filter. Data refresh also clears a recipe filter whose option disappeared after the last matching record was removed, keeping the menu and comparison rows consistent. The duplicate bean-selection handler was removed.

The trend SVG now stays 250px high, matching the demo at all five widths. ResizeObserver recalculates its viewBox and coordinates for the available width, retaining actual calendar-day spacing and the fixed 1–5 scale. Labels and points keep their screen size; crowded intermediate date ticks are hidden while first/last dates and the full text alternative remain available. The final 320/550/768/1024/1440 production screenshots were opened and visually inspected.

Final Pages output build: `cfa4de79469e`.

- `node --test test/pwa-ui.view.test.mjs test/pwa-records-insights.test.mjs` — 149 passed, 0 failed ([review-fix-release-focused.txt](review-fix-release-focused.txt)).
- `npm test` — 638 passed, 0 failed ([review-fix-release-npm-test.txt](review-fix-release-npm-test.txt)).
- `npm run build:pages` and `npm run check:pages` — passed ([build](review-fix-release-build-pages.txt), [check](review-fix-release-check-pages.txt)).
- Source, test, browser-script, and Markdown diff whitespace checks — passed. Full staged whitespace checking reports whitespace-only assertion-diff lines in four raw RED logs; those original logs are intentionally preserved unchanged.
- [Final browser fixture](review-fix-browser-validation.mjs) — passed at 320/550/768/1024/1440px against build `cfa4de79469e` ([log](review-fix-release-browser-validation.txt)). It verifies matching 250px demo/production chart heights, viewport-width coordinates, separated date labels, fixed scale, date spacing, score-label containment, no page overflow, filter reset on bean changes, comparison/trend/best consistency, Enter/Space selection, legacy search/filter, and create/delete. No console/page errors, failed responses, or unmocked external requests; 80 requests, all Notion calls intercepted.

Final paired screenshots: `review-fix-demo-<width>.png` and `review-fix-production-<width>.png`. Real Notion accounts, Safari/Firefox, physical mobile devices, and physical keyboard input were not tested. Chrome keyboard automation was tested. Publishing and public build verification remain the Orchestrator's next step.

The chart-height regression was first confirmed failing at 460px ([red](review-fix-chart-height-red.txt)); the removed-recipe option case failed with a hidden filter and no comparison table ([red](review-fix-deleted-recipe-red.txt)) before both recipe regressions passed ([green](review-fix-recipe-filter-final-green.txt)). The narrow-screen date-label spacing assertion first failed with less than a 1px gap ([red](review-fix-date-label-red.txt)), then passed in the final browser run. Earlier failing logs and screenshots are retained. The review-fix sandbox full-suite attempt had 622/637 passing with 15 `listen EPERM` failures ([log](review-fix-npm-test-sandbox.txt)); the final loopback-authorized run above passed. Intermediate builds and logs are historical, not the final result.

## Initial implementation verification

Initial implementation checks used Pages output build `c7ff26136829`:

- `node --test test/pwa-ui.view.test.mjs test/pwa-records-insights.test.mjs` — 147 passed, 0 failed ([ui-insights-green.txt](ui-insights-green.txt)).
- `npm test` — 636 passed, 0 failed ([npm-test.txt](npm-test.txt)).
- `npm run build:pages` — passed, output build `c7ff26136829` ([build-pages.txt](build-pages.txt)).
- `npm run check:pages` — passed ([check-pages.txt](check-pages.txt)).
- `git diff --check` — passed.
- Production browser fixture — passed at 320, 550, 768, 1024, and 1440px ([browser-validation.txt](browser-validation.txt)). It checked paired demo/production captures, desktop and mobile layout, no horizontal overflow, selected summaries, score labels and chart scale/spacing, Enter/Space bean selection, recipe filters and sort orders isolated from trend/best, plus management search/filter, create, and delete. There were no console or page errors, failed responses, or unmocked external requests. Its 80 requests used synthetic fixtures; Notion API calls were intercepted.

Paired screenshots are saved as `demo-<width>.png` and `production-<width>.png` for each tested viewport. The browser fixture is [browser-validation.mjs](browser-validation.mjs). It uses no real Notion account or user records.

## Failure history

The first sandbox `npm test` run reported 607/635 passing. Fifteen HTTP tests could not bind localhost (`listen EPERM`); the remaining 13 failures were 12 UI cases where record management disappeared before insights loaded, plus one assertion expecting obsolete scope wording. The UI fallback was fixed, the stale assertions were updated, and the full suite was rerun with loopback permission; the final result is 636/636. The initial log is preserved as [npm-test-sandbox.txt](npm-test-sandbox.txt).

The browser iteration logs and the narrow table-overlap regression capture are retained in this folder. The table spacing was corrected before the final build and final five-width browser run.
