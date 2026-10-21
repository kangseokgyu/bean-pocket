# 입력창·버튼에서 당겨 새로고침 — 2026-10-21

입력창·버튼·링크·선택 상자·접이식 제목·편집 영역·표에서 시작한 아래 방향 스와이프도 페이지 전체 새로고침으로 처리한다. 내부 스크롤 영역이 맨 위가 아니면 내부 스크롤을 우선한다. 작은 움직임은 탭으로 유지하고, 당긴 뒤 놓을 때 잘못된 버튼 클릭이 발생하지 않도록 기본 동작을 취소한다. 저장·조회·업데이트 동결 중 차단과 스피너 동작은 유지한다.

- 선행 관련 테스트: exit 1, 2 통과·2 실패. 컨트롤 시작 동작이 차단되는 기존 동작을 확인했다. `/tmp/ax-control-pull-red.tap`.
- 작은 손떨림 테스트 추가 후 exit 1, 1 실패. 5px 이동에서도 기본 동작을 취소하는 문제를 확인한 뒤 당김 인식 기준을 보완했다. `/tmp/ax-control-pull-jitter-red.tap`.
- `node --test test/pwa-ui.view.test.mjs test/pwa-ui.integration.test.mjs`: exit 0, 33/33 통과. `/tmp/ax-control-pull-focused.tap`.
- `npm test`: 로컬 HTTP 테스트 서버 실행 허용 후 exit 0, 377/377 통과. `/tmp/ax-control-pull-full.tap`.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: exit 0. 후보 빌드 `503e0e3ba6bb`. `/tmp/ax-control-pull-build.log`, `/tmp/ax-control-pull-check.log`.

합성 터치 이벤트 기반 자동 검증이다. Safari/iPhone 실기기 조작과 배포는 수행하지 않았다.
