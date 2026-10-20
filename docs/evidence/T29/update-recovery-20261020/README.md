# T29 업데이트 구빌드 잔류 진단 — 2026-10-20

## 사용자 관찰

새 후보 `5fbe05186383` 게시 후 미저장 원두 이름이 유지됐지만 표시 빌드는 `d896ef120f57`였다. 입력 취소 후 확인 요청에도 같은 구빌드를 보고했다. 홈 화면 앱 완전 종료·재실행 후에도 같은 구빌드이며 설정 재입력 없는 연결·원두 목록 조회는 정상이라고 사용자 확인했다. 서비스 워커 실제 상태는 관찰하지 않았으므로 실기기 원인은 아직 확정하지 않는다. 앱 삭제·설정 초기화는 하지 않는다.

## 로컬 최소 재현

수정 전 `eb53505` dist를 합성 빌드 A `111111111111`, B `222222222222`로 나누고, 실제 Pages와 같은 `Cache-Control: max-age=600`으로 제공했다. 외부 Notion 요청은 로컬 합성 응답으로 대체하고 전용 localhost:4198 출처의 테스트 설정만 사용했다.

1. A에서 합성 설정 자동 연결·원두 입력.
2. 서버 B 전환 후 진단용 `registration.update()` 호출.
3. B 서비스 워커 캐시만 남고 active로 전환됨을 관찰.
4. 입력 취소·reload 뒤에도 화면 빌드 A 표시. 진단 화면에는 active/controller activated와 B 캐시만 존재.

새 SW가 기본 `cache.addAll(APP_FILES)`로 HTTP 캐시의 A 파일을 B 캐시에 채울 수 있음을 브라우저에서 재현했다. 최초 A 문서는 uncontrolled였으므로, 이 재현을 controlled dirty 업데이트 안전 통과로 판단하지 않는다.

- `stale-shell-before.png`: A 화면·B 캐시·active/controller 상태.
- `native-before-requests.json`: 실제 파일 요청 내역.
- `native-server.mjs.txt`: 사용한 합성 서버. `/tmp/ax-t29-native` A/B 산출물은 임시 파일.
- `sw-headers.txt`: 공개 서비스 워커 HTTP 캐시 헤더.
- 최초 sandbox 서버 실행 exit1: 로컬 listen EPERM. 승인 환경 재실행 후 정상.

## 에이전트

생성 도구에 실제 모델·추론값을 지정했다. 도구는 이름 인자가 없어 역할명은 업무상 호칭이다.

| 역할 | 실제 별칭 / ID | 생성 설정 |
|---|---|---|
| orchestrator | Lorentz / 01a1598d-127f-7d10-b142-c9a156867066 | gpt-6.1-sol / medium |
| worker | Euler / 01a1598e-42cf-77a2-ad93-9e690ddfb8fc | gpt-6-luna / max |
| critic | Rawls / 01a15998-9ef6-7052-b99d-6830fded88f2 | gpt-6.1-sol / medium |

worker가 진단·수정을 전담하며 부모는 독립적인 브라우저 재현·통합 검증·증거 정리를 담당한다. critic 독립 검토 PASS 및 수정 후 검증 결과는 아래에 기록했다.

## 공식 API 근거

[update()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update), [updatefound](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updatefound_event), [updateViaCache](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache). 공식 문서는 iPhone 실제 관찰을 대신하지 않는다.

## controlled 창 대조 재현

별도 localhost:4199에서 A 최초 실행 후 reload로 controller=activated를 확인했다. 이름 입력 → 서버 B 제공 → 진단 update() → waiting installed 및 입력 유지 확인 → 입력 취소 → 일시 동결 → 자동 문서 전환·입력 해제를 관찰했다. 최종 active/controller activated와 B 캐시 하나에도 화면 빌드는 A였다. 이 시나리오에서 안전 핸드셰이크는 동작했으나 새 캐시로 구화면이 유입됐다. `controlled-stale-shell-before.png`, `controlled-before-requests.json`.

## 캐시 수정만 적용한 구버전 진입 대조

localhost:4200에서 구 A 코드는 유지하고 B SW의 캐시 채우기만 `Request(..., {cache: 'reload'})`로 바꾼 합성 대조를 실행했다. A controlled 입력 → B waiting installed·입력 보존 → 입력 취소 → 강제 reload 없이 B 화면 `222222222222`로 전환·메뉴와 입력 활성·자동 연결 및 빈 합성 목록 조회를 확인했다. `cache-fixed-ingress.png`, `cache-fixed-ingress-requests.json`. 이는 최종 전체 수정판의 통합 검증과 구분한다.

## 최종 후보 native 두 창 검증

localhost:4201, 일반 후보 A `4fbcbf514c52`, HTML 주석만 추가한 합성 B `fe1e2635a7bc`. A는 제품 수정 전체를 포함하고 B는 검증 전용이며 게시 대상이 아니다. max-age600 조건과 로컬 합성 Notion 유지.

1. A에서 합성 원두를 저장한 뒤 reload, 연결·목록 유지 및 A controller 확인.
2. 첫 창에 미저장 이름 입력, 두 번째 clean 창 열기. 서버 B 전환 후 두 번째 창 reload. 이 단계에서 진단용 update 버튼은 사용하지 않았다.
3. B waiting installed·첫 창 입력 보존·양창 A 및 controls 활성 확인.
4. 첫 창 입력 취소 후 양창 B 자동 문서 전환, 연결·원두 목록 유지·입력 활성·B 캐시 하나 확인.

증거: `full-candidate-dirty.png`, `full-candidate-after.png`, `full-candidate-requests.json`. iPhone 실기기 결과를 대신하지 않는다.

## 통합 검증 중 발견한 테스트 불일치

첫 `TZ=UTC npm test` exit1: 361 통과/1 실패. `test/pwa-product-build.test.mjs`의 guard 제거 부정 fixture가 이전 cache.addAll(APP_FILES)를 써서 새 캐시 검사에서 먼저 실패했다. worker가 fixture를 새 APP_REQUESTS 형태로 맞춰 의도한 가드 제거 검증을 유지했다. `full-first.tap`. 최종 재실행 결과는 아래에 갱신한다.

일반판 build/check exit0 `4fbcbf514c52`, 실험판 build/check exit0 `be8777914949`. 최종 dist는 일반판이다.

최종 `TZ=UTC npm test` exit0: **362/362 통과**, 실패·취소 0. `full-final.tap`. `git diff --check -- pwa scripts test` exit0. 코드 변경 없이 부정 fixture만 수정한 뒤 실행한 결과다. 독립 critic 검토는 진행 중이다.

## 최종 독립 검토

[critic-review.md](critic-review.md): PASS, 새 P1/P2 및 릴리스 차단 지적 없음. 현재 제품에서 호출하지 않는 기존 stop/start 동시 호출 경계는 비차단 P3 참고로 기록했다. 현재 iPhone 빌드 잔류의 확정 원인으로 확대하지 않는다. 수정판 게시 후 실기기 재확인이 필요하다.
