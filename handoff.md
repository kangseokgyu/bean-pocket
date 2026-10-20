최신 기능 게시(2026-10-21): 원두 추가 폼 기본 숨김·`+`로 열기·취소/저장 후 닫기·`↻` 새로고침. 커밋 `0350ebd`, 공개 빌드 `4527608c52d5`. Actions39516437386 전체364/364·배포 성공·HTTPS18개 일치. [게시 증거](docs/evidence/bean-tab-actions-20261021/deployment.md). 아래 T29/T30 최종 상태는 이전 릴리스의 확인 이력이며 이번 UI의 실기기 확인으로 확대하지 않는다.

최종 상태(2026-10-21): T29 지정 실기기 시나리오와 T30 기존 운영 연결·읽기를 사용자 보고 범위에서 확인 완료했다. 최신 공개 `64a9806`·빌드 `f0eb42cdb763`, 전체362/362·HTTPS18개 파일 일치. 사용·복구·게시 안내와 최종 인계를 갱신했다. 이후 과거 대기·미완료 표기는 당시 이력이다.

[최종 인계](docs/evidence/T30/README.md) · [사용 안내](docs/pwa-usage.md). 미커밋 문서 상태와 검증 범위는 최종 인계를 따른다.

## 이전 진행 기록 — 현재 할 일 아님

아래 대기·미완료·게시 승인 요청은 당시 상태다. 현재 판정과 확인 범위는 위 최종 인계를 따른다.

최신 관찰(2026-10-20): 후보 `47ab61dfe376` 게시 후 iPhone 복귀에서 `업데이트 보존 확인 2` 미저장 입력·기존 빌드 유지 사용자 보고. 다음은 입력 취소 후 새 빌드 자동 전환·연결/목록 유지 확인이다. 업데이트 안전 통과 판정은 후속 결과까지 보류한다.

최신 게시(2026-10-20): 안전 전환 확인용 주석 변경 `0831f3d`·일반 `47ab61dfe376` 게시 완료. Actions39437330924 전체362/362·배포성공·HTTPS18개 파일 일치. iPhone은 `4fbcbf514c52`에서 미저장 입력 준비 확인 상태이며, 백그라운드 복귀 후 입력·버전 관찰 및 취소 후 자동 전환 확인 대기다.

최신 사용자 확인(2026-10-20): iPhone 홈 화면 앱 재실행 후 수정판 `4fbcbf514c52` 표시, 설정 재입력 없는 자동 연결·기존 원두 목록 조회를 확인했다. 수정판 진입·연결 유지 통과. 다음은 수정판에서 다음 빌드로의 미저장 입력 보호·안전 전환 검증이다. 저장 중·다른 창 보호·최종 삭제/재설치 수명·T30은 대기다.

최신 게시(2026-10-20): 사용자 승인 후 업데이트 복구 수정판 `0a54c3e`·일반 `4fbcbf514c52` 게시 완료. Actions39436345642 전체362/362·배포 성공·HTTPS18개 파일 일치. 다음은 iPhone 홈 화면 앱 재실행 후 새 빌드·자동 연결·기존 목록 확인이다. 업데이트 안전·최종 파일 수명·T30은 미완료다.

최신 수정 검증(2026-10-20): 구빌드 잔류의 HTTP 캐시 재유입 경로를 브라우저에서 재현·수정했다. 일반 후보 `4fbcbf514c52`, 실험 `be8777914949`, 전체362/362·양빌드검사·두창 입력보류/자동전환 PASS. 독립검토 PASS, 수정판 커밋 `0a54c3e` 완료·게시 승인 대기. iPhone 업데이트 안전·최종 파일 수명·T30은 미완료다. [진단 증거](docs/evidence/T29/update-recovery-20261020/README.md).

최신 진단(2026-10-20): 입력 취소 후 확인 요청에 iPhone 빌드 `d896ef120f57` 유지 보고. 자동 전환 미관찰·업데이트 안전 미검증. 실행 시 SW 등록은 있으나 열린 앱 상태 변경 경로에는 명시적 업데이트 확인 호출이 없다. 다음은 앱 완전 종료·재실행 후 새 빌드 및 연결 확인이다.

최신 관찰(2026-10-20): 새 빌드 `5fbe05186383` 게시 후 iPhone에서 미저장 원두 이름 유지·구빌드 `d896ef120f57` 표시를 사용자 확인. 새 버전 감지·보류 판정은 미확정. 다음은 입력 취소 후 자동 전환 및 연결 유지 확인이다.

최신 게시(2026-10-20): 업데이트 안전 검증용 `eb53505`·빌드 `5fbe05186383`. HTML 주석 한 줄 변경. Actions 전체356/356·배포 성공·HTTPS18개 파일 후보 일치. iPhone 미저장 입력 유지 상태의 관찰 및 안전 전환 확인 대기.

최신 사용자 확인(2026-10-20): iPhone 홈 화면 앱 종료·재실행 후 빌드 `d896ef120f57`, 설정 재입력 없는 자동 연결 및 기존 원두·레시피·추출 기록 조회를 사용자 확인했다. 업데이트 후 연결 유지 항목은 사용자 보고 범위 통과다. 다음은 새 버전 전환 중 미저장 입력 보존·업데이트 보류 검증이며, 저장 중·다른 창 보호와 최종 삭제/재설치 수명은 대기다.

최신 사용자 확인(2026-10-20): 추출 기록별 봉지 이름 표시를 확인했다. 표시 항목은 사용자 보고 범위 통과다. 두 봉지 각각 선택·저장·재조회까지 확인했다고 확대하지 않는다. 다음은 iPhone의 최신 빌드 `d896ef120f57` 및 업데이트 후 자동 연결·기존 데이터 조회 확인이며, 업데이트 안전·최종 삭제/재설치 수명은 대기다.

최신 수정판 게시: `c2f8731`·일반판 `d896ef120f57`, 전체356/356·Pages 배포 성공·HTTPS18개 파일 후보 일치. 추출 기록 봉지 이름 표시 추가. 다음은 iPhone에서 새 빌드와 기록별 봉지 표시 확인이다.

# 최신 재개 상태 — 2026-10-20

최신 코드 `a72de0b`, 게시 빌드 `ec599a0811dc`. 기존 채팅에서 원두의 Notion 저장·봉지 추가·iPhone 시간 `:` 입력을 사용자 확인했다. 레시피 저장·재조회, 단계 시간·물 양 유지와 마지막 간격 40초도 사용자 확인했다. 복사본 온도 변경·원본 유지·원본 평균 3점/2회·복사본 0회도 사용자 확인했다. 원본 온도 변경 후 기존 기록 온도 보존·새 기록 변경 온도 반영도 사용자 확인했다. PC 종료·iPhone 셀룰러에서 재실행·조회·생성·복사·추출 기록 저장/재조회도 사용자 확인했다. PC에서도 iPhone 생성 데이터 전체 조회를 사용자 확인했다. 다음은 같은 원두의 봉지 2개 구분 확인이며 업데이트·최종 파일 수명은 대기다. T29 일부 확인, T30 대기. [재개 근거와 남은 범위](docs/evidence/T29/resume-20261020.md). 아래 이전 게시 버전과 전체 실기기 대기 표기는 당시 이력이다.

---

# 최신 게시 상태 — 2026-10-20

사용자 명시 승인 후 main 병합·push·일반판 Pages 게시 완료. 게시 커밋 `0ce1996`, 빌드 `4e7b1268f15d`. Actions 39347188137 성공, HTTPS 18개 파일 후보와 일치, 기존 탭 종료·재접속 후 PC 초기 화면 확인. UTC 날짜 테스트의 환경 의존만 수정했고 UTC 전체354/354 통과. [게시 증거](docs/evidence/T29/pages-deploy-20261020.md).

T29의 Notion·iPhone·셀룰러·파일 수명은 대기, T30 운영 연결도 대기다. 아래 게시 미실행·승인 대기 표기는 이전 이력이다.

---

# 작업 인수인계 — 최신 2026-10-20

이 절이 아래 과거 인계보다 우선한다. 브랜치 `codex/pages-first-implementation`, 최신 구현 커밋 **`9ab8f53`** (`feat(T21-T28): complete product UI and recover safe updates`). 아래 과거 미해결 UI 5건·T27 N1·추가 client 종료 P1과 동시 시작 잠금 경합을 수정하고 독립 재검토를 통과했다.

## 현재 판정

| 범위 | 상태·근거 |
|---|---|
| T21~T26 | 로컬 구현·UI 독립검토 PASS. 연결 복구 확인, 연결 교체 후 활성·숨은 초안/dirty 보존, 극소 양수, 불완전 saved 거부, 시작 경합 복구 포함 |
| T27 | 소스·Node/VM 독립검토 PASS. 기존/신규42개, 원래7개, N1원문1개, 추가 commit후client종료 원문1개 모두 통과 |
| T28 | 로컬 통합 통과. 전체 **354/354**, 일반 **4e7b1268f15d**, 실험 **4a0d23ec358e** 빌드/검사 exit0. native 실제제품 두문서 업데이트·초안보존·연결자동복구·잠금해제 확인 |
| T29 | 대기 — merge/게시 승인 및 실제 Pages·Notion·지정iPhone·PC종료셀룰러·최종연결파일수명 검증 필요 |
| T30 | 대기 — T29후 기존운영DB5개 읽기연결·최종인수인계 |

**제품배포·실기기 완료는 아니다.** merge·push·게시·실제 Notion 요청·운영변경은 실행하지 않았다. 과거native동결의 정확한 이벤트원인은 미확정으로 유지한다. 대응한 source경계와 최신native시나리오 통과를 소급원인확정으로 확대하지 않는다. native SW강제종료는 미실행이며 VM재시작 모의검증과 구분한다.

## 증거·검증

- [최종 통합 증거](docs/evidence/T28/resume-20261020/README.md), [전체354 TAP](docs/evidence/T28/resume-20261020/final-test-after-followups.txt), [최종양빌드/검사](docs/evidence/T28/resume-20261020/final-build-check.txt).
- [T27수정/추가회귀](docs/evidence/T27/resume-20261020.md), [독립재검토](docs/evidence/T27/resume-critic-recheck-executions.txt), [최종UI·빌드 독립검토](docs/evidence/T28/resume-20261020/critic-executions.txt).
- native제품 일반4e7b→HTML주석만 바꾼 합성B08bac8c084c9: 같은scope일반hash상세+390pxiframe, 숨은초안이 있으면 waiting보류/AX초안유지, 입력취소후 두문서B/ready/controls활성, nativeheld/pending없음. 연결파일 유지·반복평가 표시 확인. 합성B는 배포후보가 아니며 실제Notion데이터는 쓰지 않았다.
- 브라우저 unknown 복구: 생성503→fresh read실패시차단유지→정상조회후명시적해제. 부분레시피 saved거부→합성신규항목만보관취소후cancelled확인→재저장 성공. 연결교체초안보존과 정상생성/복사/반복평가는 최초후보4063에서 실행했고, 이후 변경은 시작경합/T27경계이며 최신전체·독립회귀가 통과했다.
- 전체stage공백검사에는 원문TAP/AX출력의 줄끝공백 경고가 있다. 증거원문은 보존하고 구현·문서는 `git diff --cached --check -- . ':!docs/evidence/**'`로 검증했다. runtime최종검증후코드변경은 없고 테스트파일끝 빈줄만 정리했다.

## 에이전트·재개

기존 orchestrator Euler/01a151fa-b3c0-7633-885c-123240c3b258(sol/medium), worker-8 Laplace/01a15435-732f-7023-a143-2816eb2df6c6 및 worker-9 Sagan/01a15435-73c9-7180-848a-c7ff81452aa4(luna/max)를 복원했다. 복원도구는 모델/effort 재지정·조회기능이 없어 이전생성기록을 설정근거로 삼았다. 기존critic복원은 과거usage오류를 반환해 새 critic Sagan/01a1563d-b97a-7462-9bab-29fbd9740a76를 **생성인자 sol/medium**으로 생성했다. 이름지정은 지원하지 않아 역할명은 업무상호칭이다. 지적된 추가P1·초기화경합은 동일담당worker가 수정하고 같은critic이 재검토했다.

다음은 사용자에게 구현/검증결과를 제시하고 **명시적 merge승인**을 받은 뒤 통합·게시, T29체크리스트를 진행하는 것이다. 게시승인도 별도로 확인한다. 운영DB임의시험쓰기·새DB생성 금지. T29통과전 T30운영연결을 수행하지 않는다.

로컬QA서버 source는 docs/evidence/T28/resume-20261020/browser-server.mjs.txt, 임시root는 /tmp/bean-pocket-browser-qa였다. main후보/candidate-resume은 합성검증전용이며 제품dist에는 QAboot·진단HTML·실험화면이 없다. 최종dist는 일반4e7b다. 서버·브라우저세션의 재사용가능성을 가정하지 말고 다시확인한다. 자동화는 생성하지 않았다.

---

# 이전 인계 기록 — 2026-10-20 07:11 기준

아래 미해결·미커밋 표기는 당시 상태다. 현재판정은 위 최신절을 따른다.

# 작업 인수인계

작성: 2026-10-20 07:11 KST 기준. 프로젝트: `/Users/kangseokgyu/workspace/AX-1day`.

**제품 구현·배포는 아직 완료되지 않았다.** 기본 테스트 통과와 별개로 업데이트 P1 미해결 항목, 실제 제품 화면의 동결 현상, UI 독립 검토의 실패 재현이 남아 있다. 사용자는 제한이 풀리면 이어서 진행하도록 요청했고, 마지막으로 이 인수인계 문서 작성을 요청했다.

## 1. Git와 보존 상태

- 브랜치: `codex/pages-first-implementation`.
- 마지막 커밋: `153167f` — `feat(T16-T20): add browser creation and copy commands`.
- 직전 커밋: `2ada45d` — T14/T15 검토·native 브라우저 증거 기록.
- `153167f`에는 T16~T20 명령, Notion preflight, 관련 테스트와 독립 검토 증거만 선별해 커밋했다.
- 이후 T21~T28 관련 변경은 **미커밋**이다. 이 파일도 아직 커밋하지 않았다.
- 이번 실행에서 main merge, push, Pages 게시, 실제 Notion 쓰기, 운영 DB 변경은 하지 않았다.
- 이전 기록상 실제 Pages는 시험판 B `0f0ea09f28a8`이다. 이번 인계 작성 시 원격을 다시 조회한 결과는 아니다.
- 작업별 새 브랜치 대신 기존 단일 브랜치를 유지한다는 앞선 사용자 지시를 따른다. 기존 미커밋 변경을 새 작업자가 임의로 되돌리거나 전부 완료된 변경으로 취급하지 않는다.

### 미커밋 변경 범위

| 범위 | 파일·디렉터리 |
|---|---|
| 화면 진입·표시 | `pwa/app.mjs`, `pwa/index.html`, `pwa/styles.css`, `pwa/ui/controller.mjs`, `pwa/ui/view.mjs` |
| 업데이트 | `pwa/platform/app-lifecycle.mjs`, `pwa/platform/update-coordinator.mjs`, `pwa/sw.js` |
| 빌드·검사 | `scripts/build-pages.mjs`, `scripts/check-pages.mjs`, `test/pwa-build.test.mjs`, `test/pwa-product-build.test.mjs` |
| 기능 검증 | `test/pwa-connection.test.mjs`, `test/pwa-ui.integration.test.mjs`, `test/pwa-ui.view.test.mjs`, `test/pwa-flow.test.mjs`, `test/pwa-lifecycle.test.mjs`, `test/pwa-lifecycle-regression.test.mjs`, `test/fixtures/pwa-environment.mjs` |
| 문서·증거 | `README.md`, `docs/implementation-status.md`, `docs/pwa-usage.md`, `docs/evidence/T21/`~`T29/`, 이 파일 |

`dist/`와 `.state/`는 Git 제외 대상이다. 소스·증거의 실제 최신 상태는 재개 시 `git status --short`와 변경분으로 확인한다.

## 2. 구현된 내용과 판정

| 작업 | 현재 상태 |
|---|---|
| T00~T15 | 이전 구현·검증 기록 유지. T04 세부 증거 대기와 기존 모듈 범위 완료를 구분한다. |
| T16~T20 | 명령 모듈 범위 완료·독립 검토 PASS·`153167f` 커밋. 원두/봉지/레시피 생성, 독립 복사, 기록·스냅샷 저장. |
| T21~T26 | UI 구현과 전용 테스트 완료 보고, 미커밋. 공개 정상 흐름은 부모 CUA로 확인했으나 **독립 검토 완료 아님**. 아래 UI 실패 재현을 먼저 처리해야 한다. |
| T27 | 기존 F1~F4의 원래 7개 재현은 통과. **추가 P1 N1 미해결**이며 실제 제품에서도 동결 잔류 관찰. 완료·배포 승인 불가. |
| F5 배포 검사기 | 독립 재검토 PASS, 관련 42개 검증 통과. artifact 무결성 검사에 한정하며 SW source 안전성 전체 PASS가 아니다. |
| T28 | dist 명령 통합과 브라우저 정상 흐름 일부 확인. 실패·복구·최종 업데이트 통합 검증과 최종 독립 검토 미완료. |
| T29~T30 | 실제 Pages/Notion/iPhone/셀룰러/최종 파일 수명 검증 및 운영 연결 대기. 안내·체크리스트 초안만 작성. |

명세와 소유 경계: [PLAN](PLAN.md), [SPEC](SPEC.md), [브라우저 계약](docs/pwa-contracts.md). 원산지·농장은 기존 `origin`/Notion `원산지·농장` 속성을 공유하며 스키마를 변경하지 않았다.

## 3. 우선 해결할 문제

### P1 — N1: SW 실행 컨텍스트 재시작 뒤 동결·공용 잠금 복구 누락

최신 독립 판정은 [T27 최종 재검토](docs/evidence/T27/final-recheck.md)다. 원래 7개 안전 재현은 통과했으나 추가 N1 assertion이 실패했다.

- `activeAttempt`와 commit 증거가 SW 전역 메모리에만 있다.
- commit 뒤 새 SW 전역에서 activate를 처리하면 기존 generation을 인계하거나 abort하지 않고 반환할 수 있다.
- 페이지에는 committed 세션·입력 동결·leader Web Lock이 남고, 새 generation은 기존 current 때문에 거절된다. waiting에만 보내는 retry도 이미 active가 된 SW 복구에 충분하지 않다.
- 재시작한 worker가 페이지의 소유 세대·단계와 registration/journal을 확인하고 명시적으로 안전한 인계 또는 중단을 완료해야 한다. 단순 TTL로 ACK 후 잠금을 몰래 풀거나 무조건 navigation하지 않는다.

증거: [추가 재현 원문](docs/evidence/T27/final-t16-cont-extra.mjs.txt), [실패 TAP](docs/evidence/T27/final-t16-cont-extra-red.txt), [기존 7개 재현 통과](docs/evidence/T27/final-t16-cont-original-seven-green.txt). N1은 Node/VM 재시작 시뮬레이션이며 실제 브라우저 강제 종료 재현은 아니다.

### 실제 제품에서 관찰한 동결 잔류

부모 CUA에서 별도 관찰했으며 **N1과 같은 원인인지 아직 확정하지 않았다.**

1. 임시 서버 `http://127.0.0.1:4196/candidate/`에서 제품 UI `d36ddd495b92` 실행. native OPFS에는 합성 연결·journal이 있었고, 일반 탭과 390px iframe 두 client가 같은 scope에 열려 있었다.
2. 서버 파일을 후보 `d0bd21da2ea0`으로 교체하고 일반 탭을 재실행했다. 새 빌드·정상 조회 결과를 확인했다.
3. 이후 원두 화면으로 이동하려 하자 두 client의 버튼이 모두 disabled 상태가 됐다. 20초 이상 후에도 DOM에서 `.app-content.dataset.frozen === 'true'`, 상태 문구는 `최신 목록을 불러왔습니다.`, 일반 탭 disabled 버튼 11개였다.
4. 당시 mock backend의 다음 create만 503으로 응답하도록 설정했지만, 이 현상 전에 새 create 요청은 보내지 않았다. 저장 오류나 실제 Notion 장애라고 단정하지 않는다.

증거: [제품 동결 화면](docs/evidence/T27/native-product-frozen.png). 담당 worker에 진단·수정을 인계한 직후 사용량 제한으로 중단됐다. 새 worker가 이 브라우저 조건과 N1을 함께 재현하고 원인을 구분해야 한다.

### UI 독립 검토: 최종 보고 전 중단, 실패 재현 보존

critic-3가 사용량 제한으로 최종 보고를 완료하지 못했다. [재현 원문](docs/evidence/T26/critic-ui-repro.test.mjs)과 [결과](docs/evidence/T26/critic-ui-repro.txt)는 **6개 중 1개 통과·5개 실패**다. 아래는 테스트가 지적하는 경계이며, 재개 시 fixture 타당성과 제품 원인을 독립적으로 확인한다.

- 연결 복구 확인 checkbox가 `confirmCurrent` 호출까지 이어지는지.
- 토큰 교체 성공 시 작성 중인 제품 폼을 보존하는지.
- 교체 후 숨겨진 초안도 dirty 상태로 남아 업데이트를 막는지.
- 도메인이 허용하는 `0.01` 미만 양수가 HTML `min` 때문에 거부되는지.
- 불완전한 partial 레시피를 `saved`로 확인해 성공 처리할 수 있는지.
- 대조군: fresh read 실패 시 unknown journal 잠금 유지 테스트는 통과했다.

이 재현 파일은 `.test.mjs`이므로 기본 `node --test` 탐색에 포함될 수 있다. 아래 과거 324개 통과를 현재 전체 테스트 결과로 재사용하지 않는다. 의도한 실패를 숨기기 위해 파일을 제외하지 말고, 요구사항을 확인해 회귀 테스트로 정리한 뒤 수정한다.

## 4. 검증 결과와 적용 범위

| 실행·관찰 | 결과 | 근거·주의 |
|---|---|---|
| T16~T20 관련 테스트 | 152 통과, 명령 독립 PASS | [T16](docs/evidence/T16/README.md) |
| T27 전용 테스트 | 29 통과: 기존 13 + 회귀 16 | [구현 재검증](docs/evidence/T27/implementation-recheck.md). N1 재현과 별도. |
| 기존 T27 독립 재현 R1~R7 | 7 통과 | [최종 재검토](docs/evidence/T27/final-recheck.md) |
| T27 신규 N1 | 1 assertion 실패 | 위 P1, 미해결 |
| F5 독립 빌드·변조·경계 검증 | 42 통과 | [F5 PASS](docs/evidence/T27/f5-recheck.md) |
| 최신 UI 전용 테스트 | 21 통과, 종료 0 | [원문](docs/evidence/T26/ui-test-green.txt). 일부 README의 20개 표기는 이전 집계. |
| UI critic 기존 테스트 | 21 통과 | [원문](docs/evidence/T26/critic-ui-tests.txt) |
| UI critic 추가 재현 | 1 통과·5 실패 | 미완성 검토, 위 문제 확인 필요 |
| 부모 전체 `npm test` | 당시 324 통과, 종료 0 | [스냅샷 원문](docs/evidence/T28/npm-test-324-snapshot.txt). 이후 UI 테스트 추가·critic 재현 생성으로 최종 전체 결과가 아님. |
| 부모 일반 후보 빌드 | `d0bd21da2ea0`, 종료 0 | [원문](docs/evidence/T28/ui-candidate-build.txt). 이후 모든 변경에 대한 최종 일반/실험 재검증은 필요. |
| `git diff --check` | 인계 작성 전 종료 0 | 문서 작성 후에도 확인 |

HTTP 테스트는 sandbox의 loopback `listen EPERM`이 있었고, 허용된 실행 환경으로 다시 수행해 해당 전체 테스트가 통과했다. 환경 실패와 의도한 기능 실패를 구분한다. 새 제한 전보다 이전인 일반 `7d0a034d9089`/실험 `cde21edbe947` 빌드 기록도 남아 있지만 현재 후보의 최종 검증으로 사용하지 않는다.

### 실제 CUA로 확인한 정상 경로 — 전부 합성 Notion

- 기존 native OPFS 연결 재사용·조회.
- 원두 입력 → 다른 탭 화면 이동 → 복귀 및 목록 새로고침 후 초안 보존.
- 원두·선택 산지/향미, 최소 입력 봉지, 날짜 있는 재구매 봉지 생성.
- `15.5g`, `93℃`, `650μm`, `0:00/0:30/1:10` 세 단계 저장. 마지막 간격 `40초`, 누적 물 `250g` 표시.
- 원본 93℃를 유지한 90℃ 독립 복사본 저장.
- 같은 날짜 1점·5점 두 기록 → 평균 3.0점·2회.
- mock 원본 온도를 91℃로 변경 → 기존 기록 93℃ 유지 → 새 기록은 91℃ 저장.
- hash 탐색·뒤로가기, 재실행 후 조회·연결 유지.
- 390px iframe에서 본문 폭과 단계 표 내부 가로 스크롤 확인. 실제 iPhone 검증은 아니다.

증거: [평가·기록](docs/evidence/T28/ui-records-and-rating.png), [과거 조건](docs/evidence/T28/ui-historical-snapshot.png), [390px 표](docs/evidence/T28/ui-390px-table.png), [수정 전 초안 유실](docs/evidence/T28/ui-draft-loss-before.png).

### 별도 T27 합성 A/B harness 정상 경로

`4197/bean-pocket/`의 두 탭에서 A 실행 → 한 탭 dirty일 때 B 보류·입력 유지·동결 해제 → Clear 후 두 탭 모두 실제 B 문서로 전환·controls 활성화를 확인했다. native Web Locks/OPFS를 사용했지만 합성 HTML/app인 만큼 실제 제품 동결 관찰을 이 성공으로 덮지 않는다.

증거: [harness](docs/evidence/T27/browser-harness.mjs), [이벤트](docs/evidence/T27/browser-events.jsonl), [dirty 보류](docs/evidence/T27/native-dirty-deferred.png), [B 실행](docs/evidence/T27/native-build-b.png).

## 5. 환경·임시 자원

- Node.js 22 계열, 외부 패키지 없이 Node 내장 테스트 사용.
- 제품 QA 서버 원문: [browser-server.mjs.txt](docs/evidence/T28/browser-server.mjs.txt). 이전 실행 파일은 `/tmp/bean-pocket-browser-server.mjs`, 임시 루트는 `/tmp/bean-pocket-browser-qa`였다. mock rows는 서버 메모리에 있으므로 재시작하면 유지되지 않는다.
- T27 harness는 명시적으로 `node docs/evidence/T27/browser-harness.mjs`로 실행한다. 실행 시 이벤트 파일을 비우므로 기존 증거를 다른 파일로 보존하거나 새 출력 경로를 정한 뒤 실행한다.
- 이전 exec 세션은 제품 `2385`, harness `40464`였으나 재사용을 보장하지 않는다. **인계 작성 시 4196/4197 LISTEN 프로세스는 관찰되지 않았다.** 재개 시 확인하고 필요한 서버만 실행한다.
- 이전 CUA 탭 ID나 JS binding도 유효하다고 가정하지 않는다. 관련 도구 지침을 다시 확인하고 탭 상태를 읽는다. 브라우저 조작은 CUA를 사용한다.
- 임시 QA의 mock boot·추가 HTML을 제품 `dist/`나 Pages에 넣지 않는다. 공개 릴리스는 일반 빌드 허용 목록만 포함해야 한다.
- 실제 토큰·Notion 식별자는 빌드·로그·URL·공개 증거에 넣지 않는다. 이번 QA는 고정된 합성 ID/credential만 썼으며 실제 Notion 요청은 0건이다.

## 6. 에이전트 설정과 제한

생성 도구가 이름 인자를 지원하지 않아 아래 역할은 업무상 호칭이다. 모델/effort는 실제 생성 인자로 지정했으며, 재사용 시 기존 설정을 유지했다.

| 역할 | 실제 별칭·ID | 설정·결과 |
|---|---|---|
| orchestrator | Euler / `01a151fa-b3c0-7633-885c-123240c3b258` | `gpt-6.1-sol/medium`, 실행 순서·소유 범위 확정, 종료 |
| worker-8 | Laplace / `01a15435-732f-7023-a143-2816eb2df6c6` | **`gpt-6-luna/max`**, T27 수정·29 통과 후 제품 동결 진단으로 재개했으나 사용량 제한 중단 |
| worker-9 | Sagan / `01a15435-73c9-7180-848a-c7ff81452aa4` | **`gpt-6-luna/max`**, UI 구현·21 통과·증거 작성 완료, 미커밋 |
| critic | Socrates / `01a1528c-7813-7b71-bf79-dc9259e6eb03` | `gpt-6.1-sol/medium`, 명령/F5 PASS, T27 N1 수정 필요 판정 |
| critic-3 | Locke / `01a15447-cd8d-7d82-a14b-a6b5471ab8bf` | `gpt-6.1-sol/medium`, UI 추가 재현 5건 실패 기록 후 사용량 제한 중단 |

사용자는 `luna/ultra`를 요청했으나 도구가 지원하지 않아 생성이 거부됐다. 지원값은 `low, medium, high, xhigh, max`였으며, 이후 사용자가 **`gpt-6-luna/max`를 명시 승인**했다. 현재 워커 설정은 max이며 ultra를 실제 사용했다고 보고하면 안 된다. 이전 medium 단계에는 429와 provider `502 / ENOTFOUND chatgpt.com`도 있었다.

마지막 제한 메시지는 `You've hit your usage limit. Try again at Oct 20th, 2026 1:34 AM.`이었다. 시각 문자열만으로 현재 가용성을 확정하지 말고 재개할 때 실제 도구 결과를 확인한다. 승인되지 않은 다른 worker 모델로 임의 전환하거나 동일 실패를 짧은 간격으로 반복하지 않는다.

## 7. 재개 순서·완료 조건

1. 이 문서와 `git status`를 확인하고 기존 미커밋 작업을 보존한다. 기존 에이전트가 복원 가능하고 역할이 맞으면 재사용한다. worker=`luna/max`, orchestrator/critic=`sol/medium` 설정을 도구로 지정·기록한다.
2. T27은 기존 담당 worker가 N1 및 제품 동결 조건을 최소 재현하고 원인을 구분해 수정한다. 원래 7개 재현·29개 전용 테스트와 신규 실패 회귀를 모두 통과시키고 독립 critic 재검토를 받는다.
3. UI 담당은 critic의 미완성 재현 5건을 검토해 실제 결함을 TDD로 수정하고, critic-3 또는 독립 critic이 재검토한다. 기존 UI 전용 통과만으로 독립 PASS를 대신하지 않는다.
4. 최신 UI의 unknown/partial 확인·해제 전체 흐름을 CUA로 확인한다. 마지막 native 제품 동결 때문에 이 검증은 끝내지 못했다. 최신 후보로 정상 공개 흐름, 설정/초안 보존, 두 창·iframe·worker 재시작/중단·조건부 실제 버전 전환을 검증한다.
5. 모든 코드 변경 후 전체 `npm test`, 일반·실험 빌드와 검사, diff 검사를 실행하고 명령·종료 코드·최종 build/commit·미검증 범위를 갱신한다. 독립 재현의 실패를 숨기지 않는다.
6. 검토된 작업 변경만 선별해 커밋하고 변경·검증 결과를 사용자에게 제시한다. **merge는 사용자의 명시 승인 후** 실행한다. 그 전에는 main 통합·배포를 진행하지 않는다.
7. 배포 후보가 준비되면 실제 게시와 T29 지정 iPhone/Safari·홈 화면·PC 종료 셀룰러·기기 간 조회·최종 연결 파일 유지/삭제/재설치를 확인한다. [T29 체크리스트](docs/evidence/T29/README.md)를 따른다.
8. T29 통과 후 기존 운영 DB 5개를 재사용해 읽기 연결을 확인하고 T30 인수인계를 완료한다. 운영 DB에 임의 시험 데이터를 쓰거나 새 DB를 중복 생성하지 않는다.

## 8. 사용자 지시·승인 상태

- 남은 구현 진행은 승인돼 있다. 최신 요청은 제한 해제 후 계속 진행, 그리고 현재 작업을 `handoff.md`에 기록하는 것이다.
- commit은 별도 승인 없이 가능하지만 이번 작업 변경만 선별한다.
- **merge·현재 후보의 게시 승인은 아직 받지 않았다.**
- 이전 시간별 자동 재개 등록은 명시적인 일정 승인 없이 반복 코드 수정을 수행한다는 이유로 자동 승인 검토에서 거절됐다. 자동화는 등록되지 않았고 우회하지 않았다. 이 문서 작성에서도 새 예약을 만들지 않았다.
- 실제 Notion/지정 기기 검증과 운영 연결은 미완료이며 제품 완료라고 선언하지 않는다.
