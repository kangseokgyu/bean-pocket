# 목록 새로고침 버튼 제거 — 2026-10-21

- 요청: 원두·봉지·레시피·추출 기록의 헤더 새로고침 버튼 제거.
- 공통 헤더 버튼과 버튼 전용 클릭 처리를 제거했다. 추가 버튼 및 아래로 당겨 페이지 새로고침은 유지한다.
- 선행 회귀 테스트: `node --test --test-name-pattern='collection headers' test/pwa-ui.view.test.mjs`, exit 1. 기존 원두 화면에 버튼이 남아 있어 의도대로 실패. `/tmp/ax-remove-refresh-red.tap`.
- 첫 테스트 실행은 assert가 순환 가짜 DOM 객체를 출력하며 메모리 오류를 일으켰다. 존재 여부를 boolean으로 검증하도록 고쳐 의도한 실패를 확인했다.
- 수정 후 UI 테스트: `node --test test/pwa-ui.view.test.mjs`, exit 0, 34/34 통과. `/tmp/ax-remove-refresh-focused.tap`.
- 전체 `npm test`: exit 0, 385/385 통과. `/tmp/ax-remove-refresh-full.tap`. 첫 sandbox 실행은 로컬 HTTP listen EPERM으로 실패했고, 제한 밖 실행으로 검증했다.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: exit 0. 일반판 빌드 `2b3077bdefe6`.
- 직접 diff 리뷰: 요청한 네 화면에 공통 적용됨을 확인. 기존 컨트롤 탭 테스트를 원두 추가 버튼으로 전환하여 같은 회귀 보장을 유지. 불필요한 핸들러 제거 외 데이터 조회·저장 변경 없음. 수정 필요 사항 없음.
- 단순 UI 제거 작업으로 별도 에이전트 없이 직접 수행했다.
