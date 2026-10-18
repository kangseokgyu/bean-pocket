# T10 브라우저 구현 계약 작성 기록

2026-10-18. 기준 HEAD `ac93b61`의 [PLAN](../../../PLAN.md)·[SPEC](../../../SPEC.md)·기존 초안을 직접 읽고 부모 결정사항을 [구현 계약](../../pwa-contracts.md)에 반영했다. **독립 critic 재검토 PASS, T10 계약 확정 완료**다.

## 반영한 결정

- Notion 2025-09-03 고정·fetch 주입·다섯 메서드와 공유 순수 코덱, 조회 POST와 쓰기 구분, body 전체 timeout·자동 재시도 금지·안전 오류와 앞선 쓰기 고려.
- 모든 query 응답의 incomplete·커서 누락/반복/순환 거부, 부분 성공 반환 금지. 스냅샷 2,000자 조각·배열 100개·전체 요청 500KB의 선제 전송 검증을 도메인 입력 규칙과 분리.
- OPFS schemaVersion 1·native staging/close commit·readback 뒤 활성 연결 교체. close 이전 기존 파일 보존의 범위와 close/readback 불확실 시 쓰기 차단.
- 동일 app-wide Web Lock·journal 순서·fail-closed·종료 processing 복구, 연결 교체와 불확실 작업의 우회 방지.
- N→2→1 단계 생성·order 1 commit gate·원격 완전성, 부모 archive 확인 후 자식 정리. 외부 원본 자동 수정 금지.
- 작업 6상태·키/payload·snapshot·재조회·소유 경계 유지. 같은 scope 모든 제어 창의 새 generation 응답을 요구하는 SW 안전 적용은 T27 후속 미구현으로 명시.
- Node 모의 검증·CUA 실제 브라우저·T29 실제 연결 파일 수명을 구분.

[공식 근거 확인](source-check.md)과 부모의 [공개 가짜값 최소 재현](completeness-probe.txt)을 참조했다. 최소 재현은 기존 합계 오차로 정방향 prefix가 통과할 수 있고 역순 중간 상태는 거부됨을 보여 준다. 이 문서 작업에서 이를 재실행하거나 새 동작의 테스트 통과로 보고하지 않는다.

## 검증·인계

문서 상대 링크 12개·한국어 본문·공백 검사와 `git diff --check`를 확인했다(각 종료 0). 이번 범위는 문서만이며 기능 테스트·실제 API·실제 스키마·비공개 파일 조회·코드 변경·커밋은 수행하지 않았다. 부모의 공용 빌드 경계 RED 4건은 별도 작업이며 이 계약의 구현 완료 증거가 아니다.

후속 T12 본체 구현은 계약 독립 검토 후 별도 지시로 시작한다. 공용 빌드·검사기·workflow 통합은 부모 소유다. 독립 critic 결과와 T10 최종 완료 판정은 아직 기록하지 않았다.

## critic P2 3건 수정 — 재검토 대기

- 연결마다 UUID revision을 만들고 connection 파일·journal.activeConnectionRevision·guard.candidateRevision을 대응시켰다. lock 내 두 파일 재읽기와 초안/client 세대 일치 없이는 stale-connection으로 전송을 차단한다. 교체 순서와 journal의 active revision 교체·guard 해제 원자적 close, 한쪽 파일 부재 시 최초 연결로 초기화하지 않는 복구 경로를 명시했다.
- 모든 단계 조회 뒤 노출 전과 snapshot 직전 부모 getPage로 삭제 상태·원두 관계·조건 필드·last_edited_time을 최종 비교한다. 변경된 부모와 새 자식의 조립 결과는 폐기하며 Notion transaction 보장으로 확대하지 않는다.
- SW prepare ACK는 각 창의 새 입력·초안 변경·제출·연결 교체 동결과 clean 재확인 뒤에만 허용한다. apply 직전 prepared 상태 재확인, 새 dirty/동결 실패/창 집합 변경 시 generation 무효화, 중단 시 동결 해제를 T27 후속 검증 항목으로 보완했다.

수정 후 상대 링크 12개·한국어/공백·세 P2 계약 경계 확인과 `git diff --check`를 재실행했고 모두 종료 0이었다. 이번 수정은 두 계약 문서에 한정한다. 새 구현·기능 테스트·API·추가 스키마/표준 재조회·커밋은 수행하지 않았다. **P2 수정 작성 완료 / 독립 critic 재검토 요청**, T10 완료·PASS는 아직 기록하지 않는다.

## 최종 판정

critic이 지적한 연결 세대 경쟁·취소 중 조회 조립·SW clean 응답 뒤 입력 경쟁 3건을 동일 worker가 수정했고 독립 재검토 PASS를 받았다. T10 계약 확정을 완료한다. 구현·회귀·실기기 지원 검증은 각 후속 작업에서 수행한다. 기존 도메인 검증의 의미나 운영 Notion 스키마는 바꾸지 않았다.
