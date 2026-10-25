# 왼쪽으로 모은 헤더 메뉴 — 2026-10-25

- 메뉴의 균등 grid 확장을 제거하고 내용 너비의 flex 배치로 변경했다. 로고 옆에서 왼쪽 정렬하며 설정 버튼은 오른쪽을 유지한다.
- 메뉴 글자 사이의 실제 간격은 모바일 6px, 일반 화면 12px. 기존 글자 메뉴·선택 밑줄·44px 높이와 sticky를 유지한다.
- 변경 전 브라우저 선행 검증은 `menu text stays closely spaced`로 실패했다(browser-red.txt).
- 최종 `npm test` 452/452, `npm run build:pages`, `npm run check:pages`, `git diff --check` 통과(모두 종료 0). 빌드 `2e69a19aaf62`.
- Chrome / WebKit, 320·360·390·600·601·768·1024·1440px: 글자 간격 6/12px, 메뉴 너비가 마지막 버튼에서 끝남, 로고 옆 정렬, 한 줄, 글자 포함, 가로 넘침 없음, 메뉴 전환·Tab/Enter·선택 표시·sticky·기존 본문 여백 확인. JS pageerror 없음.
- 검토: 헤더와 메뉴 영역에만 변경 적용, 연결 설정의 오른쪽 정렬 및 클릭 범위, 숨겨진 메뉴의 연결 전 배치, 선택 상태에 따른 글자 너비를 확인했다. 의존성·동작 변경 없음.
- 합성 데이터로 검증. 실제 iPhone·홈 화면 앱·사용자 Notion 연결은 미검증. browser-check.cjs는 프로젝트 루트에서 실행하며 Playwright 경로는 이 환경 기준이다.
