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

실제 브라우저 렌더링, 실제 Notion 저장, iPhone Safari와 홈 화면 실행은 검증하지 않았다. 공개 파일 확인은 아래 결과를 따른다.

## 게시 결과

- 소스 커밋 `afb2aca72a8fa833eb0ddd192f08de96c6d0b765`를 main에 fast-forward로 통합했다.
- `gh workflow run pages.yml --ref main -f probes=false`로 일반판을 게시했다. [실행 40977781629](https://github.com/kangseokgyu/bean-pocket/actions/runs/40977781629)의 build와 deploy가 성공했다. `gh run watch 40977781629 --exit-status --interval 10` 종료 0.
- 통합 후 CI도 테스트 641개 통과, 0개 실패와 빌드·검사를 통과했다. [CI 요약](ci-summary.txt). 전체 로그는 로컬 `/private/tmp/brew-record-handoff-ci.log`에 있다.
- 공개 주소는 https://kangseokgyu.github.io/bean-pocket/ 이다. 루트 HTTP 200, 표시 빌드 `bf6e2045f3fe`를 확인했다.
- `node docs/evidence/brew-record-handoff-20261030/verify-public.mjs dist https://kangseokgyu.github.io/bean-pocket/` 종료 0. [공개 파일 결과](public-files.json)의 26개 파일이 모두 HTTP 200이며 승인 dist와 바이트가 일치한다. [재실행 스크립트](verify-public.mjs).
- 브라우저로 공개 화면 확인을 시도했지만 CUA가 `The browser access host is unavailable`을 반환했다. 실제 브라우저 렌더링과 iPhone 설치 실행은 미검증이다. 실제 Notion 저장은 실행하지 않았다.

이 게시 결과 문서와 확인 스크립트의 후속 커밋은 앱 소스를 변경하지 않는다. 게시 커밋과 문서 커밋을 구분한다.
