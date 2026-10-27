# 토스트 위치 하향 — 2026-10-27

- 요청: 토스트를 조금 더 아래로 내린다.
- 변경: 기본 하단 여백 160→104px(56px 하향), 모달 버튼 행 위 간격 16→8px. 실제 버튼 위치와 safe-area를 반영하는 겹침 방지 및 3초 자동 숨김 유지.
- 테스트를 먼저 기대 위치로 변경하고 실패 2건 확인 (`lower-toast-red.txt`). 이후 전체 `npm test` 577/577, build/check exit 0. 빌드 `740da46df31a`.
- Chromium·WebKit × 320/390/768/1280px × 원두/연결 설정/복구 화면 총 24개 조합 모두 버튼 겹침 없음, 자동 숨김, 가로 넘침 및 pageerror 없음 확인. `browser.json`, `mobile-toast.png` 참고.
- 자체 리뷰: 변경은 위치 상수와 기대값에 한정. 버튼 보호·safe-area·타이머·ARIA 정책 유지. `git diff --check` 통과.
- 미검증: 실기기 iPhone, 소프트 키보드, 스크린 리더 음성, 실제 Notion 쓰기.
