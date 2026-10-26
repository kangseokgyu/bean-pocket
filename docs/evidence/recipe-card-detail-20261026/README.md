# 레시피 카드 클릭 상세 보기 — 2026-10-26

레시피 목록 카드의 상세 보기 버튼을 제거하고 제목 native 링크의 클릭 영역을 카드 전체로 확장했다. 목록에만 `recipe-summary-card`를 적용해 기존 상세 화면의 복사·추출 기록 버튼을 가리지 않는다. 원두 카드와 클릭·포커스·호버 CSS를 공유하고 삭제 버튼은 별도 레이어에서 동작한다.

검증:

- `red.txt`: `node --test --test-name-pattern='recipe list card' test/pwa-ui.view.test.mjs`, 1 통과 / 1 실패. 새 native 링크 부재로 의도한 실패, 종료 코드 1.
- `test-sandbox-failure.txt`: 첫 전체 테스트는 localhost 바인딩이 `listen EPERM`으로 차단되어 HTTP 테스트 14개 실패. 코드 오류가 아닌 실행 제한으로 확인하고 해당 제한을 해제한 실행 환경에서 재검증.
- `test.txt`: `npm test`, 488 통과 / 실패·skip 0, 종료 코드 0.
- `build.txt`, `check.txt`: `npm run build:pages`, `npm run check:pages`, 각각 종료 코드 0. 빌드 `be824830580f`.
- `browser-check.cjs`, `browser.txt`, `browser.json`, `recipe-hover-*.png`: Chromium 320/390/768/1024/1440px에서 상세보기 버튼 제거, 본문·여백 클릭, Enter, Tab 순서, 삭제 취소 시 목록 유지, 호버, 가로 넘침 및 pageerror 없음, 상세 화면 복사 보존을 확인했다. 터치 에뮬레이션에서 카드 탭과 상세 화면 추출 기록 작성 시 레시피 선택도 확인했다. 종료 코드 0. 320px 스크린샷 직접 열람 완료.
- `browser-hover-failure.txt`: 초기 색상 비교에서 같은 색상이 관찰돼 실패했다. 정확한 타이밍 원인은 확정하지 않았다. 비교 전·후 전환 대기 및 포인터 hit-test 진단을 추가해 최종 검증 통과.
- `browser-label-failure.txt`: 검증 스크립트가 기존 취소 버튼을 잘못된 이름 `취소`로 찾았다. 실제 접근성 이름 `입력 취소`로 수정 후 통과.

메인 에이전트가 정확성·읽기 쉬움·기존 구조·텍스트 안전성·성능 관점으로 diff를 자체 검토했고 차단 사항 없음. 작은 UI 변경으로 서브에이전트는 구성하지 않았다. 새 의존성·데이터 변경 없음. 원두 카드 동작과 상세 화면의 기존 동작은 전체 테스트로 회귀 확인했다.

실제 iPhone Safari·설치 앱 및 실제 Notion 데이터 조작은 미검증. 게시 결과는 deployment.md에 기록한다.
