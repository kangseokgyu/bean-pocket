# 삭제 확인 모달 검증

## 초기 구현 검증 이력

- `npm test`: 통과, 579/579 (`npm-test.txt`, `npm-test.exit-code.txt`)
- `npm run build:pages`: 통과, 빌드 버전 `deab17d2eea1` (`build-pages.txt`)
- `npm run check:pages`: 통과 (`check-pages.txt`)
- 초기 브라우저 확인: Playwright + Google Chrome, 28개 통과. critic 수정 후 최종 확인은 아래 결과를 참고.
- 데스크톱 캡처: 460px 모달, 44px 버튼, 10px 간격, 140ms transition. 모바일 390px/320px 가로 넘침 없음.
- 키보드·상태: 초기 취소 포커스, Enter 열기, Escape 취소/포커스 복귀, 트리거 삭제 후 포커스 대체, 중복 요청 방지, 진행 spinner, 성공 check, 실패 및 결과 불명 표시를 확인.
- 브라우저 콘솔 경고·오류와 외부 요청 없음. 캡처는 `desktop-*.png`, `mobile-dialog.png`.
- 공개 `public/` 및 PWA에서 native confirm 삭제 경로 검색 결과 없음. 서버판은 수정하지 않음.

## 테스트 우선 증거

- UI 회귀 테스트를 구현 전에 실행해 dialog 부재로 실패(exit 1): `red.test.txt`, `red.exit-code.txt`.
- 삭제 결과 controller 테스트를 구현 전에 실행해 결과 callback 부재로 실패(exit 1): `controller.red.test.txt`, `controller.red.exit-code.txt`.
- 구현 후 집중 테스트 통과(exit 0): `ui.green.test.txt`, `controller.green.test.txt` 및 종료 코드 파일.
- 브라우저에서 상태 토스트와 모달 겹침을 재현한 기록: `browser-toast.red.json`.

## Critic P2 회귀 수정

- `critic-review.md`의 요청에 따라 요청 전 취소와 결과 화면 닫기를 구분.
- 브라우저 증거는 로컬 Playwright/Chrome을 쓰는 수동 harness `browser-check.cjs`로 분리하고 `node docs/evidence/delete-confirm-modal-20261027/browser-check.cjs`로 확인. `npm test`의 `node --test` 설정은 그대로 유지.
- RED: `unknown`/`partial`/성공 후 조회 실패 × 버튼/Escape 6경로가 모두 취소 안내를 노출함 (`critic-dismiss.red.test.txt`, exit 1).
- GREEN: 동일 6경로 모두 기존 결과 안내를 유지하고, 요청 전 취소 버튼/Escape는 취소 안내를 유지 (`critic-dismiss.green.test.txt`, exit 0).
- 관련 UI/controller 삭제 suite: 144/144 통과 (`critic-focused.green.test.txt`).
- sandbox 기본 실행의 loopback `EPERM`은 원문 `critic-npm-test.txt`에 보존. 권한 적용 재실행과 rename 후 최종 결과는 아래 CI 확인에 기록.
- Playwright/Chrome 29개 확인 통과. Escape로 결과 화면을 닫은 뒤 불명 결과 안내가 남는 항목을 추가 확인. 결과·캡처는 `browser-results.json`, `desktop-*.png`, `mobile-dialog.png`; 실행 로그는 `critic-browser.log`.

## CI 이식성 확인

- Node 기본 `node --test` 발견 규칙과 분리하기 위해 로컬 Chrome 의존성이 있는 브라우저 harness를 `browser-check.cjs`로 이름을 바꿈.
- 최종 `npm test` 585/585 통과 (`critic-npm-test-portable.txt`, exit 0). 출력에 `browser-check.cjs`가 없어 자동 수집되지 않음을 확인.
- `browser-check.cjs` 수동 실행 29개 통과 (`critic-browser.log`, `browser-results.json`).
- 리네임 후 Pages build/check 통과, 버전 `16ec6cfaa391` (`critic-build-pages-portable.txt`, `critic-check-pages-portable.txt`).
