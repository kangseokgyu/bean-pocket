# 당겨서 새로고침 스피너 — 2026-10-21

텍스트 안내를 회색 12방향 스피너로 교체했다. 당기는 거리에 따라 스피너가 나타나고 화면이 내려온다. 충분히 당겼다가 놓으면 회전 상태를 그린 뒤 240ms 후 페이지 전체를 다시 로드한다. 되돌리거나 취소하면 화면이 원위치로 복귀한다. 동작 줄이기 설정에서는 회전·복귀 애니메이션을 생략한다.

- 선행 신규/변경 테스트: 5 통과·3 실패, 즉시 새로고침·스피너 부재·예약 중 보호 부재를 확인. `/tmp/ax-spinner-red.tap`.
- UI 관련 테스트: 31/31 통과. `/tmp/ax-spinner-focused.tap`.
- 최초 전체 테스트: 372 통과·3 실패. 기존 회귀 테스트의 간소화된 DOM에 style 객체가 없어 초기 스피너 생성 시 실패했다. 초기 각도는 표준 style 속성으로 지정하도록 보완했다. `/tmp/ax-spinner-full.tap`.
- 최종 `npm test`: exit 0, 375/375 통과. `/tmp/ax-spinner-final.tap`.
- `npm run build:pages`, `npm run check:pages`, `git diff --check`: exit 0. 후보 빌드 `90ca998fd496`. `/tmp/ax-spinner-build.log`, `/tmp/ax-spinner-check.log`.
- 로컬 브라우저 검증: 실제 빌드 모듈과 CSS를 임시 페이지에서 로드하고 버튼으로 합성 터치 이벤트를 발생시켜 당김·손 놓기를 확인했다. 손 놓기 상태에서 CSS animationName은 `pull-refresh-spin`, animationDuration은 `0.8s`였다. [화면](preview.png).

임시 미리보기는 회전 모습을 확인하기 위해 실제 페이지 이동을 수행하지 않고 예약 상태를 유지했다. 실제 탐색 호출과 예약 중 저장·동결 보호는 자동 테스트로 검증했다. Safari/iPhone 실기기의 물리적 스와이프와 배포는 수행하지 않았다.
