# T26 — 추출 기록

날짜와 정수 별점 1~5가 필수이고 컵노트·같은 원두 봉지 선택은 선택이다. 날짜 기본값은 Date의 기기 로컬 연/월/일을 조합한다. UTC 문자열을 날짜 입력 기본값으로 사용하지 않는다. 기록 상세는 저장 당시 조건·모든 단계를 유지하며 레시피별 평균·횟수를 분리한다.

- 기존 UI 확인: [원문](ui-test-green.txt), 종료 0, 20/20 통과. KST 자정 직후 날짜와 정상 UI 흐름을 확인했다.
- 부모 CUA 보고: 같은 날짜 1점·5점 기록, 평균 3.0/2회와 과거 93℃ 스냅샷 표시 확인.
- worker-9 critic 재현: [원본 테스트](critic-ui-repro.test.mjs)는 수정하지 않고 유지했다. 첫 재현은 [기록](worker9-initial-ui-repro.txt)에서 5개 실패·1개 통과였다. 별도 회귀 RED는 [기록](worker9-ui-red.txt)에 남겼다.
- worker-9 수정: 복구 확인 체크박스 전달, 연결 교체 중 활성·숨은 초안과 dirty 상태 보존, 양수 소수 입력, 부분 레시피를 saved로 확정하기 전 완전한 fresh projection 검증.
- worker-9 최종 전용 검증: `node --test docs/evidence/T26/critic-ui-repro.test.mjs test/pwa-ui.view.test.mjs test/pwa-connection.test.mjs test/pwa-ui.integration.test.mjs` 종료 0, 32/32 통과. [TAP 원문](worker9-ui-green.txt).
- worker-9 native 시작 경합 재현: 공유 native lock을 실제로 잡은 첫 UI controller가 검증 중일 때 두 번째 controller의 `initialize()`가 즉시 `lock-busy`로 실패했다. [RED 원문](worker9-init-lock-red.txt).
- worker-9 경합 수정: `initialize()`는 lock 획득 전 `lock-busy`만 6회(초기 1회와 최대 5회 대기 재시도, 총 대기 1.8초) 시도한다. callback 안에 진입한 뒤 발생한 오류나 Notion 요청은 재시도하지 않는다. 획득이 끝내 안 되면 generic 연결 오류·연결 재입력 대신 저장 연결 재조회 버튼을 보여 준다.
- worker-9 경합 검증: `node --test test/pwa-connection.test.mjs test/pwa-ui.view.test.mjs test/pwa-ui.integration.test.mjs` 종료 0, 31/31 통과. 공유 native lock 해제 후 두 번째 controller가 saved connection으로 ready되는 테스트와 재시도 소진·retry UI·callback 오류 단일 실행을 포함한다. [TAP 원문](worker9-init-lock-green.txt).
- 부모가 이어 수행할 항목: 최신 unknown 복구 케이스, 전체 suite/build, 통합 브라우저 QA와 critic 재검토. 여기서는 브라우저/build를 실행하지 않았다.
