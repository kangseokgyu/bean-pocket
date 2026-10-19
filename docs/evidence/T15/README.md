# T15 최신 조회·완전성 — 검증 기록

2026-10-19. `c6a794d`의 T10 계약·T11/T12 통합을 기준으로 진행한다. orchestrator Socrates(gpt-6.1-sol/medium)가 완료 조건을 확정하고, 기존 worker-2 Locke(gpt-6-luna/max)가 조회 모듈·전용 테스트를 담당한다. 기존 역할·실제 별칭·ID 매핑과 모델 설정을 유지했다.

5종 전체 조회·단일 관계·저장된 단계의 완전성·최종 부모 재확인을 검증한다. 저장된 기록의 스냅샷은 현재 레시피로 다시 만들지 않는다. Node·로컬 브라우저의 모의 응답 결과는 실제 Notion·지정 iPhone 결과로 확대하지 않는다.

개발 소스는 `pwa/domain.mjs`의 단순 re-export를 통해 `lib/domain.mjs` 원본을 사용한다. 배포는 기존처럼 원본 바이트를 `dist/domain.mjs`에 직접 공급한다. 도메인 계산 사본을 만들지 않는다.

## 결과

모듈 구현·독립 재검토 PASS. 코드·전용 테스트·도메인 개발 경유 모듈 커밋 `2c61cbe`.

## 에이전트 인계

기존 worker-2가 사용량 한도 오류로 중단하고, 재시도 시 해당 ID를 찾을 수 없었다. 부모가 미완성 모듈의 기본 구현을 이어 작성한 뒤, 지정 설정을 명시한 worker-3 Banach(`01a15122-32b2-72d3-987a-4e31f359f934`, `gpt-6-luna`·`max`)에 완성을 인계했다. 유효한 다른 원두의 봉지는 조회 대상에서 제외하지 않는 명세를 기준으로 테스트 기대값을 재검토한다. 도구에 이름 인자가 없어 역할명은 업무상 호칭이다.

## 1차 독립 검토

기존 critic Nietzsche(`gpt-6.1-sol`·`medium`)가 직접 요구사항·코드를 검토했다. 유효한 다른 원두의 봉지를 조회에 유지하는 테스트 기대값 정정은 명세와 일치했다. 전용 38개와 빌드 관련 테스트는 통과했지만, critic의 별도 재현에서 활성 손상 자식을 제외한 뒤 epsilon 이내 prefix 레시피가 완전한 것으로 노출되는 P2를 확인했다. `49.9999995g + 0.0000005g`의 두 번째 단계 제목 property 타입을 손상한 사례다. 부모가 확인되는 활성 손상 자식의 영향을 완전성 판정에 반영하도록 같은 worker가 수정한다.

worker의 최초 전체 테스트는 샌드박스의 로컬 HTTP listen `EPERM` 13건과 동시 진행 중이던 T14 RED 5건 때문에 실패했다. [실패 원문](integration-sandbox-failure.txt)을 보존하며 통과로 보고하지 않는다. 이후 부모의 권한 있는 전체 실행에서 234개 통과를 확인했으나, critic 지적을 반영한 최종 상태는 별도 재검증한다.

## 수정 인계와 최종 통과

worker-3가 `429 Too Many Requests` 재시도 한도 오류로 중단해, 이미 같은 지정 `gpt-6-luna`·`max`로 생성한 worker-4 Mencius가 순차 인계받았다. 부모가 확인한 중간 상태는 47개 중 45통과·2실패였다. [중단 시점 원문](interrupted-followup.txt). 삭제 상태가 명확한 자식은 부모를 taint하지 않고, 실제 조회된 활성 손상 자식의 관계로 식별되는 부모만 보수적으로 제외하도록 마무리했다. 관찰되지 않는 임의의 외부 삭제까지 추론하지 않는다. truncated 관계가 있는 활성 자식의 부모는 완전한 prefix가 있더라도 숨기며, 해당 기록의 저장 snapshot은 유지한다.

- 최초 [동작 부재 RED](initial-red.txt): 24개 중 1통과·23실패.
- 속성·기록 경계 보완 [RED](properties-red.txt), critic 지적 재현 [RED](critic-red.txt), 마지막 인계 [RED](takeover-red.txt) 보존.
- `node --test test/pwa-read-repository.test.mjs`: 종료 0, **47개 통과**. [최종 전용 GREEN](critic-green.txt).
- critic이 전용 47개와 별도 재현 7건을 직접 확인하고 최종 PASS. 정확한 tiny-water 제목 타입 손상·복수/잘린 관계·잘못된 자식 ID/source·삭제 자식 반례를 확인했다.
- 부모 최종 `npm test`: 종료 0, **245개 통과**, 일반·실험 빌드 및 산출물 검사 각각 종료 0. [통합 로그](../T14/npm-test-final.txt).

실제 dist 모듈의 5종 조회는 로컬 브라우저의 **모의 응답**으로 원두 이름 복원까지 확인했다. [최종 빌드 화면](../T14/native-reentry.png). 실제 Notion 요청 0건이며 실제 데이터·지정 iPhone 검증을 대신하지 않는다. 앱 첫 화면 연결·입력 UI·main 통합·Pages 게시는 후속 단계다.
