# 2026-10-20 재개 검증

작업 브랜치 `codex/pages-first-implementation`, 시작 HEAD `153167f`. 기존 미커밋 T21~T28 변경을 보존해 이어서 검증했다. merge·push·Pages 게시·실제 Notion 요청은 실행하지 않았다.

## 기준 실행

- `npm test` (sandbox): exit 1, 331개 중 313 pass / 18 fail. UI 실제 결함 5건과 loopback listen EPERM 13건을 구분했다. [원문](baseline-test.txt).
- UI worker가 원본 critic 재현을 유지해 결함 5건을 수정했고 독립 UI 검토 32/32 및 추가 복구 재현 2건 통과. 이후 native 통합에서 동시 초기화 실패를 추가 발견했으므로 이 판정은 해당 시점 hash에 한정한다.
- 최초 통합 `npm test` (허용 환경): exit 0, 345/345. [원문](final-test.txt). 이후 추가 수정 예정이므로 최종 결과로 사용하지 않는다.
- 일반 `4063a267e227`, 실험 `a2d12bd29cb7` 빌드 및 검사 exit 0. [일반](build-general.txt), [실험](build-probes.txt). 이후 소스 변경에 따라 최종 재실행 필요.

## 실제 로컬 브라우저 — 합성 데이터 전용

제품은 `http://127.0.0.1:4196/candidate-resume/`에서 실행했다. native OPFS/Web Locks를 사용하고 모든 Notion 요청은 로컬 합성 서버가 처리했다. 이 origin에 남아 있던 합성 연결 파일을 재사용했으며 실제 토큰·실제 Notion 데이터는 사용하지 않았다.

1. A `4063a267e227`: 원두·봉지·3단계 레시피·90℃ 독립 복사·같은 날짜 1점/5점 기록을 생성했다. 원본 93℃, 마지막 단계 간격40초·누적250g, 평균3.0/2회를 확인했다. [화면](records-rating.png).
2. 연결을 같은 합성 데이터 소스로 교체한 후 원두 초안을 보존했다. 다른 화면을 거쳐 돌아와도 같은 초안이었다. [화면](token-draft-preserved.png).
3. 생성503→unknown 후 fresh read503이면 확인 UI·초안·새저장 차단이 유지됐다. 정상조회로 복귀 후 명시적 not-saved 확인으로 해제됐다. [화면](unknown-read-failure.png).
4. 복사 레시피 중간 단계429·부모취소503으로 두 항목만 확인된 불완전 상태를 만들었다. 정상 fresh read에서도 saved확정이 거부됐다. 합성 신규2개만 보관취소한 뒤 cancelled확인으로 해제했고 이후 복사 저장에 성공했다. [거부 화면](incomplete-saved-rejected.png).
5. 동일 scope390px iframe에 초안을 입력하고 숨겼다. HTML주석만 바꾼 합성B `c5f36be7e63b`를 공급한 뒤 A iframe은 보류·controls활성 상태로 남았다. 이후 clean재시도에서 iframe의 실제B문서·동결해제와 active-only등록·native locks없음을 확인했다. [보류](update-hidden-draft-deferred.png), [B iframe](update-iframe-b-enabled.png), [잠금](update-native-locks-empty.png).
6. 같은 전환에서 main B문서는 초기화 실패·연결폼 표시가 나타났다. 동결잔류와 구분해 UI worker에게 진단·수정 인계했다. [실패](startup-lock-failure.png). 이 결과를 정상 두client통과로 보고하지 않는다.

SW 강제종료는 native실행하지 않았다. VM재시작 자동화와 구분한다. iPhone/Safari/홈화면/셀룰러/실제Pages/운영연결은 미검증이다.

## 에이전트

기존 orchestrator Euler `01a151fa-b3c0-7633-885c-123240c3b258`(sol/medium), worker-8 Laplace `01a15435-732f-7023-a143-2816eb2df6c6` 및 worker-9 Sagan `01a15435-73c9-7180-848a-c7ff81452aa4`(luna/max)를 복원했다. 복원 도구는 모델/effort 재지정·조회 기능이 없으므로 이전 생성 기록을 설정 근거로 삼는다. 기존 critic복원은 과거 usage error를 반환했다. 새 critic Sagan `01a1563d-b97a-7462-9bab-29fbd9740a76`는 생성 인자에 sol/medium을 명시했다. 이름 인자는 지원하지 않아 역할명은 업무상 호칭이다.

## 최종 판정

- 최신 전체 `npm test`: **exit 0, 354/354 pass, fail/cancelled/skipped 0**. [최종 TAP](final-test-after-followups.txt).
- 일반 **`4e7b1268f15d`**, 실험 **`4a0d23ec358e`** 빌드·검사: exit 0. 마지막 dist는 일반 빌드다. [로그](final-build-check.txt), [최종 소스 hash](final-source-hashes.json), [최종 릴리스 18개 파일](final-dist-files.txt).
- 최종 독립 UI·통합 빌드 **PASS**: UI37/37, 빌드28/28, 별도 시작경계3/3, 양 빌드·검사 exit0, 검토 소스8개 hash전후동일. [명령·판정·범위](critic-executions.txt). 독립 추가 테스트 원문은 `.mjs.txt`로 보관했다.
- 최종 독립 T27 **PASS**: 기존/신규42/42, 원래7/7, N1원문1/1, 추가 client종료 원문1/1. [명령](../../T27/resume-critic-recheck-executions.txt), [수정 보고](../../T27/resume-20261020.md). 초기 추가P1 실패도 보존했다.
- 동시 초기화 잠금 경합은 UI회귀로 수정했다. 단순 경합만 callback 진입 전 최대6회·총1.8초 기다리고, 원격 요청·callback오류는 재시도하지 않는다. 소진시 저장된 연결 다시읽기를 제공한다. 이후 native 두문서 모두 연결자동복구를 확인했다.
- 최종 native C→D 전환: 일반 `4e7b1268f15d`와 런타임이 같은 HTML주석 전용 합성B **`08bac8c084c9`**로 검증했다. iframe초안입력→봉지화면으로숨김→진단helper의 `registration.update()`→waiting설치·A보류→원두화면복귀시 **최종 업데이트 보존 초안** AX값유지→입력취소→두문서실제B+ready+controls활성, 최종nativeheld/pending빈배열. main은 hash레시피상세 경로를 유지했다. [초안 AX](final-dirty-state.txt), [main DOM](final-main-state.txt), [iframe AX](final-iframe-state.txt), [등록·잠금](final-registration-state.txt), [초안 화면](final-dirty-deferred.png), [main B](final-main-b.png), [iframe B](final-iframe-b.png).
- iframe DOM snapshot은 input value를 누락하므로 초안 유지값은 native AX와 screenshot으로 판정했다. 이전 중간관측의 빈 snapshot만으로 초안유실이라고 판정하지 않았다.
- 초기 A→B에서 관찰한 시작실패는 해결됐으나 과거 2026-10-19 동결의 정확한 이벤트원인을 소급확정하지 않는다. 현재 대응 경계의 회귀와 최신 native조건이 통과한 것으로 판정한다.

T21~T28은 로컬 구현·자동화·대표 native공개흐름 범위 통과다. **제품배포/실기기 완료는 아니다.** 실제 SW강제종료는 VM doubles 검증만 했고 native강제종료 실증은 없다. T29 Pages·Notion·지정iPhone·셀룰러·최종연결파일수명과 T30운영연결은 대기다. merge·게시 승인은 받지 않았으며 실행하지 않았다.


공백검사: 새로 stage한 과거/현재 TAP·AX 원문에는 출력 자체의 줄끝 공백이 있어 전체 `git diff --cached --check`가 exit2였다. 원문 증거를 바꾸지 않고 보존했다. 테스트 파일의 불필요한 끝 빈줄은 정리했고, `git diff --cached --check -- . ":!docs/evidence/**"`로 구현·문서 공백을 별도 확인한다.
