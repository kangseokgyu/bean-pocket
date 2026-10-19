# T27 F1~F4 최종 독립 재검토

2026-10-19. T16~T20 담당 critic 후속 검토. **판정: 수정 필요 — 원래 7개 안전 재현은 통과했으나 추가 P1 1건(N1)이 남는다.** UI 범위는 제외했고 제품 수정·추가 에이전트 생성·모델/effort 설정 변경은 하지 않았다. 실행 모델/effort를 조회/설정할 도구가 없어 요청된 sol/medium 적용을 별도 확인했다고 보고하지 않는다.

## [P1] N1 — commit 뒤 worker 컨텍스트가 재시작되면 동결/공용 write lock이 복구되지 않음

- 위치: `pwa/sw.js:9–10,42–45,125–128`, `pwa/platform/update-coordinator.mjs:95–102,142–145`, `pwa/platform/app-lifecycle.mjs:28–31`.
- 현재 `activeAttempt`와 committed 증거는 SW 전역 메모리에만 있다. 정상 prepare→lock→commit→skipWaiting 뒤 동일 SW 코드를 새 실행 컨텍스트에서 activation 처리하면 activeAttempt가 없어 `transitionOpenApps()`가 즉시 반환한다. 반면 열린 페이지에는 committed 세션, 입력 동결과 leader Web Lock이 남는다. commit에서 page timer도 제거됐고, accepted 세션은 timer/stop으로 임의 해제하지 않는 정책이므로 worker가 명시적으로 복구하거나 abort하지 않으면 정리되지 않는다.
- 새 전역에서 retry로 새 generation을 시작해도 페이지의 기존 current 때문에 prepare가 거부된다. 새 worker는 **새 generation만 abort**하므로 이전 세션의 lock/동결은 계속 남는다. active가 된 B에는 lifecycle이 waiting에만 보내는 정상 retry도 도달하지 않는다. 결과적으로 정상 입력·저장과 후속 update가 모두 막히며 열린 A 문서도 유지될 수 있다.
- **독립 재현:** 실제 coordinator와 실제 T14 상태 모듈에 메모리 OPFS/native lock double을 연결한다. 첫 VM worker로 install/commit을 완료하고 페이지·등록된 ServiceWorker 객체 identity는 유지한 채 동일 제품 SW 원문을 두 번째 VM 전역에 다시 로드한다. 두 번째 전역으로 activate와 retry를 실행한다. 관측은 `frozen:true`, `blocked:true`, `navigations:0`, 새 전역 전송 메시지 `[prepare,abort]`다. 별도 T14 상태 인스턴스가 같은 native lock을 얻지 못함을 확인했다. 안전한 navigation 또는 기존 동결/lock 정리 중 하나가 필요하다는 assertion이 실패한다. 마지막 명시적 g1 abort는 테스트 자원 정리이며 제품의 자동 복구로 세지 않았다.
- 실행 결과는 Node/VM 재시작 시뮬레이션이며 실제 브라우저 worker 강제 종료 재현은 아니다. 다만 SW 전역 수명을 페이지 참조와 같게 볼 수 없다는 조건은 [W3C Service Worker Lifetime](https://www.w3.org/TR/service-workers/#service-worker-lifetime)에 명시돼 있다. 따라서 commit 정보를 가진 전역의 지속을 전제할 수 없다.
- 요구사항 근거: PLAN T27의 안전한 갱신과 구버전 무기한 잔류 방지, docs/pwa-contracts.md §8의 중단 시 동결 해제 및 다음 generation에서 유효 상태를 새로 수집한다는 계약. 불확실한 저장 journal은 차단을 유지해야 하지만 이번 재현에는 원격 쓰기나 미해결 저장 자체가 없다.
- 수정 방향: 재시작한 worker가 페이지에 남은 owner/generation/phase와 현재 registration·journal을 검증하고 기존 세션을 명시적으로 abort하거나 안전한 새 handshake로 인계할 복구 경로가 필요하다. 증거가 없다는 이유로 페이지의 공용 lock을 무기한 유지한 채 반환해서는 안 된다. 무조건 navigation이나 TTL만으로 ACK 이후 잠금을 조용히 풀라는 요구가 아니다.

## 원래 지적의 수정 확인

| 기존 항목 | 재검토 결과 |
|---|---|
| F1 / R1 prepare timeout | 접촉한 모든 client에 abort 전송, 늦은 prepare 정리. 기존 재현 통과 |
| F2 / R4 recheck 뒤 무효화 | prepare channel을 유지해 invalidate 전파, commit 단계 및 terminal 결정까지 동결/lock 유지. 기존 재현 및 commit 경쟁 회귀 통과 |
| F3 실제 실행 build 전환 | active B의 owner를 검증한 generation별 activate→navigate와 마지막 local clean 검증 구현. 기존 controller A를 가진 열린 창의 B 수신 및 조건부 navigation 테스트 통과. 부모 native 증거도 확인. 단 N1 복구 경계는 미해결 |
| F4 / R2·R3·R5·R7 | source 객체 identity·단일 current 세션·tombstone·freeze 직렬화·중단 후 정리/이전 generation 격리. 기존 재현 통과 |
| F5 / R6 | 원래 호출 이동 재현을 다시 거부 확인. 별도 F5 PASS를 source 안전성 전체 PASS로 확대하지 않음 |

### 기존 재현 fixture 조정의 범위

원래 [7개 안전 재현 원문](critic-repro.mjs.txt)의 안전 assertions는 유지했다. 최신 trusted(source)가 등록된 installing/waiting/active의 **동일 worker 객체**를 요구하므로 fixture의 getRegistration과 event.source에 안정적인 owner 객체를 넣었다. pending freeze를 stop/abort가 안전하게 기다리는 새 API에서는 gate를 해제하기 전에 stop을 끝까지 await하면 fixture 스스로 교착하므로 stop/abort promise를 먼저 시작하고 gate 해제 후 함께 기다리도록 순서만 조정했다. 테스트 정리는 관측값 저장 뒤 명시적 해당 generation abort로 수행하며 제품 결과로 계산하지 않는다. coordinator의 불필요한 10ms TTL 경쟁은 5000ms로 바꾸고 worker timeout 재현은 기존 수동 timer callback을 그대로 사용했다. 제품 파일은 변경하지 않았다.

## 직접 실행 결과와 원문

1. `node --test test/pwa-lifecycle.test.mjs test/pwa-lifecycle-regression.test.mjs` — **exit 0, 29 pass / 0 fail / 0 skipped**. 기존 13 + 수정 회귀 16. [TAP](final-t16-cont-focused-green.txt).
2. `node --test --test-name-pattern='^R[1-7]:' /tmp/critic-t27-original-seven-adapted.test.mjs` — **exit 0, 7 pass / 0 fail**. [조정된 재현 원문](final-t16-cont-original-seven.mjs.txt), [TAP](final-t16-cont-original-seven-green.txt). R6은 별도 F5를 포함한다.
3. `node --test /tmp/critic-t27-final-extra.test.mjs` — **exit 1, 0 pass / 1 assertion fail(N1)**. [재현 원문](final-t16-cont-extra.mjs.txt), [TAP](final-t16-cont-extra-red.txt). import/환경 오류가 아니라 실제 관측값과 요구 복구 동작의 차이로 실패했다.

실제 T14 모듈을 쓴 항목도 native API는 주입된 doubles이므로 실제 브라우저 Web Locks/OPFS 실증으로 보고하지 않는다. 전체 npm test나 미완성 UI 테스트는 이번에 실행하지 않았다. 증거 7개는 원문 byte를 복사·대조했다. `.mjs.txt`는 자동 Node 테스트 탐색 편입을 막기 위한 보관 형식이며 /tmp의 원래 파일명으로 복사하면 명시한 명령을 실행할 수 있다. 절대 import 경로는 현재 workspace 기준이다. 새 재현은 synthetic ID/credential/example.test만 사용하며 실제 Notion 데이터·식별자는 없다.

## 부모의 native 두 탭 A→B 증거 확인

직접 읽은 자료: [browser-harness.mjs](browser-harness.mjs), [browser-events.jsonl](browser-events.jsonl), [dirty A 화면](native-dirty-deferred.png), [실제 B 화면](native-build-b.png). 두 PNG도 직접 열어 확인했다.

harness는 실제 lifecycle/T14 모듈을 빌드 산출물에서 가져오되 합성 HTML/app 및 A/B 버전 레이블을 제공한다. 로그에는 같은 generation의 dirty=false/true 동결 시도 뒤 모두 해제, Clear 후 두 번의 safe-navigation B와 두 번의 loaded B가 기록되어 있다. 화면은 dirty=true일 때 A·frozen=false·입력 유지와, 이후 실제 Running build B·dirty=false·frozen=false·controls 활성 상태를 보여 준다. 이는 부모가 직접 수행한 두 탭 정상/dirty 보류 경로와 일치한다. 내가 CUA 브라우저를 재실행한 결과는 아니다. 이 자료는 worker 전역 재시작을 주입한 N1 경계를 검증하지 않는다.

실제 Notion 요청 0인 합성 harness이며 지정 iPhone 실기기나 전체 UI 제품 검증이 아니다. 동일 화면/로그에 명시적인 탭별 ID는 없으므로 두 탭 조작 자체는 부모가 제공한 관측으로 구분한다. 초기 README의 activate 해제/브라우저 미실행 설명은 옛 증거이고 현재 구현/부모 추가 실증의 최신 근거로 사용하지 않았다. 최종 인계 문서에는 commit/navigate·조건부 replace·중단 시 ACK 소유 유지라는 현재 정책을 반영할 필요가 있다.

## 시작·종료 소스 hash

[시작 원문](final-t16-cont-start-hashes.json), [종료 원문](final-t16-cont-end-hashes.json). **세 파일 모두 동일 — 검토 중 소스 변경 없음.** 변경이 감지되면 부모에게 알리고 달라진 소스에 기존 결과를 적용하지 않는 기준으로 확인했다.

| 파일 | 시작/종료 SHA-256 | 비교 |
|---|---|---|
| `pwa/platform/app-lifecycle.mjs` | `56db8dc5be9f4ab24b640b891d2e01dbb463235b418a50bb6d17c4548159440b` | 동일 |
| `pwa/platform/update-coordinator.mjs` | `cfb1313a7d6d4628d64ab4d38e59bdbf50714740ba0beece0df076c7081a272b` | 동일 |
| `pwa/sw.js` | `e4bd894a4ff33824b983344d6e7519fa80c928e7f5b395cfba4d0651dad95133` | 동일 |
