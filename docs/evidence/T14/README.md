# T14 저장 작업 상태 — 검증 기록

2026-10-19. `c6a794d`의 T10 계약·T12/T13 통합을 기준으로 진행한다. orchestrator Socrates(gpt-6.1-sol/medium)가 완료 조건을 확정하고, 기존 worker Helmholtz(gpt-6-luna/max)가 상태 모듈·전용 테스트를 담당한다. 기존 역할·실제 별칭·ID 매핑과 모델 설정을 유지했다.

연결 파일·journal·작업 키의 세대 일치, 동일 설치의 독점 잠금, processing의 영속 보관과 재실행 시 unknown 복구를 검증한다. 새 작업 키나 연결 재입력으로 미해결 쓰기를 우회하지 않는다. 모의 원격 쓰기·주입 저장소 테스트는 실제 Notion·지정 iPhone 검증을 대신하지 않는다.

## 결과

모듈 구현·독립 재검토 PASS. 전용 테스트 `node --test test/pwa-submission-state.test.mjs`는 종료 0, 37개 통과했다. 코드·전용 테스트 커밋은 `cd9ebe1`이다. 최종 통합·브라우저 결과는 아래 기록을 따른다.

## 에이전트 인계

기존 worker와 worker-2가 사용량 한도 오류로 중단했다. worker-2에 다시 메시지했을 때는 해당 ID를 찾을 수 없었다. 기존 worker의 종료 상태에서도 사용량 한도 오류를 확인했다. 지정 모델·추론 수준을 변경하지 않고 생성 도구에 `gpt-6-luna`·`max`를 명시해 worker-4 Mencius(`01a15122-802e-7030-85f3-5c8d211f7802`)에 T14 구현·테스트를 인계했다. 도구에 이름 인자가 없어 역할명은 업무상 호칭이다.

## 1차 독립 검토

기존 critic Nietzsche(`01a14a6f-1be0-76d2-a6fc-f8c58f42fc67`, 기존 `gpt-6.1-sol`·`medium` 설정)를 재사용했다. 부모 도구에서 지정한 worker 모델·추론 설정은 생성 결과에 근거하며, worker 내부에 같은 설정 도구가 없다는 보고를 모델 미지정으로 해석하지 않는다.

최초 통합은 234개 통과였으나, critic이 기존 테스트에 없던 두 P2를 재현하여 완료를 보류했다. 콜백 반환 후 pending 작업이 새 context 호출을 추가해 native lock 반환 뒤 journal을 쓸 수 있었고, 연결 guard 보관 직후 종료하면 보존된 기존 연결을 명시적으로 채택할 복구 경로가 없었다. 같은 worker가 RED 선행 후 수정하며 critic 재검토를 거친다. [검토 이전 통합 로그](integration-before-review.txt).

## 재검토 통과

critic이 기존 두 재현을 다시 실행했다. 콜백 종료 후 새 context 진입은 `lock-expired`로 거부되어 native lock 밖 guard 쓰기가 없었으며, commit 이전 중단 뒤 보존된 기존 연결의 원본 확인·재조회·명시적 채택이 가능했다. 전용 37개 통과와 diff 검사 종료 0을 확인했다. [critic 수정 RED](critic-red.txt), [최종 전용 GREEN](critic-green.txt).

## 최종 통합·브라우저 결과

- `npm test`: 종료 0, **245개 통과·실패/건너뜀 0**. [원문](npm-test-final.txt).
- `npm run build:pages` / `npm run check:pages`: 각각 종료 0, 빌드 `78f28362747b`.
- `npm run build:probes` / `npm run check:probes`: 각각 종료 0, 빌드 `b73e072fd802`.
- 공통 빌드 경계는 [RED 2건](build-red.txt) 후 [GREEN 3개](build-green.txt). 최초 RED 실행의 셸은 마지막 tail 때문에 0이었고 TAP에는 2개 실패가 기록됐다. 최종 전체 테스트에는 실제 모듈을 포함한 빌드·캐시 검증이 포함된다.
- source·dist·localhost 미리보기 모듈의 바이트 일치 및 실제 비공개 설정의 source/dist/scripts 포함 여부 대조 PASS. 비공개 값은 출력·보관하지 않았다.
- 독립 critic: T14 전용 37개와 원래 두 P2 재현을 다시 확인해 PASS. T15·공통 빌드 경계도 최종 PASS. 빌드 통합 커밋 `084a14b`.

실제 로컬 브라우저에서 최종 dist 모듈을 사용했다. [다른 탭의 native Web Locks 차단](native-contention.png), [명시적 복구·동일 작업 재제출 차단·응답 유실 보관](native-recovery.png), [모든 검증 탭 종료 후 재접속의 unknown 유지·새 작업 전송 전 차단](native-reentry.png)을 확인했다. 가짜 원본 확인과 5종 모의 조회 후에만 데모 복구를 실행했고, 연결 guard 저장 후 commit하지 않은 중단도 보존된 기존 가짜 연결로 명시적으로 복구했다.

검증 주소는 `http://localhost:4192/bean-pocket/foundation-check.html`이며 별도 임시 디렉터리에서 제공한다. 테스트 화면·가짜 설정·journal은 공개 dist/소스에 추가하지 않았다. 모의 원격 요청만 사용해 **실제 Notion 요청은 0건**이다. PC 로컬 탭 종료·재접속의 결과를 브라우저 프로세스 완전 종료·지정 iPhone·최종 실제 연결 파일 수명으로 확대하지 않으며 T29 재검증을 유지한다. 앱 첫 화면의 입력 기능이나 Pages 게시 완료를 의미하지 않는다.
