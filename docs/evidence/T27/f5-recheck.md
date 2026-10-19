> **최신 판정 — 2차 재검토 PASS (2026-10-19):** 아래 초기 P2 두 건은 수정 확인했다. 적용 범위는 F5 artifact 무결성 및 빌드 회귀이며 source 안전성/UI/lifecycle PASS가 아니다. 독립 42/42 통과. 초기 기록은 이력으로 보존하며 최신 근거는 문서 끝의 2차 재검토 절을 따른다.

# F5 부모 검사기 독립 재검토

2026-10-19. T16~T20 검토를 담당했던 critic의 후속 검토. **판정: 수정 필요. 기존 R3/F5 단일 변형은 차단됐으나 산출물 무결성 비교 우회 1건과 기존 테스트 회귀 1건이 남는다.** 추가 에이전트·제품 수정·모델/effort 설정 변경·429/502 재시도 없음. 현재 실행 모델/effort를 도구로 조회/설정할 수 없어 실제 sol/medium 적용을 별도로 확인했다고 주장하지 않는다.

## 지적

### [P2] F5-remaining: 산출물 내용으로 canonical 비교 여부를 결정하여 우회 가능

위치: `scripts/check-pages.mjs:205–211`.

`if (/skipWaiting|bean-pocket-update-v1/.test(worker))` 때문에 검증할 artifact가 비교를 수행할지 결정한다. 임시 정상 dist/sw.js에서 아래 세 변경을 함께 하면 canonical source와 다른 무조건 활성화 경로를 가진 산출물이 `checkPages()`를 통과한다.

```js
const changed = original
  .replaceAll('bean-pocket-update-v1', 'bean-pocket-update-v2')
  .replaceAll('self.skipWaiting', "self['skip' + 'Waiting']")
  + "\nself['skip' + 'Waiting']();\n";
```

artifact에는 guard가 찾는 두 literal이 모두 없어 canonical 비교가 실행되지 않는다. APP_FILES/cache namespace/버전은 그대로라 후속 검사도 통과한다. 독립 재현은 `assert.doesNotMatch(changed, /skipWaiting|bean-pocket-update-v1/)`로 진입 조건 소실을 확인하고, 실제 검사 결과 **true**를 관측했다. 이를 거부해야 한다는 assertion이 실패한다. 원본 pwa/sw.js는 수정하지 않았다.

요구사항 근거: 이번 F5 수정이 약속한 canonical SW 원문+빌드 버전 치환 대비 artifact 무결성. 검증 대상이 literal 변경으로 검증을 면제받으면 그 경계를 만족하지 못한다. PLAN T27의 무조건 skipWaiting 금지도 관련된다. source 자체의 안전성 증명을 요구하는 지적이 아니다.

수정 방향: canonical 비교 적용 여부를 artifact의 문자열에서 유추하지 말고 신뢰하는 배포 모드/원본으로 결정하여 production 검증을 fail-closed로 적용할 것. marker 동시 변경과 split computed call을 결합한 음성 검증도 필요하다.

### [P2] 기존 빌드 테스트가 새 오류 순서/문구로 실패

위치: `test/pwa-build.test.mjs:233–238`, `scripts/check-pages.mjs:208–209`.

scope 캐시 namespace 제거를 검증하는 기존 테스트가 `/scope|namespace|캐시/` 오류를 기대하지만 이제 canonical 비교가 먼저 `업데이트 Service Worker 산출물이 원본과 다릅니다.`를 던진다. `node --test test/pwa-build.test.mjs test/pwa-product-build.test.mjs`는 **종료 1, 13통과·1실패**다. 산출물이 부당하게 허용된 실패는 아니지만 필수 회귀 suite가 RED이므로 통과로 보고할 수 없다. 새 검증 순서를 반영하되 해당 mutation이 실제로 거부되는 assertion은 유지해야 한다.

## 확인된 수정과 제한

- 원래 R3(계산형 두 번째 호출)와 원래 F5(정상 한 호출을 handshake 밖으로 이동)는 **기존 원문 재현을 각각 이름 필터로 실행해 모두 거부 확인**했다. lifecycle 재현은 실행하지 않았다.
- 독립 4종 변형(계산형/호출 이동/alias/조건 제거)도 모두 canonical 원문 불일치로 거부됐다. 정상 artifact 원문 복구 후 통과하는 기존 product-build 테스트도 통과했다.
- checker 200–204행 주석은 canonical 비교를 artifact integrity로 명시하고 source-level protocol correctness를 별도 lifecycle 테스트/독립 검토로 분리한다. 이 구분은 적절하며 이번 보고서도 source 안전성 PASS를 선언하지 않는다.
- 모듈 공급·hash·캐시·필수 출력·symlink 대상 보존 추가 경계 23건은 통과했다. lifecycle/UI 구현은 변경 중이므로 그 코드의 안전성·완료 여부는 이번에 검토하지 않았다. 제품 전체 완료/merge/배포 승인이 아니다.

## 직접 실행 및 증거

1. `node --test test/pwa-build.test.mjs test/pwa-product-build.test.mjs` — **exit 1, 13 pass / 1 fail**. [원문](f5-t16-cont-build-tests.txt). product-build 자체 3개는 통과, namespace 검증 테스트 1개가 위 이유로 실패.
2. `node --test /tmp/critic-parent-build-extra.test.mjs` — **exit 0, 23 pass / 0 fail**. [원문 소스](f5-t16-cont-boundaries.mjs.txt), [TAP](f5-t16-cont-boundaries-green.txt).
3. `node --test /tmp/critic-f5-recheck.test.mjs` — **exit 1, 4 pass / 1 fail**. [원문 소스](f5-t16-cont-repro.mjs.txt), [TAP](f5-t16-cont-repro.txt). 마지막 1건이 marker-free artifact 비교 우회의 의도한 동작 부재로 실패했으며 import/환경 오류가 아니다.
4. `node --test --test-name-pattern='^R3: checker' /tmp/critic-t27-repro.test.mjs` — **exit 0, 선택한 기존 R3 1건 pass**. [TAP](f5-t16-cont-original-r3-green.txt), [기존 소스](critic-t16-cont-repro.mjs.txt).
5. 기존 [F5 원문 소스](critic-repro.mjs.txt)를 `/tmp/critic-f5-original-f5.test.mjs`로 복사하고 `node --test --test-name-pattern='^R6: checker' /tmp/critic-f5-original-f5.test.mjs` — **exit 0, 선택한 기존 R6/F5 1건 pass**. [TAP](f5-t16-cont-original-f5-green.txt).

부모 제공 `/tmp/bean-pocket-f5-red.txt`는 기존 product-build 2pass/1fail(Missing expected rejection), `/tmp/bean-pocket-f5-resume-green.txt`는 3pass/0fail인 원문을 확인했다. 이것을 이번 독립 전체 회귀 통과로 확대하지 않았다. 이번 재현은 모두 임시 dist를 사용했다. 제품 소스는 변경하지 않았고 synthetic 식별자/example URL만 사용했다. 원문 7개를 byte 대조해 보관했다. `.mjs.txt` 보관 파일은 기본 node --test에 추가되지 않으며 원래 /tmp 이름으로 복사해 실행할 수 있다. 절대 import는 해당 workspace 기준이다.

## 검토 대상 SHA-256

- `scripts/check-pages.mjs`: `869687bef290e1902f367045aeeccf5f8c3fd63a083eab4da69d62092852e0b8`
- `scripts/build-pages.mjs`: `cf6783c8d0b8657c499369fff4f009ed6e35d617d04abea8de8932fe52fef839`
- `test/pwa-product-build.test.mjs`: `be36e8e6131481dd22aa1d376b7b790134e5cb92402ff34e242d094287234c17`
- `test/pwa-build.test.mjs`: `a38284013f8a260a2b76dbd0bcf50b2da76880ee913a1af43411f0b050d9eea9`


---

## 2차 재검토 — 무조건 canonical 비교 적용: PASS

2026-10-19. 최신 `scripts/check-pages.mjs`, `test/pwa-build.test.mjs`, `test/pwa-product-build.test.mjs` 원문을 직접 확인했다. **앞선 P2 두 건 모두 수정 확인, 이번 F5 범위의 추가 actionable 지적 없음.** 제품 수정·추가 에이전트 생성·모델/effort 변경 없이 검토와 증거 갱신만 수행했다. 429/502 또는 재시도는 없었다.

### 수정 확인

- **marker-free artifact 우회 해결:** canonical 비교의 진입 조건이 완전히 제거됐다. namespace/버전 검사 이후 항상 원본 `pwa/sw.js`를 읽고 빌드 버전 치환 결과와 산출물 전체를 비교한다. 이전에 통과하던 protocol literal 변경 + split computed 호출 + 추가 무조건 호출 재현을 수정 없이 다시 실행한 결과, 이제 `업데이트 Service Worker 산출물이 원본과 다릅니다.`로 거부된다. 원래 R3/F5와 같은 계산형/호출 이동, alias, 조건 제거 재현도 모두 통과(거부 확인)했다.
- **기존 namespace 테스트 회귀 해결:** namespace/버전 검사가 canonical 비교보다 앞에 배치돼 namespace 제거 mutation이 기존 `/scope|namespace|캐시/` 오류로 거부된다. 기존 namespace 테스트가 통과했다.
- fixture의 SW가 독립 legacy 문자열 대신 canonical 원문을 읽도록 바뀌었다. legacy unconditional no-skip assertion은 실제 canonical source의 버전 치환 결과와 artifact 일치 assertion으로 교체됐다. 이것은 artifact 공급/변조 차단 검증이며 canonical source의 runtime 안전성을 증명하는 assertion으로 확대하지 않는다.
- 부모가 추가한 첫 blank 이후 source 본문 제거 + protocol literal 없음 + `self['skip' + 'Waiting']()` negative도 최신 product-build 테스트에 포함돼 실제 거부를 검증했다. fixture가 원본과 달라졌다는 assertion과 원문 복구 후 통과 assertion도 유지된다.

### 직접 실행

```text
node --test test/pwa-build.test.mjs test/pwa-product-build.test.mjs /tmp/critic-f5-recheck.test.mjs /tmp/critic-parent-build-extra.test.mjs
```

**종료 코드 0, 42개 통과·실패/건너뜀 0.** [전체 TAP 원문](f5-t16-cont-unconditional-green.txt).

- 기존 build/product-build 14개: namespace 회귀, parent 신규 obfuscated mutation, canonical fixture 검증 포함.
- [기존 독립 F5 재현 소스](f5-t16-cont-repro.mjs.txt) 5개: 이전 4pass/1fail에서 **5pass/0fail**로 전환. 소스 수정 없이 byte 일치 확인했다.
- [기존 독립 빌드 경계 소스](f5-t16-cont-boundaries.mjs.txt) 23개: **23pass/0fail**. 모듈 공급/hash/cache/필수 출력·source/output symlink 차단 및 대상 보존 회귀 없음. 소스 수정 없이 byte 일치 확인했다.

부모 제공 `/tmp/bean-pocket-f5-obfuscated-red.txt`의 Missing expected rejection(2pass/1fail)과 `/tmp/bean-pocket-f5-unconditional-green.txt`의 14pass도 원문 확인했다. 위 42pass는 별도로 직접 실행한 결과다. 추가 소스와 과거 RED 로그는 보존하고 새 TAP만 별도 이름으로 byte 대조해 추가했다.

### 판정 한계

F5 canonical 비교는 **artifact 무결성 검사이며 source 안전성 증명이 아니다.** 진행 중인 lifecycle/UI 구현과 전체 제품 완료는 검토하지 않았다. lifecycle 런타임, 실제 브라우저/기기와 전체 통합 판정은 후속 독립 검토 대상이다. `allowIncomplete:true`의 기존 빌드 정리용 동작을 release 검사 통과로 간주하지 않는다.

2차 재검토 대상 SHA-256:

- `scripts/check-pages.mjs`: `5c8261b58fccfac93ef501646b840f8b08f702ac5a0e07fa7259d826a8a7ff7d`
- `test/pwa-build.test.mjs`: `4c857b2e5673aa5d128f7d06588fb22ca4c9842a72a65a2b96e80b106c535916`
- `test/pwa-product-build.test.mjs`: `be36e8e6131481dd22aa1d376b7b790134e5cb92402ff34e242d094287234c17`
