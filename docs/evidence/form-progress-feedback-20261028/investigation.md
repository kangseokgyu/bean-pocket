# 폼 진행 피드백 중복 정리

## 구현 요약

PWA에서 활성 입력 또는 삭제 모달의 실제 제출 버튼이 `saving` spinner를 표시하고, 현재 상태가 `saving`일 때만 공유 진행 토스트를 숨긴다. `syncStatusToast()`의 조건은 `currentState.pending`, `statusType === 'saving'`, 열린 모달의 대응 버튼 상태를 모두 확인한다([pwa/ui/view.mjs:189](../../../pwa/ui/view.mjs#L189)).

적용 범위는 원두 추가, 레시피 저장·삭제, 기록 저장·삭제다. 레시피 복사는 `copy-recipe`에서 레시피 입력 폼을 열고 `submit('copy', ...)`로 저장하는 공통 경로이므로 같은 정책을 적용했다([pwa/ui/view.mjs:2153](../../../pwa/ui/view.mjs#L2153), [pwa/ui/view.mjs:2221](../../../pwa/ui/view.mjs#L2221), [pwa/ui/controller.mjs:892](../../../pwa/ui/controller.mjs#L892)).

성공, 실패, 검증 오류, `unknown`, `partial`, 저장 후 재조회 실패 상태는 새 숨김 조건에 포함되지 않는다. 저장 성공 토스트는 요청 종료로 `pending`이 해제된 뒤에도 남는 것을 테스트했다. 삭제 결과는 기존 삭제 확인 모달 피드백과 토스트 수명주기를 유지한다.

## 관련 동작과 경계

| 영역 | 현재 동작과 근거 | 조치 |
| --- | --- | --- |
| PWA 원두 추가·레시피 저장·기록 저장 | 컨트롤러 `submit()`은 저장 진행 토스트를 보내고([pwa/ui/controller.mjs:877](../../../pwa/ui/controller.mjs#L877)), 열린 입력 모달은 활성 제출 버튼에 spinner와 `aria-busy`를 설정한다([pwa/ui/view.mjs:511](../../../pwa/ui/view.mjs#L511)). | 공유 토스트의 `saving`만 숨긴다. 결과 상태는 그대로 표시한다. |
| PWA 레시피 복사 | 복사 동작이 새 레시피 입력 모달을 연 뒤 `submit('copy', ...)`를 호출한다([pwa/ui/view.mjs:2153](../../../pwa/ui/view.mjs#L2153), [pwa/ui/view.mjs:2221](../../../pwa/ui/view.mjs#L2221)). | 레시피 저장과 같은 모달·버튼이므로 포함한다. 별도 copy 전용 표시 정책을 추가하지 않았다. |
| PWA 원두·레시피·기록 삭제 | 삭제 확인 버튼이 동작 중 spinner를 표시하고([pwa/ui/view.mjs:667](../../../pwa/ui/view.mjs#L667)), 컨트롤러는 같은 요청에 `saving` 토스트를 보낸다([pwa/ui/controller.mjs:883](../../../pwa/ui/controller.mjs#L883)). | 삭제 확인 버튼이 실제 `saving` 상태일 때 중복 토스트를 숨긴다. 실패 안내와 `unknown`·`partial` 결과는 기존 삭제 모달 및 토스트 경로를 따른다([pwa/ui/view.mjs:609](../../../pwa/ui/view.mjs#L609), [pwa/ui/controller.mjs:917](../../../pwa/ui/controller.mjs#L917)). |
| PWA 연결 저장 | 연결은 진행 상태 `checking`과 “Notion 연결을 확인하고 있습니다.” 토스트를 사용한다([pwa/ui/controller.mjs:703](../../../pwa/ui/controller.mjs#L703)); 연결 버튼은 별도로 busy 상태가 된다. | `saving` 토스트만 대상으로 하므로 연결 검증 안내는 유지한다. 회귀 테스트에서 모달 안에 계속 보이는지 확인했다. 버튼 spinner와 checking 문구의 중복감은 별도 UX 판단 사항이며 이번 변경에서는 그대로 둔다. |
| PWA 화면 조회 | 화면 전환은 skeleton, `setRouteReadState('loading')`, `loading` 토스트를 사용한다([pwa/ui/controller.mjs:349](../../../pwa/ui/controller.mjs#L349), [pwa/ui/controller.mjs:354](../../../pwa/ui/controller.mjs#L354), [pwa/ui/view.mjs:225](../../../pwa/ui/view.mjs#L225)). 화면 골격과 진행 문구는 역할이 달라 보완적이다. | 조회 동작은 변경하지 않았다. 기존 화면 조회 회귀 테스트를 전체 테스트에서 실행했다. |
| 지연 보조 조회 | PWA는 기록의 관련 이름과 카드 통계 등 일부 데이터를 후속 조회하며 행 주변에 결과 상태를 둔다. 자세한 기존 근거는 [원두 삭제 조사 보고서](../bean-delete-feedback-20261028/investigation.md)에 기록돼 있다. | 저장·삭제 요청의 공유 `saving` 토스트와 대상·시점이 달라 이번 수정 대상이 아니다. |
| 기존 `public/` Node 앱 | PWA와 별도의 `public/app.js` 화면이다. 해당 앱의 원두 폼은 버튼 spinner를 사용하고 성공 후 알림을 띄우며([public/app.js:228](../../../public/app.js#L228), [public/app.js:298](../../../public/app.js#L298)), PWA의 `syncStatusToast()`를 사용하지 않는다. | 이번 변경은 PWA에 한정했다. public 앱의 별도 표시 정책이나 기능은 바꾸지 않았다. |
| 원두 수정 기능 | 현재 PWA 명령에는 원두 생성 `prepareBean()`과 삭제만 있고 수정 준비 경로가 없다([pwa/commands/index.mjs:190](../../../pwa/commands/index.mjs#L190), [pwa/commands/index.mjs:202](../../../pwa/commands/index.mjs#L202)). public 앱도 새 원두 입력을 제공한다. | 원두 수정 UI가 없어 수정 spinner 중복은 발생하지 않는다. 편집 기능은 이번 작업에서 추가하지 않았다. |

## 검증

| 명령 | 결과 |
| --- | --- |
| RED: `node --test --test-name-pattern='entry save spinners|recipe and record delete spinners|saving progress remains|connection modal protects' test/pwa-ui.view.test.mjs` | exit 1. 저장 모달과 레시피·기록 삭제의 중복 진행 표시 검사가 실패했고, spinner 없는 saving과 연결 checking 경계 검사는 통과했다. 의도한 동작 부재를 확인했다. |
| GREEN: `node --test --test-name-pattern='bean delete button spinner|recipe and record delete spinners|entry save spinners|saving progress remains|connection modal protects' test/pwa-ui.view.test.mjs` | 5/5 통과, exit 0. |
| `node --test test/pwa-ui.view.test.mjs test/pwa-ui.integration.test.mjs test/pwa-entity-delete.test.mjs test/pwa-bean-delete.test.mjs` | 168/168 통과, exit 0. |
| `npm test` (제한 실행) | exit 1. HTTP mock 테스트가 `127.0.0.1` 서버를 열 때 `listen EPERM`으로 막혔다. |
| `npm test` (localhost 권한으로 재실행) | 598/598 통과, exit 0. |
| `npm run build:pages` | 산출물 생성 완료, exit 0. |
| `npm run check:pages` | Pages 산출물 검사 통과, exit 0. |
| `git diff --check` | 출력 없음, exit 0. |

각 명령의 원문 로그와 종료 코드 파일은 이 폴더의 `*-*.log` 및 `*.exit`에 있다. 예를 들어 [전체 테스트 로그](npm-test-escalated.log), [RED 로그](red-focused.log), [GREEN 로그](green-focused.log)를 확인할 수 있다. 자동 브라우저 조작을 통한 수동 시각 확인은 수행하지 않았다.
