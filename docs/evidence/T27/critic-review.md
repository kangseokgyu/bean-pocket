# critic-2 — T27 lifecycle/SW 및 parent 빌드 독립 검토

2026-10-19. **판정: FAIL — T27 완료/배포 승인 불가.** 기존 테스트 통과와 별개로 동결 해제 누락, 무효화 뒤 활성화, generation 간 간섭 및 검사기 우회를 재현했다. 제품 코드 수정·커밋·추가 에이전트 생성은 하지 않았다. UI 구현과 실제 Notion/기기 검증은 이번 판정 범위 밖이다.

`critic-2`는 이번 세션의 업무상 역할명이다. 이 세션에는 자신의 모델/추론 설정을 조회하거나 변경하는 도구가 없어 요청된 sol/medium의 실제 적용을 확인했다고 보고하지 않는다. 기존 Socrates를 재시도하지 않았으며 에이전트 429는 발생하지 않았다.

## 검토 범위와 원문

- HEAD: `153167fd63ce2f757dfbf9c1c7e16c6b47a46898`. 미커밋 통합 작업 상태에서 검토했다.
- PLAN.md T27/T28, docs/pwa-contracts.md §4/§5/§8/검증 전략을 직접 읽고 대조했다. 기존 T16–T20 판정은 docs/evidence/T16/critic-review.md에서 확인했으며 그 판정을 확장하지 않았다.
- pwa/platform/app-lifecycle.mjs, update-coordinator.mjs, pwa/sw.js, scripts/build-pages.mjs, check-pages.mjs, test/pwa-build.test.mjs, pwa-product-build.test.mjs, pwa-flow.test.mjs, pwa-lifecycle.test.mjs, fixtures/pwa-environment.mjs를 직접 검토했다. journal/lock 판단의 근거로 실제 pwa/state/submission-state.mjs도 읽었다.
- pwa/app.mjs는 lifecycle 연결 여부만 확인했다. worker6의 UI/controller/view와 UI 요구사항은 검토·승인하지 않았다.

## 발견 사항

### F1 [P1] prepare 응답 지연/유실 시 해당 창에 abort가 전달되지 않아 동결이 남는다

위치: `pwa/sw.js:48–51,67–68`, `pwa/platform/update-coordinator.mjs:60–85`.

SW는 prepare ACK를 받은 뒤에만 client를 `prepared`에 추가한다. 입력 동결 뒤 OPFS/journal inspect가 느리거나 창이 일시 중단돼 5초 timeout에 걸리면 해당 client는 abort 대상에서 빠진다. 늦은 prepare 처리는 계속 진행해 clean ACK를 보내지만 SW 측 port는 이미 닫혔다. coordinator의 `timeoutMs`는 사용되지 않아 스스로 동결을 해제하지도 않는다.

**R1 재현:** inspect를 gate로 지연 → 실제 SW timeout callback 실행 → install 종료 → inspect 해제. 결과는 `{"frozen":true,"messages":["prepare"],"skipped":0}`. 응답 없는 창 검증은 기존 테스트에서 메시지를 아예 받지 않는 silent client만 사용해 이 상황을 놓친다. 사용자는 저장/입력을 할 수 없고, 추가 lifecycle 이벤트가 없으면 복구되지 않는다.

수정 요구: 요청을 보낸 모든 대상의 중단을 책임지고, 늦은 prepare 완료가 취소된 generation을 재생하지 못하게 해야 한다. 단순 동결 TTL만 추가해 SW가 낡은 ACK로 계속 활성화하는 형태도 피해야 한다.

### F2 [P1] 마지막 recheck 뒤 무효화가 SW에 전파되지 않아 dirty·잠금 해제 상태에서 활성화된다

위치: `pwa/sw.js:59–64`, `pwa/platform/update-coordinator.mjs:142–147`.

페이지의 dirty/pending 전환은 generation을 무효화하고 리더 lock과 입력 동결을 즉시 해제한다. SW에는 이 무효화를 알리는 경로가 없다. recheck ACK 뒤 비동기 `matchAll()` 동안 전환이 발생하면 멤버 ID는 같으므로 SW가 과거 ACK를 근거로 skipWaiting한다.

**R4 재현:** 세 번째 matchAll(최종 멤버 검사)에서 dirty로 변경하고 실제 `notifyStateChange()` 호출. skipWaiting 호출 시점은 `{"dirty":true,"frozen":false,"held":false}`, 호출 횟수는 **1**이었다. 새 dirty 감지 시 해당 generation을 중단한다는 계약 및 활성화까지 동결/배타 구역을 유지한다는 조건을 위반한다. 이는 UI가 dirty를 만들 수 있는지에 대한 판정이 아니라, 명세가 요구하는 무효화 경로 자체의 경쟁 재현이다.

수정 요구: 취소/commit 상태를 SW와 페이지 사이에서 조정해 ACK 뒤 무효화가 활성화와 경쟁하지 않게 해야 한다. 동일한 최종 recheck를 한 번 더 추가하는 것만으로는 다음 await 구간의 같은 경쟁을 해결하지 못한다.

### F3 [P1] 새 SW 활성화와 열린 앱의 새 버전 실행을 구분하지 않아 기존 앱 코드가 계속 남는다

위치: `pwa/platform/app-lifecycle.mjs:23–35`, `pwa/platform/update-coordinator.mjs:43–48`, `pwa/sw.js:118–125`.

activate는 동결/lock 해제만 하고, controllerchange는 waiting worker에 retry를 보내는 함수만 호출한다. 새 worker가 이미 active가 되면 waiting은 비어 있다. 이미 로드된 HTML/ES module을 새 버전으로 전환하는 navigation 또는 안전한 재초기화 경로가 없다. 따라서 열린 단일 페이지 앱은 계속 A 버전의 JS/UI를 실행할 수 있으며 새 cache B 생성과 skipWaiting만으로 PLAN의 “구버전이 무기한 남지 않는다”를 입증할 수 없다.

이 항목은 **소스 및 브라우저 수명 규칙에 따른 판단이며 실제 브라우저 A→B 실행 재현은 미실행**이다. skipWaiting과 navigation의 차이는 [Chrome 공식 수명 문서](https://developer.chrome.com/docs/workbox/service-worker-lifecycle#installation_2)에서 확인했다. 이 문서는 활성 worker 교체와 다음 navigation까지의 기존 문서/자원 혼용 가능성을 설명한다.

수정/검증 요구: dirty/pending/journal 및 모든 창의 동결 조건을 만족하는 안전한 전환 방식을 정하고, 알림/버튼이나 무조건 reload 없이 열린 창의 실제 실행 build가 A→B가 되는지 검증해야 한다. 현재 test/pwa-lifecycle.test.mjs는 skipWaiting spy의 횟수만 확인하며 activate를 테스트가 직접 호출한다. docs/evidence/T27/README.md도 실제 브라우저 미실행을 명시하며, T27 결과물인 두 버전 재현 절차/결과는 부족하다. 이 검토는 새 SW 자체가 활성화되지 않는다고 주장하는 것이 아니다.

### F4 [P2] generation 취소·중첩·activate가 격리되지 않는다

위치: `pwa/platform/update-coordinator.mjs:29–32,43–69,79–85,132–140`, `pwa/sw.js:122`.

- **R2:** async setFrozen(true)를 기다리는 동안 abort → abort ACK → setFrozen 완료. 취소 tombstone이 없어서 prepare가 generation을 다시 등록하고 **ok:true, frozen:true** ACK를 보낸다.
- **R3:** 같은 비동기 구간에서 stop() 완료 → setFrozen 완료. 이미 제거한 listener의 진행 중 handler가 동결을 다시 남긴다. stop은 진행 중 prepare를 취소/대기하지 않는다.
- **R7:** old prepare → new prepare → old abort → new recheck. 실제 입력은 **frozen:false**인데 new recheck는 **ok:true, frozen:true**로 ACK한다. 단일 boolean 동결과 generation별 map이 일치하지 않으며 새 generation을 독점하지도 않는다.
- **R5:** new generation의 prepare/leader lock 뒤 old generation activate가 오면 new lock과 동결도 풀린다. activate는 generation을 검사하지 않고 전부 해제한다. 실제 SW activate 메시지에도 generation이 없다.

정상 출처의 연속 worker 세대/늦은 메시지에 관한 문제다. 페이지가 임의로 SW를 사칭할 수 있다는 보안 취약점으로 보고하지 않는다. source 검사는 script URL을 비교하지만 동일 URL의 active/installing/waiting worker 인스턴스나 소유 generation은 구분하지 않는다. `safeApplyPromise`는 한 SW 전역 내 중복 실행만 막는다.

수정 요구: generation 소유권·취소 상태·진행 중 prepare를 명시적으로 관리하고, 낡은 abort/activate가 다른 세대의 동결을 풀거나 중단 후 작업을 재생하지 못하게 해야 한다.

### F5 [P2] checker의 skipWaiting 완화는 실제 호출 위치를 검증하지 않는다

위치: `scripts/check-pages.mjs:198–212`.

한 호출과 문자열/함수명 존재 여부만 확인한다. 실제 조건문 내부에 호출이 있는지 확인하지 않으므로 handshake가 무관해져도 릴리스 검사가 통과한다.

**R6 재현:** 임시 정상 산출물에서 handshake 내부 `await self.skipWaiting()`을 제거하고 파일 끝 전역에 `self.skipWaiting()` 하나를 추가했다. `checkPages()`는 **true**를 반환했고, 이를 거부해야 한다는 독립 assertion이 `Missing expected rejection`으로 실패했다. 기존 protocol/prepare/lock/recheck/sameClients/abort 문자열은 모두 남아 있다. 제품 소스는 변경하지 않았다.

이것은 현재 원본 SW에 무조건 skipWaiting이 있다는 주장이 아니라, 이번 완화가 “단일 protocol-controlled activation site만 허용”한다는 검사기 보장을 충족하지 못한다는 회귀다. 실제 빌드 산출물에서 handshake 밖 호출·조건 제거를 거부하는 negative 검증이 필요하다. 임의 소스를 모두 증명하는 완전한 정적 분석까지 요구하는 것은 아니다.

## 통과한 범위와 한계

- 배포 allowlist/build copy/hash/cache list에 commands, UI 두 모듈, lifecycle 두 모듈이 모두 포함된다. product-build 테스트가 원문 byte 보존·모듈별 변경 hash·외부 URL 거부를 검증한다. source/산출물의 file 및 module directory symlink 검사, canonical source/output overlap 방지는 유지된다. 별도 concrete 결함은 찾지 못했다.
- 현재 SW의 cache write는 APP_FILES addAll 하나이며 fetch는 GET·같은 origin·정확한 앱 URL만 처리한다. query/외부/API 요청 배제 및 scope별 캐시 삭제는 기존 집중 테스트에서 통과했다. Notion 응답을 cache.put 하는 경로는 없다.
- 모든 in-scope 창을 includeUncontrolled로 모으고, ACK의 protocol/type/generation/clean/frozen 및 두 차례 멤버 집합을 검사한다. 기존 두 창/외부 origin/멤버 증가 테스트는 통과한다. F2/F4 때문에 활성화 시점까지의 보장은 승인하지 않는다.
- 독립 C1은 **실제 createSubmissionState + OPFS/locks 주입 모의**를 사용했다. 정상·두 파일 모두 없는 최초 실행은 허용, processing/unknown/partial/connectionGuard·한쪽 파일 부재·손상은 차단한다. C2에서 외부 origin/이웃 scope SW prepare가 거부된다.
- 독립 C3은 실제 submission-state를 통해 리더의 shared lock adapter가 activation까지 유지되어 다른 state 인스턴스의 lock을 차단하고, activation 뒤 해제되는 정상 경로를 확인했다. **실제 브라우저 native Web Locks를 실행한 결과는 아니다.**
- pwa-flow의 세 테스트는 빌드된 commands/client/repository/state를 불러와 정상 생성→복사→반복 기록→외부 변경 재조회, 부분 생성 정리, 응답 유실·재실행 차단을 검증한다. UI·lifecycle/SW와 결합한 브라우저 전체 흐름으로 해석하지 않는다.

## 실제 실행 및 증거

| 실행 | 종료 코드 | 결과 | 증거 |
| --- | --- | --- | --- |
| `node --test test/pwa-build.test.mjs test/pwa-product-build.test.mjs test/pwa-flow.test.mjs test/pwa-lifecycle.test.mjs` | 0 | 29/29 PASS | [critic-focused-green.txt](critic-focused-green.txt) |
| `npm test` (sandbox) | 1 | 278 PASS / 13 FAIL, 전체 291; HTTP 13개 모두 loopback `listen EPERM` | [critic-all-sandbox.txt](critic-all-sandbox.txt) |
| `npm test` (loopback 허용) | 0 | **294/294 PASS** | [critic-all-green.txt](critic-all-green.txt) |
| `node --test /tmp/critic2-t27-repro.test.mjs` | 1 | **10개: 3 PASS / 7 FAIL**; R1–R7은 의도한 안전 assertion 실패, C1–C3 정상 대조군 통과 | [critic-repro-red.txt](critic-repro-red.txt) |
| 임시 디렉터리에서 `buildPages({ outputDir, includeProbes })` → `checkPages(outputDir, { includeProbes })`, false/true 각각 실행 | 0 | 일반·실험 빌드 및 검사 모두 PASS | [critic-build-green.txt](critic-build-green.txt) |

재현 원문: [critic-repro.mjs.txt](critic-repro.mjs.txt). `.txt`는 기본 npm test 자동 탐색에 포함하지 않기 위한 것이다. 재실행은 원문을 `/tmp/critic2-t27-repro.test.mjs`로 복사한 뒤 위 명령을 실행한다. 고정 synthetic ID/credential만 사용한다. R1은 시간 대기 대신 VM에 주입한 timer를 통해 **실제 SW timeout callback**을 실행하고, R2/R3/R4는 gate/최종 matchAll hook으로 순서를 결정해 재현한다. 테스트 종료 시 잔여 lock/freeze를 정리한다.

인계된 `/tmp/bean-pocket-in-progress-all.txt`의 291 PASS는 기존 증거로 확인했다. 독립 실행 도중 다른 작업자가 UI 통합 테스트 등을 추가해 전체 개수가 294가 됐다. 검토 대상 아래 12개 파일의 SHA-256은 시작/종료 때 동일했다. UI/README/index 등 병행 변경 때문에 전체 저장소가 불변 snapshot이었다고 주장하지 않는다. 마지막 재현 소스 변경은 대조군 테스트명 표현 정정이며 해당 최종 소스를 재실행한 로그를 보관했다. 재현 초기/확장 실행도 같은 핵심 실패를 냈으며 최종 로그는 10개 기준이다.

## 검토 대상 SHA-256

```text
ddfeca6bd381db7a4408fc14491aed62f1499d23ab6bd11d39f20acd01682b27  PLAN.md
5dbf81365ee80d76a2faf1165c4811c42d0fcaa8af39599afc4e6e36cf0d2d79  docs/pwa-contracts.md
ab5170748014521dedc277fc34326a8e3c0a2cc63b16e2bc4b596fd45d558e48  pwa/platform/app-lifecycle.mjs
e3711f8bfb4b5ac4d703d29ba81910e914ec9e9e2a94b9303f506b03649b24c7  pwa/platform/update-coordinator.mjs
afb83a59e4a9d696f7522d0d32e26088f7026545f1fba8a9459653a7007fe935  pwa/sw.js
cf6783c8d0b8657c499369fff4f009ed6e35d617d04abea8de8932fe52fef839  scripts/build-pages.mjs
3f07eff715831eb61a31e1afaf6d2132c56252e1abead66c1e8a1c28d5e8ecc7  scripts/check-pages.mjs
a14cb9bc6f65fb92120c95335f5f68dd7b1974c3aaf83f0e922ec54d0577962e  test/pwa-lifecycle.test.mjs
a38284013f8a260a2b76dbd0bcf50b2da76880ee913a1af43411f0b050d9eea9  test/pwa-build.test.mjs
5c8d88598b9ca5ed6547a922f5be48b73c7acdbf2212462f4b59bb9add6e5ab5  test/pwa-product-build.test.mjs
6af1502413489032f988ec5eda6346f24677d5a661237d260f3bbe7480ee2eb7  test/pwa-flow.test.mjs
7250348d2da5415a455a69ede55fc72a4d0f50370681838122c36c4bdeee6198  test/fixtures/pwa-environment.mjs
```

## 인계 및 재검토 조건

이번 세션이 저장한 파일은 이 보고서, critic-repro.mjs.txt, critic-repro-red.txt, critic-focused-green.txt, critic-all-sandbox.txt, critic-all-green.txt, critic-build-green.txt뿐이다. 기존 작업자의 변경을 포함하거나 되돌리지 않았다. T16–T20 command PASS 판정은 유지되며 이번 결함은 lifecycle/parent checker 범위다.

최종 사용자 인계: UI worker6도 429로 종료됐으며 대체 sol worker 승인은 pending이다. UI/product는 미완료 상태로 유지한다. 사용자가 전달한 일반/실험 빌드 PASS 및 전체 291 PASS는 화면 app-root 등 제품 완성을 뜻하지 않는다. 이 검토에서 별도로 관찰한 294 PASS 역시 실행 당시 테스트 집계일 뿐 UI 완성 증거가 아니다. 대체 worker 생성/재시도나 UI 수정은 수행하지 않았다.

F1–F5 수정 후 독립 재현의 안전 assertions 및 기존 집중/통합 검증을 다시 실행해야 한다. 실제 브라우저 두 버전·다중 창에서 적용 build 변경, dirty/pending·OPFS journal 차단, 지연/중단 후 해제와 native leader lock을 별도 검증해야 한다. UI 완료 후 추가 검토 요청을 기다리며 이번 보고서로 UI나 릴리스 전체를 승인하지 않는다.


---

## T16~T20 담당 critic의 후속 독립 검토 — 2026-10-19

부모 빌드 통합과 완료된 T27 SW/platform을 독립적으로 검토했다. **판정: 수정 필요 — P1 2건·P2 1건.** 기존 보고서를 발견하기 전에 아래 세 문제를 직접 재현했으며, 앞선 보고서와 증거는 덮어쓰지 않고 보존한다. 추가 에이전트 생성·모델/effort 설정 변경·제품 파일 수정은 하지 않았다. 자신의 실행 모델/effort를 조회·지정할 도구가 없어 sol/medium의 실제 적용을 별도로 확인했다고 주장하지 않는다.

### 이번 검토의 actionable 지적

1. **R1 [P1] 최종 clean ACK 뒤 무효화되어도 skipWaiting 실행.** `pwa/sw.js:59–64`, `pwa/platform/update-coordinator.mjs:142–148`. 마지막 recheck ACK 후 최종 matchAll이 끝나기 전에 dirty 전환과 notifyStateChange를 실행하면 generation이 무효화되고 lock/동결이 해제되지만 SW는 같은 창 ID만 확인한 뒤 skipWaiting을 호출한다. 재현 R1은 실제 T14 상태 모듈을 사용하며 적용 시 `skipCalls:1`, `dirty:true`, `frozen:false`를 관측한다. app-lifecycle의 retry도 진행 중 safeApplyPromise와 합쳐지며 generation 취소를 전파하지 않는다. docs/pwa-contracts.md §8(103행)의 dirty 시 generation 무효화·apply까지 동결/배타 구역 유지·apply 직전 유효 상태 재확인 위반이다. 페이지 무효화와 SW의 terminal apply/abort를 조정해야 하며 단순한 창 ID 재비교는 해결하지 못한다.

2. **R2 [P1] timeout/중단된 prepare가 창 동결을 남기거나 되살림.** `pwa/sw.js:48–51,68`, `pwa/platform/update-coordinator.mjs:60–85,132–140`. 정상 ACK를 받은 창만 prepared에 넣으므로 동결 후 journal 읽기 지연으로 timeout된 창은 abort에서 빠진다. 실제 T14 inspect를 지연해 재현한 R2 결과는 `skipCalls:0`, `messages:[prepare]`, `frozen:true`다. coordinator의 timeoutMs도 실제 만료에 사용되지 않는다. R2b에서는 setFrozen(true)가 await 중일 때 stop을 완료하고 callback을 진행하자 중단된 handler가 `ok:true` ACK를 보내며 frozen=true로 복귀한다. docs/pwa-contracts.md §8의 응답 없는 창 대기·중단 시 동결 해제·낡은 generation 재사용 금지를 어긴다. prepare를 시도한 모든 대상에 취소를 보내고, await 중인 prepare에도 cancellation tombstone/실행 세대 검사를 적용하며 stop 시 in-flight 정리를 보장해야 한다.

3. **R3 [P2] 검사기의 단일 활성화 호출 제한을 계산형 호출이 우회.** `scripts/check-pages.mjs:202–207`. 정상 handshake 코드에 `self['skipWaiting']();`를 추가하면 무조건 실행되는 두 번째 활성화 경로가 있어도 checkPages가 통과한다. `self.skipWaiting(`만 세기 때문이다. R3은 /tmp 빌드 SW에 한 줄을 추가해 `accepted`를 관측했다. PLAN T27의 무조건 skipWaiting 금지와 checker의 single protocol-controlled activation site 제한을 위반한다. 런타임 handshake 전체의 정적 증명이 아니라, 명시된 단일 호출 guard 자체의 누락이다. 허용 호출 외 참조를 거부하거나 실제 구문 기반으로 호출을 제한하고 computed/별칭 등의 음성 검증을 추가할 것.

### 이번 검토에서 직접 실행한 검증

- `node --test test/pwa-build.test.mjs test/pwa-product-build.test.mjs test/pwa-flow.test.mjs test/pwa-lifecycle.test.mjs` — **종료 0, 29통과·실패 0**. [원문](critic-t16-cont-existing-tests.txt). 빌드11 + product-build2 + dist 모듈 flow3 + lifecycle13이며 UI 화면 검증이 아니다.
- `node --test /tmp/critic-parent-build-extra.test.mjs` — **종료 0, 23통과·실패 0**. [원문 소스](critic-t16-cont-build-extra.mjs.txt), [TAP](critic-t16-cont-build-extra-green.txt). 5개 모듈 각각 byte 공급/동일 소스 hash 재현/변경 시 hash 변화/필수 출력/캐시 누락 차단(10건), source/output leaf symlink 차단과 대상 보존(10건), output directory symlink 차단과 대상 보존(3건).
- `node --test /tmp/critic-t27-repro.test.mjs` — **종료 1, 4개 assertion 실패(R1/R2/R3/R2b)**. [원문 소스](critic-t16-cont-repro.mjs.txt), [TAP](critic-t16-cont-repro-red.txt). 환경/import 오류가 아니라 위 요구 동작의 부재로 실패했다. 실제 SW 소스를 VM에서 실행하고 실제 coordinator/T14를 사용했으며 native OPFS/locks와 MessageChannel은 doubles다. R2는 VM에 주입한 타이머를 최대 20ms로 줄여 timeout 순서를 재현했다. 실제로 activate되지 않은 경우 테스트에서 activate를 가짜로 발생시키지 않았다.

모듈 commands/index, ui/controller, ui/view, platform/app-lifecycle, platform/update-coordinator가 모두 공급·hash·출력 허용 목록·APP_FILES/requiredCacheFiles에 반영됨을 확인했다. symlink 거부 시 원본/외부 대상 보존도 검증했다. 이 범위에서 R3 외 추가 actionable 빌드 결함은 찾지 못했다. PLAN T27·SPEC·docs/pwa-contracts 원문, 지정 빌드/fixture/flow/lifecycle 테스트와 실제 T14 상태 구현을 대조했다.

부모 제공 `/tmp/bean-pocket-in-progress-all.txt`의 291통과와 `/tmp/bean-pocket-flow-restart.txt`의 3통과는 원문을 확인한 기존 증거다. 전자는 이번 독립 전체-suite 재실행 결과가 아니다. 미완성 root/UI 제품 연결·화면과 실제 브라우저/Notion/iPhone 검증은 제외했고 제품 완료나 merge를 승인하지 않는다.

원문 재현/로그 5개를 byte 그대로 복사하고 대조했다. `.mjs.txt` 확장자는 자동 Node 테스트 탐색에 추가되지 않게 하기 위한 보관 형식이며 원래 /tmp 이름으로 복사하면 위 명령으로 실행할 수 있다. 절대 import 경로는 원문 그대로라 다른 checkout에서는 치환이 필요하다. synthetic fixture와 example.test만 사용하며 실제 토큰·실제 Notion 식별자·개인 응답은 없다.

이번 검토 대상 SHA-256:

- `scripts/build-pages.mjs`: `cf6783c8d0b8657c499369fff4f009ed6e35d617d04abea8de8932fe52fef839`
- `scripts/check-pages.mjs`: `3f07eff715831eb61a31e1afaf6d2132c56252e1abead66c1e8a1c28d5e8ecc7`
- `test/pwa-build.test.mjs`: `a38284013f8a260a2b76dbd0bcf50b2da76880ee913a1af43411f0b050d9eea9`
- `test/pwa-product-build.test.mjs`: `5c8d88598b9ca5ed6547a922f5be48b73c7acdbf2212462f4b59bb9add6e5ab5`
- `test/pwa-flow.test.mjs`: `6af1502413489032f988ec5eda6346f24677d5a661237d260f3bbe7480ee2eb7`
- `test/fixtures/pwa-environment.mjs`: `7250348d2da5415a455a69ede55fc72a4d0f50370681838122c36c4bdeee6198`
- `pwa/platform/app-lifecycle.mjs`: `ab5170748014521dedc277fc34326a8e3c0a2cc63b16e2bc4b596fd45d558e48`
- `pwa/platform/update-coordinator.mjs`: `e3711f8bfb4b5ac4d703d29ba81910e914ec9e9e2a94b9303f506b03649b24c7`
- `pwa/sw.js`: `afb83a59e4a9d696f7522d0d32e26088f7026545f1fba8a9459653a7007fe935`
- `test/pwa-lifecycle.test.mjs`: `a14cb9bc6f65fb92120c95335f5f68dd7b1974c3aaf83f0e922ec54d0577962e`
