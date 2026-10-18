# T10 계약 결정의 근거

2026-10-18 (Asia/Seoul). 공식 API·표준 문서와 기존 코드를 확인했다. 이는 새 파일 저장·잠금 구현의 실기기 지원을 검증했다는 뜻은 아니다.

- [File System Standard](https://fs.spec.whatwg.org/): writable stream을 닫기 전에는 실제 파일 내용을 바꾸지 않는 저장 절차. close 이후 응답·재읽기 실패는 이미 저장됐을 수 있으므로 기존 파일 보존을 무조건 보장하지 않는다.
- [Web Locks](https://www.w3.org/TR/web-locks/): exclusive lock과 ifAvailable의 미획득 null 결과. 미획득·미지원이면 원격 쓰기를 시작하지 않는다.
- [Notion 요청 제한](https://developers.notion.com/reference/request-limits): rich text 조각·배열·요청 크기 제한을 선제 확인한다. 쓰기 503은 저장 후 응답 구성만 실패한 경우도 있어 자동 재전송하지 않는다. Retry-After는 오류 정보로 전달하되 이번 어댑터는 자동 재시도를 하지 않는다.
- [Notion 데이터 소스 조회](https://developers.notion.com/reference/query-a-data-source): 결과 잘림을 나타내는 request_status.type=incomplete를 각 응답에서 검사한다. has_more=false만 보고 전체 조회 성공으로 반환하지 않는다.

기존 순수 도메인을 변경하지 않고 [최소 재현](completeness-probe.txt)을 실행했다(종료 0). totalWater=50, 첫 단계 49.9999995g, 둘째 단계 0.0000005g인 레시피는 허용 오차 때문에 앞 단계만 존재해도 기존 검증을 통과한다. 따라서 합계만 원격 완료 표식으로 쓰지 않는다. 생성은 N→2→1 순서로 직렬 실행해 1번 단계를 마지막에 넣고, 취소는 부모 레시피부터 확인된 archive를 수행한 뒤 자식을 정리하는 계약을 택한다. 실제 명령 구현의 실패 지점·응답 유실·취소 실패 검증은 T18에서 수행한다.
