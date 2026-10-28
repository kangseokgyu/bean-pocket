# Toast-only loading status — 2026-10-28

## 변경

- 시작 연결 확인, 첫 목록 조회, 저장·삭제와 새로고침 중 전체 화면 스피너 overlay를 제거했다. 진행 중 상태는 기존 하단 토스트의 메시지·아이콘·`aria-busy`로 표시한다.
- 시작 연결을 확인할 때 `.page`의 `inert` 잠금과 pending 중 버튼 비활성화를 유지한다. 토스트는 inert 영역 밖인 `document.body`에 표시하고, 초기화 완료 뒤에는 앱 또는 연결 dialog 안으로 되돌린다.
- 삭제 dialog는 삭제 요청이 pending인 동안에만 상태 토스트를 dialog 위에 표시한다. 결과 단계는 기존 dialog 피드백을 유지한다.
- 상단 당겨 새로고침 gesture spinner는 그대로 두었다. 사용 안내도 갱신했다.

## 검증

| 명령 | 종료 | 결과 및 증거 |
| --- | ---: | --- |
| `node --test test/pwa-ui.view.test.mjs` (RED) | 1 | 124 tests, 113 pass, 11 fail. Overlay 부재, 시작 토스트 노출, pending 잠금, 삭제 pending 토스트에서 의도한 실패를 확인했다. `focused-red-assertions.tap`. |
| `node --test test/pwa-ui.view.test.mjs` (GREEN) | 0 | 124/124 pass. `focused-green.tap`. |
| `node docs/evidence/toast-only-loading-20261028/browser.cjs` | 0 | Chromium·WebKit × 390/768px, 4 cases. 각 case에서 시작 연결 확인, 첫 목록 조회, 새로고침, 완료 전환과 잠금을 확인했다. pageerror 0. `browser-results.json`, `startup-390.png`. |
| `npm test` | 0 | 595/595 pass, 0 fail/cancel/skip. `npm-test.tap`. |
| `npm run build:pages` | 0 | 성공, build `a0341422e675`. `build-pages.txt`. |
| `npm run check:pages` | 0 | Pages 산출물 검사 통과. `check-pages.txt`. |
| `git diff --check` | 0 | 공백 오류 없음. |

첫 focused RED 실행은 실패 assertion이 순환 DOM 노드를 직접 출력하면서 Node 23.4 heap OOM으로 종료했다 (`focused-red.tap`). 테스트는 부모 노드 identity를 boolean으로 비교하도록 고쳤고, 그 뒤 124개 중 11개의 의도한 동작 실패를 정상적으로 확인했다 (`focused-red-assertions.tap`).

## 확인 범위와 한계

브라우저 fixture는 실제 view/controller를 사용하되 연결·목록 데이터는 mock으로 제공한다. 실제 Notion 요청·삭제, 실기기 iPhone/Safari, 스크린 리더 음성은 확인하지 않았다.
