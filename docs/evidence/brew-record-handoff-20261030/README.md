# 추출 완료 후 기록 폼 진입 개선

2026-10-30. 추출 화면에서 이미 선택한 원두와 레시피를 같은 연결의 새 기록 폼에 전달한다. 이 경로는 Notion 응답을 기다리지 않고 폼을 표시한다. 직접 URL 진입과 새로고침은 기존 상세 조회 경로를 사용한다. 새 기록 화면에서는 기존 기록 목록을 읽지 않는다. 저장 시 스키마와 최신 관계 검증은 유지한다.

## 검증

- 테스트를 먼저 추가해 기존 코드에서 선택값 누락, Notion 대기, 불필요한 기록 목록 조회를 확인했다. [실패 로그](red.tap).
- 연결 변경 후 이전 이름을 재사용하지 않는 테스트도 수정 전에 실패했다. [실패 로그](revision-red.tap).
- `npm test` 종료 0. 641개 통과, 0개 실패. [요약](test-summary.txt). 전체 로그는 로컬 `/private/tmp/brew-record-handoff-npm-test.tap`에 있다. 최초 실행은 sandbox의 loopback listen EPERM으로 중단됐으며 권한 승인 후 같은 명령이 통과했다.
- `npm run build:pages` 종료 0. 빌드 `bf6e2045f3fe`. [빌드 로그](build.txt).
- `npm run check:pages` 종료 0. [검사 로그](check.txt).
- `git diff --check` 통과.
- Worker는 `gpt-6-luna` / `max`, Critic은 `gpt-6.1-sol` / `medium`으로 순차 실행했다. [독립 검토](critic-review.md)와 [DOM 하네스 결과](critic-results.json). 7개 검사가 통과했고 차단 이슈는 없었다.

실제 브라우저 렌더링, 실제 Notion 저장, iPhone Safari와 홈 화면 실행은 검증하지 않았다. 게시 결과는 완료 후 아래에 기록한다.
