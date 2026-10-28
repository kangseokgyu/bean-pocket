# 토스트 1초 자동 숨김 — 2026-10-28

- 요청: 토스트가 1초 후 사라지도록 변경한다.
- 제품 변경: 공통 `STATUS_DISPLAY_MS`를 3000→1000ms로 조정했다. 로딩 중 유지·완료 체크 전환·위치·모션 줄이기 규칙을 유지한다.
- 기존 타이머 테스트를 먼저 999ms 표시/1000ms 숨김 기대값으로 갱신하고 의도한 실패 9건 확인 (`toast-one-second-red.txt`). 새 메시지의 전체 1초 표시·진행 중 유지도 기존 테스트로 검증한다.
- 전체 `npm test` 591/591, build/check exit 0. 빌드 `018df1b42789`. 자체 diff 리뷰 및 `git diff --check` 통과.
- 실제 controller를 사용하는 mock fixture에서 Chromium·WebKit × 화면 이동/새로고침 4개 조합으로 완료 체크와 약 1초 자동 숨김을 실측했다 (`toast-one-second-browser.json`). `node browser.cjs`는 로컬 정적 서버 4199, `--public`은 공개 UI·controller 파일을 사용한다. 실제 Notion 호출 없음.
- 미검증: 실기기 iPhone·키보드·스크린 리더 음성 및 실제 Notion 쓰기.
