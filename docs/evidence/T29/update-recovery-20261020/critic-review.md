# 업데이트 복구 변경 독립 critic 검토

2026-10-20. 기준 `eb53505`와 공유 작업 트리의 변경을 직접 비교했다. 역할은 critic이며 소스·테스트·기존 문서를 수정하지 않았다. 이 문서만 작성했고 commit/push/게시를 수행하지 않았다.

## 판정

**이번 변경의 소스 검토 PASS. 새로 도입된 것으로 확인된 P1/P2 결함과 릴리스 차단 지적 없음.** 아래 기존 API 경계와 검증 한계는 남는다. 이 판정은 T29 실제 iPhone·Pages·Notion 전체 완료 선언이 아니다.

## 직접 확인한 계약과 근거

- `PLAN.md` T27~29 및 `docs/pwa-contracts.md` 8절을 읽었다. 미저장 입력·pending·미해결 journal의 교체 보류, 모든 창의 동결·세대 확인, 앱 파일만 캐시, 연결 파일 유지, 무조건 skipWaiting/강제 새로고침 금지가 검토 기준이다.
- `pwa/sw.js:12`의 Request 목록은 기존 APP_FILES만 scope 기준 절대 URL로 변환하고 모든 항목에 `cache: 'reload'`를 지정한다. 기본 HTTP 캐시에서 구파일을 가져와 새 버전 캐시를 채우던 관찰 경로에 직접 대응한다. fetch 허용 목록·scope별 캐시 namespace·Notion 비캐시 정책은 그대로다. 캐시 모드 변경을 모든 배포/CDN 일관성 문제의 해결로 확대하지 않는다.
- `pwa/app.mjs`는 register 결과를 lifecycle에 넘기고 등록 실패는 undefined로 처리해 기존 getRegistration 경로를 사용한다. 설치 중 worker 관찰, 이미 installed인 worker 확인, waiting 우선 retry와 installed worker fallback을 확인했다. retry는 안전 적용 프로토콜을 다시 요청할 뿐 자체 활성화·문서 교체 권한이 아니다.
- `pwa/platform/app-lifecycle.mjs`의 startup/복귀 update 중복 제거, 실패 후 다음 복귀 재시도, visibilitychange/pageshow 중복 억제, pagehide 처리와 stop의 등록/설치 worker 리스너 해제를 확인했다. update 완료 뒤 started·generation 확인으로 정지된 세대의 설치 관찰 재연결을 막는다. retry 중 추가 알림은 retryRequested 루프로 처리한다.
- `pwa/platform/update-coordinator.mjs`와 SW의 prepare/lock/recheck/commit/activate/navigate 경로를 직접 읽었다. 이번 변경은 getState clean 확인·journal lock·모든 창 구성 확인·소유 worker 검증·ACK 뒤 동결 유지·정확한 generation abort를 우회하지 않는다. dirty/pending 창 또는 새 창 때문에 거절되는 retry가 곧 강제 적용으로 바뀌는 경로는 발견하지 못했다.
- `scripts/check-pages.mjs`는 reload Request 선언과 APP_REQUESTS 단일 addAll을 요구하면서 정확한 APP_FILES 목록, 임의 add/put 금지, 강제 업데이트 금지, 버전/scope namespace 및 SW 원본 전체 비교를 유지한다. 선언 정규식 하나만으로 보안을 보장한다고 보지 않았으며, 계산된 호출·별칭 변조를 막는 전체 원본 비교가 남아 있음을 확인했다.
- `test/pwa-build.test.mjs`는 각 scope의 모든 precache Request URL과 reload 모드를 확인하고 모드 제거를 거부한다. lifecycle VM fixture의 Request 주입은 새 브라우저 전역 의존성을 반영하며 기존 안전성 assertion을 삭제하지 않았다. 새 discovery 테스트는 등록 결과 인계, 설치 완료 retry, update 중복, 실패 복구와 stop 중 pending update를 다룬다.

## full 실패 fixture 재검토

초기 full 로그 `/tmp/ax-t29-update-full.log`의 361 pass/1 fail 원문을 읽었다. `test/pwa-product-build.test.mjs`의 마지막 공격 fixture가 구 APP_FILES addAll을 사용해, 의도한 SW 무결성 거부보다 새 HTTP 캐시 검사에서 먼저 실패했다.

최종 수정은 공격 fixture에도 reload Request 선언과 APP_REQUESTS addAll을 넣는다. 계산된 `self['skip' + 'Waiting']()` 공격, 다른 네 변조, 실제 변경 여부 assertion, `/업데이트|원본|skipWaiting/` 기대식 및 정상 산출물 통과 assertion을 보존한다. 오류 기대식을 넓혀 엉뚱한 거부를 통과시키는 수정이 아니므로 기존 검증 의도가 유지된다.

부모 실행의 최종 `/tmp/ax-t29-update-full-final.log`에서 tests 362/pass 362/fail 0/cancelled 0/skipped 0을 직접 확인했다. 명령은 부모 보고 기준 `TZ=UTC npm test`, 종료 0이다. critic이 같은 full suite를 중복 실행하지 않았다. 검토 파일에 대한 `git diff --check`는 critic이 실행했고 종료 0이었다.

## 기존 경계와 테스트의 한계

**P3 참고 — stop 완료 전 start 호출의 직렬화는 보장되지 않는다.** `pwa/platform/app-lifecycle.mjs:184`의 stop은 coordinator.stop을 await한 뒤 공유 coordinator/registration과 공통 리스너를 정리한다. 정지 promise를 기다리지 않고 start를 호출하면 이전 stop의 나머지 정리가 새 start의 controllerchange/visibility/pageshow/updatefound 리스너를 제거할 수 있다. 소스상 재현 순서는 `await lifecycle.start(reg); const stopping = lifecycle.stop(); const starting = lifecycle.start(reg); await Promise.all([stopping, starting]);`다. 이는 실행 재현 결과가 아니라 await 경계의 정적 추적이며, `eb53505`도 같은 공유 상태 정리 구조를 갖는다. 현재 `pwa/app.mjs`에는 stop 호출이 없어 이번 구화면 문제의 원인이나 새 회귀로 분류하지 않는다.

향후 해당 API 사용을 지원할 때 최소 조치는 stop/start 직렬화 또는 종료 세대가 소유한 상태·리스너만 정리하도록 제한하는 것이다. 테스트는 단순 stop 후 이벤트 무반응뿐 아니라 stop 미완료 중 재시작, 이전 getRegistration 지연 완료와 새 세대, 이전 update pending 중 재시작을 구분해야 한다. 현재 새 discovery 테스트는 stop 후 pending update 완료는 확인하지만 재시작 경계를 직접 검증하지 않는다. 이 참고는 현재 제품 경로의 차단 지적이 아니다.

## 브라우저 증거와 범위

- README와 `stale-shell-before.png`, `cache-fixed-ingress.png`를 직접 읽고 이미지를 확인했다. 구화면의 `111111111111` 표시와 캐시 수정 대조의 `222222222222` 표시는 관찰 내용에 부합한다. SW 상태·HTTP 요청/캐시 인과는 이미지 단독이 아니라 README 및 요청 기록과 구분해야 한다.
- 부모가 보고한 최종 native 두 창 QA는 localhost:4201, max-age=600, A `4fbcbf514c52` → 합성 B `fe1e2635a7bc`다. 첫 창 dirty/둘째 clean에서 둘째 창 reload로 업데이트 발견, 양 창 A·입력 보존, 취소 뒤 양 창 B 자동 전환·연결/합성 원두 유지·B 캐시만 존재가 PASS라는 보고를 받았다. 증거는 `full-candidate-dirty.png`, `full-candidate-after.png`, `full-candidate-requests.json`이다. critic이 그 브라우저 세션을 재실행한 결과로 보고하지 않는다.
- 부모가 일반 `4fbcbf514c52` 및 실험 `be8777914949` build/check PASS를 보고했다. 최종 추가 변경은 위 음성 fixture이며 런타임 소스는 변경하지 않았다는 보고와 최종 diff가 일치한다.
- 실제 iPhone Safari/홈 화면, 공개 Pages·실제 Notion, 셀룰러, 삭제·재설치 수명 및 pending 쓰기 중 실제 다중 창 업데이트는 이번 critic이 독립 실행하지 않았다. 기존 Node 안전성 회귀·부모 native QA를 해당 실기기 항목의 통과로 바꾸지 않는다.

추가 로컬 실행으로 확인해야 할 새 제품 경로 결함이 특정되지 않아 독립 재현 스크립트와 중복 테스트는 실행하지 않았다. 검토 결론은 소스 직접 확인, 보존된 RED/59 pass 근거, 부모 최종 full 로그 및 명시적으로 구분한 브라우저 보고에 기반한다.
