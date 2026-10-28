# 원두 삭제 진행 표시 조사

조사 기준: `pwa/`의 GitHub Pages PWA와 `public/`의 기존 Node 서버 앱을 구분해 소스 흐름을 확인했다. 변경은 PWA의 원두 삭제 진행 표시만 대상으로 했다.

## 수정한 동작

원두 삭제 확인 창은 제출 즉시 삭제 버튼을 `삭제 중…`·`aria-busy=true` 상태로 바꾸고 취소/중복 제출을 막는다(`pwa/ui/view.mjs:649-677`). 동시에 컨트롤러가 `saving` 상태를 보내고(`pwa/ui/controller.mjs:877-885`), 열린 모달 안에 전역 상태 토스트를 표시한다(`pwa/ui/view.mjs:168-205`). 이 두 표시는 같은 삭제 진행을 중복해서 알렸다.

`syncStatusToast()`에서 활성 동작이 원두 삭제이고 상태가 `saving`일 때만 전역 토스트를 숨긴다(`pwa/ui/view.mjs:189-197`). 버튼의 진행 표시와 잠금은 그대로 유지된다. 성공, 실패, `unknown`, `partial`, 삭제 후 재조회 실패는 다른 상태 타입과 모달 결과 영역을 사용하므로 숨김 조건에 걸리지 않는다(`pwa/ui/controller.mjs:896-936`, `pwa/ui/view.mjs:609-646`). 테스트는 원두 삭제 진행 토스트가 숨겨지고 버튼 spinner가 남는지, 실패 안내가 표시되는지 확인한다. 별도 경계 테스트는 레시피·기록 삭제 토스트가 그대로 표시되는지 확인한다.

## 주변 기능 조사와 권고

| 기능 | 관찰한 흐름 | 분류 및 권고 |
|---|---|---|
| PWA 원두 추가 | `submit()`이 전역 `저장 중입니다.` 상태를 표시한다(`controller.mjs:877-885`). 활성 입력 폼도 저장 버튼 spinner와 `aria-busy`를 표시한다(`view.mjs:506-525`). 원두 폼은 새 원두 입력으로 렌더링된다(`view.mjs:1478-1490`). | 진행 표시 중복. 사용자가 요청한 범위가 아니므로 변경하지 않았다. 추후 폼 저장과 동일한 기준으로 버튼 진행 표시를 남기고 전역 진행 토스트를 숨길지 검토할 수 있다. 성공/오류는 별도 결과 안내로 유지한다. |
| PWA 원두 수정 | 원두 상세는 이름·산지·추출 기록을 표시하고, 목록 카드는 삭제 동작을 제공한다(`view.mjs:1496-1516`, `1529-1547`). 명령은 원두 생성 `prepareBean()`과 원두 삭제만 제공한다(`pwa/commands/index.mjs:190-204`). 검색한 PWA 경로에 원두 수정 동작은 없다. | 현재 기능 없음. 원두 편집 중복 상태는 조사 대상 UI에서 발생하지 않는다. |
| PWA 원두 삭제 | 수정한 조건에서 진행 토스트만 숨기고 버튼 spinner는 유지한다. 성공·오류·불확실 결과는 `showStatus`와 삭제 확인 창의 `showDeleteResult` 경로가 처리한다(`controller.mjs:896-936`, `view.mjs:609-646`). | 이번 요청으로 진행 표시 중복만 해소. 최종 피드백 경로는 유지한다. |
| PWA 레시피·기록 삭제 | 동일 컨트롤러의 진행 토스트와 삭제 확인 버튼 spinner가 함께 표시된다. 구현 조건은 `delete-bean`만 대상으로 하며 해당 토스트는 유지된다. 회귀 테스트로 두 동작을 확인했다. | 같은 유형의 진행 표시 중복. 사용자가 현재 범위를 원두 삭제로 한정했으므로 수정하지 않았다. 추후 같은 정책을 적용할지 검토 권고. |
| PWA 레시피·기록 저장 및 레시피 복사 | `submit()`이 전역 저장 토스트를 띄우며, 열린 입력 모달도 제출 버튼 spinner와 busy 상태를 표시한다(`controller.mjs:877-885`, `view.mjs:506-525`). | 진행 표시 중복. 후속 UX 정리 후보. 복사도 컨트롤러에서 `submit('copy', …)`로 같은 경로를 탄다(`view.mjs:2205-2228`). |
| PWA 연결 저장 | 연결 모달의 버튼이 `연결 확인·저장 중…`과 spinner를 표시한다(`view.mjs:359-375`). 컨트롤러도 `Notion 연결을 확인하고 있습니다.` 상태를 표시한다(`controller.mjs:703-710`). | 진행 표시 중복. 연결 검증 문구가 별도 설명으로 유용한지 확인한 뒤 하나를 주 진행 표시로 정하는 것을 권고한다. |
| PWA 화면 전환 조회 | 현재 `loadRoute()`는 전환 중 `setRouteReadState('loading')`과 `loading` 상태를 보낸다(`controller.mjs:345-354`). 현재 뷰는 `.card-skeletons`를 표시하고 이전 data panel을 가리며 상태 토스트를 띄운다(`view.mjs:225-245`, `824-855`). 현재 회귀 테스트도 skeleton 표시와 이전 내용 숨김을 확인한다(`test/pwa-ui.view.test.mjs:2173-2200`). | 같은 조회의 피드백이지만 역할은 보완적이다. 카드 skeleton은 전환 레이아웃을 보여주고 토스트는 진행 문구와 접근성 상태를 제공한다. 5231ba9의 toast-only-loading 작업은 전체 화면 spinner overlay를 제거했으며 카드 skeleton은 남겨두었다. 시작 연결 확인의 이전 overlay와 화면 전환 skeleton을 같은 표시로 보지 않는 것이 정확하다. |
| PWA 지연 이름·기록 수 조회 | `startDeferredReads()`가 기록의 원두/레시피 이름과 원두별 기록 수를 백그라운드에서 채운다(`controller.mjs:387-455`). 뷰는 해당 기록이나 원두 카드 옆에 `확인 중`·조회 실패 문구를 표시한다(`view.mjs:1520-1524`, `1846-1881`). | 현재 실행 중인 행 단위 상태 표시이며 전역 작업 토스트와는 대상·시점이 다르다. 이전 기록이나 테스트 흔적만으로 보지 않는다. 일반 저장/삭제 진행 토스트와 중복되지 않아 수정 권고 대상은 아니다. |
| 기존 public Node 앱 | 별도 구현 `public/app.js`는 새 원두 입력과 POST 저장만 제공한다(`public/app.js:298-306`; `server.mjs:62-95`). 저장 중에는 폼의 submit 버튼만 spinner 상태이고, 성공 후 다이얼로그를 닫고 알림을 표시한다(`public/app.js:230-269`). 새로고침 중에는 새로고침 버튼 문구를 바꾸며 실패 때만 공용 알림을 표시한다(`public/app.js:53-69`, `127`). | PWA 수정은 public 앱에 적용되지 않는다. 소스에서 public 앱의 원두 편집·삭제 UI/API 경로는 찾지 못했다. 저장 spinner와 진행 토스트 중복도 현재 확인되지 않았다. |

### 삭제 완료·오류 안내 경로

삭제 결과에서는 컨트롤러가 `showStatus`와 `showDeleteResult` 양쪽에 성공·오류·`unknown`·`partial`·재조회 실패 문구를 전달한다(`controller.mjs:896-936`). 모달이 열린 pending 동안에는 상태 토스트가 모달 안으로 이동하고, `showDeleteResult()`가 별도 모달 피드백을 채운다(`view.mjs:199-204`, `609-646`). 작업 종료 때 `pending=false`가 되면 열린 삭제 모달 안의 상태 토스트는 숨겨지고, `deleteFeedback`가 남는다. 사용자가 결과 모달을 닫을 때 보관된 상태 문구가 다시 토스트로 나타난다(`view.mjs:189-205`, `785-797`, `560-579`). 따라서 두 전달 경로는 코드상 모두 호출되지만 완료 상태에서 같은 안내가 화면에 계속 중복 노출되지는 않는다.

이번 수정은 최종 결과 전달을 건드리지 않았다. 후속 정리를 한다면 삭제 모달을 결과 안내의 단일 owner로 두고, 닫을 때 토스트를 복원하는 동작을 한 경로에서 처리하는 방안을 검토할 수 있다. 변경 전에는 성공 자동 닫힘과 실패/불확실 결과 닫기 후 알림 보존을 함께 검증해야 한다.

## 적용 범위

README는 GitHub Pages PWA를 별도 앱으로 설명하고 기존 Node 서버 안내를 유지한다(`README.md:5-18`). 이번 수정은 `pwa/ui/view.mjs`에서만 이뤄졌으며, public 앱이나 원두 편집 기능을 추가하거나 변경하지 않았다. 주변 항목은 현재 코드 경로에서 확인한 권고이며 구현 범위에 포함하지 않았다.

## 검증 증거

| 실행 | 종료 코드 | 결과 |
|---|---:|---|
| focused RED: bean delete progress toast test | 1 | 기대한 재현 실패: 원두 삭제의 진행 토스트가 표시됨. `red.log` |
| focused GREEN: bean delete + recipe/record boundary tests | 0 | 2/2 통과. 원두 진행 토스트 숨김, recipe/record 진행 토스트 유지. `green-focused.log` |
| 4개 관련 테스트 파일 | 미확인 | 로그 요약은 166/166 통과, 실패 0건이다. `focused-regressions.log`; 이 실행의 종료 코드는 수집하지 못했다. 이후 전체 `npm test`가 596/596 통과, 종료 코드 0으로 동일 범위를 포함해 포괄 검증했다. |
| `npm test` 기본 실행 | 1 | 596개 중 581 통과, 15개 실패. 모두 HTTP 테스트의 loopback `listen EPERM`; `npm-test.log` |
| `npm test` loopback 허용 실행 | 0 | 596/596 통과. `npm-test-escalated.log` |
| `npm run build:pages` | 0 | 산출물 생성, build `7d1f02fd5075`. `build-pages.log` |
| `npm run check:pages` | 0 | Pages 산출물 검사 통과. `check-pages.log` |
| `git diff --check` | 0 | 공백 오류 없음. |

loopback 재실행은 승인된 실행 권한으로 수행했다. 외부 Notion 요청은 테스트 fixture를 사용하며 실제 원격 데이터를 변경하지 않았다.
