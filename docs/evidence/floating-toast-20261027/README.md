# 떠 있는 토스트 — 2026-10-27

- 요청: 토스트가 버튼을 가리지 않도록 띄우고 3초 후 사라지게 한다.
- 변경: 폭 480px 이하의 둥근 알림과 그림자. 화면 하단 기본 160px 또는 실제 모달 버튼 행 위 16px 중 더 높은 위치에 표시한다. 창 크기·visual viewport·모달 스크롤 변경 시 위치를 갱신한다.
- 성공·입력 오류·복구 안내는 3초 후 숨긴다. 진행 중 작업은 완료될 때까지 상태 표시를 유지하고, 완료 후 3초를 계산한다. 알림의 ARIA 역할과 모달 내부 배치는 유지한다.
- TDD: 오류 자동 숨김 및 중앙 모달 위치 테스트의 의도한 실패를 확인했다 (`floating-toast-red.txt`, `floating-toast-geometry-red.txt`). 이후 화면 테스트 110개 통과.
- 브라우저: 격리된 Playwright Chromium(설치 Chrome)·WebKit, 320/390/768/1280 × 원두/연결 설정 16개 조합. 입력 오류를 버튼 클릭으로 발생시켜 토스트와 버튼 사각형 겹침 없음, 가로 넘침 없음, 자동 숨김 및 pageerror 없음 확인. JSON과 `mobile-toast.png` 참고. Chrome DevTools MCP는 제공되지 않아 Playwright로 대체했다.
- 검증 중 고정 160px만으로는 768px 중앙 모달에서 겹침이 재현되어 실제 버튼 위치 계산으로 보완했다. 최초 브라우저 harness의 bind 누락은 harness를 수정했다. 전체 테스트의 과거 T26 DOM 대역에서 style API가 없어 4개가 실패했으며, 기존 assertion을 유지한 채 대역에 실제 API를 보완했다.
- 리뷰: 요구사항, 타이머 교체/진행 중 상태, 모달·popover 배치, 레이아웃 변경 갱신, 입력 오류 ARIA를 확인했다. 새 의존성 및 외부 통신 변경 없음. `git diff --check` 통과.
- 빌드: `65ed4f2127b9`, `npm run build:pages`, `npm run check:pages` exit 0.
- 미검증: 실제 iPhone Safari/홈 화면, 소프트 키보드 동작, 스크린 리더 음성 및 실제 Notion 저장.
- 최종 전체 검증: `npm test` exit 0, 577/577 통과 (`test-summary.txt`).
- main 통합 후에도 `npm test` 577/577, 일반판 build/check exit 0. 게시 커밋 `e2980d717bc214c589db89971982383cbb2c6036`.
- 일반판(`probes=false`) 게시 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/40506259047
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/ — 빌드 `65ed4f2127b9`. 공개 정적 파일 20개 모두 로컬 산출물과 SHA-256 일치 (`floating-toast-public-files.json`).

## 공개 확인 중 발견한 복구 화면 보완

- 첫 게시의 Chromium 입력 오류 확인은 통과했지만, 공개 WebKit은 OPFS 초기화 실패로 복구 화면을 표시했다. 숨겨진 설정 폼의 높이 0인 행을 기준으로 위치를 계산하면 토스트가 화면 밖으로 나가는 문제를 발견했다.
- 숨겨진 행은 제외하고 현재 보이는 복구 버튼 위치를 사용하도록 보완했다. 회귀 테스트에서 `916px`와 기대값 `316px`의 차이로 의도한 실패를 확인했다 (`floating-toast-hidden-row-red.txt`).
- 보완 후 전체 테스트 577/577, build/check exit 0. 최종 제품 빌드 `c0384dd5a735` (`final-test-summary.txt`, `floating-toast-final-build.txt`, `floating-toast-final-check.txt`).
- 보완 후 브라우저 확인: Chromium·WebKit × 4개 너비 × 원두/연결 설정/복구 화면 24개 조합 모두 겹침 없음·자동 숨김·오류 없음 통과. 최종 JSON 3개 참고. WebKit의 실제 Notion 저장·OPFS 정상 초기화는 검증하지 못했다.
