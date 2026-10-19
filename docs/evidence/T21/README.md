# T21 — 기기 연결 화면

연결 검증 성공 뒤에만 새 설정을 저장하며, 대체 검증 실패는 기존 활성 연결을 유지한다. 오류·상태에는 토큰을 포함하지 않는다. 초기화 시 미해결 작업이 journal에 있으면 원본 확인을 위한 검증 연결을 열고, journal에서 설명되지 않는 차단 상태는 연결을 중단한다. 이미 생성 페이지 ID가 기록된 복구에는 추가 ID나 native 계약상 불가능한 not-saved 선택을 노출하지 않는다.

- RED: [blocked journal·복구 ID 경계](ui-boundary-red.txt), [연결 파일 부재 중 unexplained blocked 상태](ui-no-connection-red.txt)
- GREEN: [T21–T26 UI 전용 실행 결과](../T26/ui-test-green.txt), 20/20 통과
- 부모 CUA 인계: syntheticNotion 기존 native OPFS 연결 읽기 및 정상 입력 흐름 통과 보고. 실제 Notion 요청은 하지 않았다.
- 남은 통합 게이트: 부모가 최신 복구 경계 전용 테스트, 전체 suite/build와 critic UI 검토를 갱신한다.
