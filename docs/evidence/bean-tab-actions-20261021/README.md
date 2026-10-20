# 원두 탭 아이콘 동작 변경 — 2026-10-21

원두 추가 폼을 기본 숨김으로 바꾸고 제목 옆 `+` 버튼으로 연다. 입력 취소 및 저장 성공 시 초안 정리 경로에서 다시 숨긴다. 열린 폼과 입력은 탭 이동·목록 재조회에도 유지한다. 공통 목록 새로고침은 `↻` 아이콘으로 표시하며 기존 새로고침 동작을 유지한다. 두 버튼에는 접근성 이름과 툴팁을 제공하며 저장·업데이트 동결 중에는 기존 비활성화 정책을 따른다.

- 선행 `node --test test/pwa-ui.view.test.mjs`: exit 1, 기존 12 통과·신규 2 실패. 기본 폼이 숨겨지지 않고 새로고침 아이콘의 접근성 이름이 없는 의도한 실패. [RED](red.tap).
- 구현 후 같은 명령: exit 0, 14/14 통과. 열기·취소·초안/열림 유지·접근성 속성·새로고침 호출·저장 중 버튼 비활성화를 확인. [전용 결과](view-tests.tap).
- `TZ=UTC npm test`: 최초 sandbox 실행은 HTTP listen EPERM으로 13 실패·351 통과(`/tmp/ax-bean-icons-full.tap`). 로컬 서버 실행 허용 후 같은 명령 exit 0, 364/364 통과. [전체 결과](full-tests.tap).
- `npm run build:pages` 및 `npm run check:pages`: exit 0, 후보 `4527608c52d5`.
- `git diff --check`: 추적 중 구현·테스트 변경 exit 0. 전체 staged 검사에서는 RED TAP 원문의 공백 줄 4곳이 지적됐다. 원문은 보존하고 `git diff --cached --check -- . ':!docs/evidence/**'`로 구현·테스트·일반 문서의 공백을 검사했다(exit 0).

이번 변경은 로컬 구현·자동 검증 결과다. 실제 브라우저 시각 검사·iPhone 조작·Notion 쓰기·push·Pages 게시를 수행하지 않았다. 공개 버전은 기존 `f0eb42cdb763`이며 이 변경은 아직 반영되지 않았다.
