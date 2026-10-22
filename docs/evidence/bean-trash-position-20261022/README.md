# 휴지통 위치·회색 조정 — 2026-10-22

요청에 따라 원두 카드 휴지통을 기존보다 위·오른쪽으로 각각 8px 이동하고 아이콘을 회색 `#737373`으로 바꿨다. hover 배경·테두리도 중립 회색으로 통일했다. 46×46px 터치 영역을 유지한다. 변경 파일은 `pwa/styles.css`의 두 규칙이다.

단순 CSS 표시 변경이므로 주 에이전트가 직접 작업·검토했다. 새 동작 테스트를 추가하지 않고 실제 브라우저 스타일·위치 검사와 기존 회귀 테스트를 사용했다.

- `TZ=UTC npm test`: exit 0, 410/410 통과([원문](tests.tap)).
- `npm run build:pages`: exit 0, `7ad3862bddd7`([빌드](build.txt)).
- `npm run check:pages`: exit 0([검사](check.txt)).
- `git diff --check`: exit 0.
- 실제 Chrome(임시 프로필), 가짜 Notion·메모리 저장소와 실제 앱 어댑터: 320·390·768·1440px에서 버튼 위쪽이 카드 위쪽보다 2px 아래, `rgb(115, 115, 115)`, 46×46px, 제목 겹침·가로 넘침 없음. 확인 취소 무쓰기·정상 삭제·관계 데이터 삭제 차단·키보드 조작 통과, 콘솔 오류 0([결과](browser.json), [모바일](mobile.png)).
- 실제 Notion 쓰기와 iPhone/Safari 실기기 검증은 수행하지 않았다.

통합·게시 및 공개 파일 검증은 `deployment.md`에 기록한다.
