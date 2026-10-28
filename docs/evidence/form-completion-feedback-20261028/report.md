# 엔터티 작업 완료 토스트 제거

## 변경 요약

원두 추가·삭제, 레시피 저장·복사·삭제, 기록 저장·삭제가 성공했을 때 전역 `saved` 완료 토스트를 보내지 않는다. 버튼과 모달의 완료 표시는 유지한다. 저장·삭제 후 실행하는 `readLatest()`에는 요청 범위의 `suppressCompletion` 옵션을 전달해, 경로가 바뀐 경우 자동 재조회가 내던 `loaded` 완료 토스트도 억제한다([pwa/ui/controller.mjs:902](../../../pwa/ui/controller.mjs#L902), [pwa/ui/controller.mjs:339](../../../pwa/ui/controller.mjs#L339), [pwa/ui/controller.mjs:595](../../../pwa/ui/controller.mjs#L595)).

성공 시 기존 `saving` 진행 상태를 즉시 지운다. 뷰의 `clearStatus()`는 요청이 여전히 pending인 동안 기본 fallback 진행 문구가 다시 나타나지 않게 하고, 자동 재조회가 명시적으로 `loading`일 때는 조회 중 안내를 계속 표시한다([pwa/ui/view.mjs:238](../../../pwa/ui/view.mjs#L238), [pwa/ui/view.mjs:727](../../../pwa/ui/view.mjs#L727), [pwa/ui/view.mjs:806](../../../pwa/ui/view.mjs#L806)). 완료 토스트 억제는 자동 재조회 옵션에만 적용된다. 사용자가 직접 실행한 `refresh()`의 `loaded` 알림과 연결 성공 알림은 유지한다.

실패, `unknown`, `partial`, `saved-read-error`, `deleted-read-error` 안내 경로는 변경하지 않았다. 조회 실패가 발생하면 정상 완료 알림 대신 기존 복구 안내가 표시된다. 원격 Notion에는 쓰기 요청을 보내지 않았으며, 통합 테스트는 메모리 저장소와 fake Notion 응답기를 사용했다.

## 검증한 사용 흐름

| 흐름 | 확인 결과 |
| --- | --- |
| 원두 추가, 레시피 저장·복사, 기록 저장 | 전역 `saved` 완료 토스트 없음; 각 입력 모달은 기존 완료 버튼 상태 유지 |
| 기록·레시피·원두 삭제 | 전역 `saved` 완료 토스트 없음; 삭제 확인 모달의 완료 버튼 및 결과 문구 유지 |
| 자동 재조회가 다른 route로 전환되는 경우 | `loaded` 완료 토스트 없음; 사용자 요청이 아닌 재조회 완료만 억제 |
| 입력·삭제 모달 자동 또는 수동 닫기 | 완료 문구나 과거 `saving` 문구가 전역 토스트로 돌아오지 않음 |
| 저장/삭제 후 재조회 실패 | `saved-read-error`, `deleted-read-error` 안내 유지 |
| 사용자가 직접 새로고침 | `loading`과 `loaded` 안내 유지 |
| 연결 저장 | `connected` 안내 유지. 성공 경로를 전역 필터링하지 않음 |
| 기타 실패/불확실 결과 | 기존 `failed`, `unknown`, `partial` 및 검증 오류 표시 경로 유지 |

## 실행 결과

| 명령 | 결과 |
| --- | --- |
| RED: `node --test --test-name-pattern='successful entity writes keep inline|successful write refetch failures keep|inline entry and delete success stay|clearing successful operation progress|controller screen loading toast reaches the refresh' test/pwa-ui.integration.test.mjs test/pwa-ui.view.test.mjs` | exit 1. 성공 작업에서 `saved`와 자동 `loaded`가 발생했고, stale 진행 상태를 지울 API도 없어 실패했다. 일반 refresh와 모달 완료 UI 경계는 통과했다. |
| GREEN: targeted focused 테스트 재실행 (기존 controller public flow 포함) | 6/6 통과, exit 0. |
| `node --test test/pwa-ui.view.test.mjs test/pwa-ui.integration.test.mjs test/pwa-entity-delete.test.mjs test/pwa-bean-delete.test.mjs` | 172/172 통과, exit 0. |
| `npm test` (localhost 권한 사용) | 602/602 통과, exit 0. HTTP mock 테스트가 `127.0.0.1`에 서버를 열기 때문에 권한을 높여 실행했다. |
| `npm run build:pages` | 산출물 생성 완료 (`d53707aeb819`), exit 0. |
| `npm run check:pages` | Pages 산출물 검사 통과, exit 0. |
| `git diff --check` | 출력 없음, exit 0. |

명령별 원문 로그와 종료 코드는 이 폴더의 `*.log` 및 `*.exit`에 있다. [RED 로그](red-focused.log), [GREEN 로그](green-focused.log), [전체 테스트 로그](npm-test.log)를 확인할 수 있다. 수동 브라우저 시각 확인은 하지 않았다.
