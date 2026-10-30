# 모바일 모달 여백과 스크롤

사용자 요청은 새 원두·레시피·추출기록 모달에 자연스러운 상단 여백을 주고, 열린 동안 배경 스크롤과 당겨 새로고침을 막으면서 모달 안쪽 스크롤과 하단 취소·저장을 유지하는 것이다.

모바일 입력·선택 모달은 안전영역 아래 20px에서 시작한다. 열린 dialog를 기준으로 배경 스크롤과 새로고침을 제어한다. 모달이 열리면 진행 중이거나 예약된 앱 새로고침을 취소한다. 모달 내부에서는 움직일 수 있는 방향의 스크롤을 허용하고, 경계와 배경에서의 세로 당김은 차단한다.

## 검증 결과

- Worker는 `gpt-6-luna / max`, Critic은 `gpt-6.1-sol / medium`으로 순차 수행했다.
- 수정 전 회귀 테스트로 열린 모달 중 당김, 진행 중 모달 열림·닫힘, 예약된 새로고침의 잘못된 실행을 재현했다.
- Critic이 같은 터치에서 방향을 바꿀 때 내부 스크롤이 막히는 오류를 추가 재현했다. Worker가 저장소 회귀 테스트를 먼저 추가해 실패를 확인하고 수정했다.
- 최종 `npm test`는 647/647 통과했다. `npm run build:pages`, `npm run check:pages`도 통과했다. 빌드는 `9365f1735c48`이다.
- Critic 재검토는 `PASS+NOTES`다. 독립 경계 재현 테스트 5/5가 통과했으며 추가로 입증된 회귀는 없다.
- Chrome 156, 390×844 실제 앱 연결 설정 모달과 확장한 긴 입력 fixture에서 상단 20px, 내부 스크롤, 배경 위치 유지, 닫은 뒤 위치 보존, 터치 경계와 방향 반전, 모달 중 당김 취소, 닫은 뒤 정상 새로고침을 확인했다.
- 세 종류 입력 모달은 미연결 상태에서 메뉴가 숨겨져 개별 실제 화면을 확인하지 못했다. 기존 입력 동작 테스트는 전체 테스트에 포함된다.
- 실제 iPhone Safari의 키보드·notch·브라우저 자체 당김 새로고침은 기기 미검증이다.

## 로컬 증거

아래 임시 경로는 이 작업 환경에서만 유효하다.

- 수정 전 실패는 `/private/tmp/mobile-dialog-regression-before.log`, `/private/tmp/mobile-dialog-direction-red.log`에 기록했다.
- 전체 테스트·빌드·검사는 `/private/tmp/mobile-dialog-final-npm-test.log`, `/private/tmp/mobile-dialog-final-build.log`, `/private/tmp/mobile-dialog-final-check-pages.log`에 기록했다.
- 실제 브라우저 결과와 화면은 `/private/tmp/mobile-dialog-app-scroll-final.log`, `/private/tmp/mobile-dialog-app-scroll-final.png`다.
- 독립 재검토 로그는 `/private/tmp/critic-modal-boundary-fixed.log`다.

`Experience First` 원칙으로 여백과 내부 스크롤을 우선했다. `Model the Domain` 원칙으로 별도 모달 플래그 대신 실제 열린 dialog를 기준으로 삼았다. `Prove It Works` 원칙으로 실패 재현과 실제 Chrome 제스처를 확인했다. Cursor 전용 도구는 사용할 수 없어 프로젝트 역할 정책의 Critic 검토와 Playwright로 대체했다.
