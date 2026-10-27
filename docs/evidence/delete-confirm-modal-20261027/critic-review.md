# Critic 독립 리뷰

- 판정: **Request changes — P2 필수 수정 1건**
- 대상: `codex/delete-confirm-modal`, `7c44df3a96f5cfcb63e2987490bf257fde807ce6`, 기준 `087288b`.
- 추가 에이전트, 구현 코드 수정, commit, 실제 Notion 삭제, 배포 없음. 이 문서만 대상 워크트리에 추가함.

## P2 — 결과 화면 닫기를 삭제 취소로 안내하지 말 것

- 위치: `pwa/ui/view.mjs:693–696` (Escape), `pwa/ui/view.mjs:2032–2033` (버튼).
- `showDeleteResult`는 `unknown`/`partial`/`succeeded`에서 취소 버튼을 ‘닫기’로 바꾸지만, 두 닫기 경로는 무조건 `view.showStatus({ type: 'cancelled', message: '삭제를 취소했습니다.' })`를 실행한다.
- 재현: 삭제 요청을 확정 → 결과를 `unknown` 또는 `partial`로 반환 → ‘확인 필요’ 상태에서 ‘닫기’ 클릭 또는 Escape. 실제 결과 확인이 필요한데 모달을 닫자마자 ‘삭제를 취소했습니다.’가 표시된다. `succeeded`에서도 자동 닫힘 전 ‘닫기’/Escape를 사용하면 같은 문제가 발생한다.
- 영향: 삭제 요청을 보내지 않은 취소와, 이미 보낸 삭제 요청의 결과 화면 닫기를 혼동시킨다. 불명 결과에서 원본 확인 안내를 취소 안내로 덮어쓰고, 이미 성공한 삭제가 취소된 것처럼 보인다. 기존 journal/관계 제한/중복 요청 차단의 우회는 확인하지 않았으나, 삭제 결과에 대한 사용자 안내의 정확성 요구를 충족하지 못한다.
- 수정 방향: 모달을 닫기 전에 요청/결과 상태를 확인하고, 실제로 요청을 보내기 전 취소한 경우에만 취소 안내를 표시한다. 결과 화면 닫기는 기존 성공/불명/실패 상태 메시지를 보존한다. 버튼과 Escape에 같은 규칙을 적용한다.
- 필요한 회귀 테스트: 요청 전 버튼/Escape 취소는 취소 안내 유지; `unknown`, `partial`, `succeeded` 결과 뒤 버튼/Escape 닫기에서는 취소 안내가 나오지 않고 결과 안내가 유지될 것. 특히 성공 후 목록 갱신 실패 안내를 닫기로 덮어쓰지 않을 것.

## 확인 범위와 근거

- 승인 시안 원문, production CSS/view/controller 변경분, 수정 테스트와 주변 요청·journal·관계 제한 경로를 직접 읽었다.
- 44px 버튼, 10px 간격, 140ms 전환과 기존 저장/취소 스타일 재사용, 초기 취소 포커스/복귀, pending 버튼 잠금, 안전한 `textContent` 이름 처리, 삭제 결과 callback을 확인했다. 삭제 commands/state/data 코드는 변경되지 않았다.
- Worker의 README, browser harness/results(28 checks), 데스크톱·모바일 캡처를 직접 확인했다. 브라우저 harness는 실제 view/CSS와 모의 submit을 사용하며, 실제 controller 통합을 전부 대체하는 증거는 아니다.
- Worker 증거에서 전체 579/579, build/check 통과, 빌드 버전 `deab17d2eea1`을 확인했다. 전체 검증은 재실행하지 않았다.
- 독립 실행: `node --test test/pwa-ui.view.test.mjs test/pwa-bean-delete.test.mjs test/pwa-entity-delete.test.mjs` — **137/137 통과**, 실패 0. 로그: `/tmp/delete-confirm-critic-focused.log`.
- 추가 재현은 `/tmp/delete-confirm-critic-7c44df3`의 외부 복사본에서만 수행했다. `node --test --test-name-pattern='critic: dismissing' /tmp/delete-confirm-critic-7c44df3/test/pwa-ui.view.test.mjs`에서 unknown/partial/succeeded × 버튼/Escape **6경로 모두** 모달 `open=false`, toast=`삭제를 취소했습니다.`를 출력했고, 이를 금지하는 assertion이 실패했다. 로그: `/tmp/delete-confirm-critic-dismiss.log`.
- 실험 준비 시 `lib/domain.mjs` 복사 누락으로 모듈 해석 오류가 1회 있었고, `lib`를 외부 복사본에 추가한 뒤 위 의미 있는 재현을 얻었다. 환경 오류를 기능 결함의 증거로 사용하지 않았다.
- 테스트 민감도 확인: 외부 복사본에서 submitDelete의 pending 조건을 1회 반전한 후 기존 `delete confirm locks duplicate` 테스트만 실행했다. aria-busy 기대값에서 실패하여 잘못된 요청 진입을 검출했다. 로그: `/tmp/delete-confirm-critic-mutation.log`. 원본 tracked 코드는 건드리지 않았다.
- 실브라우저 재실행, 실제 Notion 쓰기, 게시/공개 반영은 수행하지 않았다. 기존 28개 브라우저 체크는 Worker의 실행 근거로만 구분했다.

위 P2 수정 및 영향받는 회귀 검증 후 재검토가 필요하다.
