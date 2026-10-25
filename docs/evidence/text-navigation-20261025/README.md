# 글자 메뉴와 헤더 아래 여백 — 2026-10-25

- 헤더 아래 목록 컨테이너까지 여백을 모바일 12px, 일반 화면 16px로 줄였다. 본문 상단 padding과 목록 패널의 중복 margin을 조정했다.
- 네 메뉴의 SVG와 아이콘 경로·스타일을 제거하고 글자만 표시한다. 배경은 투명, 테두리와 둥근 모서리는 없으며 활성 메뉴는 진한 글자와 밑줄로 표시한다. 네이티브 버튼 동작과 44px 클릭 높이, focus-visible, aria-current를 유지한다.
- 테스트 선행: 갱신한 `navigation uses text-only menus with accessible names`는 구현 전 `navigation contains text only`로 실패. 구현 후 `npm test` 452/452 통과(종료 0).
- `npm run build:pages`, `npm run check:pages`, `git diff --check` 통과(종료 0). 빌드 `c387ba2d5b7c`.
- Chrome / WebKit, 320·360·390·600·601·768·1024·1440px: 실제 간격 12/16px, 메뉴 배경 투명·border 0·아이콘 없음·활성 밑줄, 한 줄 정렬, 글자 포함, 가로 넘침 없음, sticky, 네 메뉴 전환·활성 상태, Tab 순서 및 Enter 전환, pageerror 없음 확인.
- 브라우저 검증 순서 보정: 키보드로 빈 추출 기록 화면에 이동한 뒤 스크롤을 시도하던 harness를 긴 원두 목록으로 돌아온 뒤 검사하도록 수정했다.
- 변경 검토: 선택 메뉴만 강조됨, 메뉴 외 버튼 스타일 유지, 더 이상 쓰이지 않는 아이콘 경로와 CSS 제거, 기존 상태 잠금 및 이벤트 처리는 유지됨을 확인했다. 의존성 추가 없음.
- 합성 데이터로 확인했으며 실제 iPhone·홈 화면 앱·사용자 Notion 연결은 미검증. browser-check.cjs는 프로젝트 루트에서 실행하며 Playwright 경로는 이 환경 기준이다.
