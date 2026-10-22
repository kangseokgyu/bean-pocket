# 반투명 초기 로딩 오버레이 — 2026-10-22

## 요청 및 변경

기준 main `c114ee4`, 기능 브랜치 `codex/translucent-startup-loading`. 앱 변경은 `pwa/styles.css` 한 줄이며 기존 배경색을 `rgb(243 239 230 / 35%)`로 변경했다. 오버레이와 스피너의 opacity는 1로 유지하여 스피너를 함께 흐리게 만들지 않는다. 전체 화면 영역·입력 차단·종료·성공 메시지 숨김과 데이터 로딩 로직은 유지한다. 작은 변경이라 별도 에이전트 없이 직접 수행하고 리뷰했다.

## 검증

| 항목 | 명령/방법 | 결과 | 근거 |
| --- | --- | --- | --- |
| 선행 브라우저 검증 | 변경 전 빌드에서 `node /tmp/translucent-loading-browser.cjs` | 종료 1. 배경이 rgb(243,239,230)으로 불투명해서 기대값 rgba(243,239,230,0.35)과 불일치 | browser-red.txt |
| 전체 테스트 | `npm test` | 종료 0, 410개 통과, 실패·생략 0 | feature-tests.tap |
| 일반판 빌드 | `npm run build:pages` | 종료 0, `4e07fb5d7615` | feature-build.txt |
| 산출물 검사 | `npm run check:pages` | 종료 0 | feature-check.txt |
| 브라우저 완료 검증 | `node /tmp/translucent-loading-browser.cjs` | 종료 0. 320·390·768·1024·1440px에서 배경 alpha=.35, 오버레이·스피너 opacity=1. 전체 화면 중앙 배치, transform 격리, 입력 차단·완료 후 복원, 모션 감소·회전 픽셀 차이 확인 | browser-results.json |
| 기존 데이터와 전환 | 실제 dist view/controller를 쓰는 결정적 fixture에서 기존 원두를 먼저 로딩하고 initialize 재실행 | 로딩 중 기존 DOM·원두 내용이 유지되며 반투명 배경 뒤로 보임. 성공은 새 원두 렌더링 시점에 오버레이가 아직 열려 있고 이후 숨김. 조회 실패는 기존 DOM·원두 내용 유지, 오버레이 종료와 오류 안내 표시 | browser-results.json, loading-over-existing-data.png, loading-before-read-error.png |

기존 정상 조회 문구가 표시되지 않음, 연결 없음·연결 오류·복구·잠금·조회 실패·동결 시 종료도 확인했다. 실행 오류·HTTP 오류 0. Chrome DevTools MCP가 제공되지 않아 번들 Playwright와 기존 설치된 격리 Chromium headless shell 1208을 사용했다. 재현 스크립트는 browser-check.cjs에 보관하며 루트에서 일반판 빌드 후 `node docs/evidence/translucent-startup-loading-20261022/browser-check.cjs`로 실행한다(로컬 번들 Playwright 및 Chromium 경로 사용, 포트 4187).

## 변경분 리뷰 및 한계

`git diff --check` 통과. 구현이 배경색 한 줄에 한정됨을 확인했고 원두 삭제 등 기존 기능 소스는 변경하지 않았다. 배경 조작 차단은 기존 inert·touch-action과 오버레이를 유지한다. 스피너 대비와 기존 데이터 가독성을 스크린샷으로 확인했다. 병합 차단 사항 없음. 실제 iPhone Safari·홈 화면 PWA·실기기 스크린리더 출력과 실제 Notion 연결은 미검증이다. 최초 앱 실행에는 이전 목록이 메모리에 없으므로 당시 준비된 기본 화면이 비쳐 보이며, 이전 목록의 영구 저장 기능을 추가한 것은 아니다.

main 통합 및 게시 결과는 아래에 추가한다. 회귀 시 이 CSS 변경만 기능 브랜치에서 revert하고 동일 필수 검증 후 일반판 pages.yml(probes=false)으로 재게시한다.
