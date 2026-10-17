# T00 실행 증거

- 일시: 2026-10-18, Asia/Seoul
- 환경: macOS, Node v22.17.0, 로컬 작업트리
- 검증 대상: `cc8bd76` (초기 명세 커밋, 기존 실행 코드 변경 없음)
- 상태: 준비 조사 수행, 비공개 Pages 자격 **검증 대기**

| 명령 | 종료 코드 | 결과 |
|---|---|---|
| `git status --short`, `git branch --show-current` | 0 | 기존 변경 10개 확인 후 사용자 요청대로 별도 브랜치 최초 커밋 |
| `npm test` (샌드박스) | 1 | 16 통과, HTTP 13개 `listen EPERM` |
| `npm test` (권한 부여) | 0 | tests 29, pass 29, fail 0, skipped 0 |
| `gh auth status` (권한 부여) | 0 | keyring 인증 정상. 비밀값 보관·출력 사본 없음 |
| `gh repo view --json nameWithOwner,visibility,defaultBranchRef,url,viewerPermission` | 0 | PRIVATE, main, ADMIN |
| `gh api repos/kangseokgyu/bean-pocket/pages` | 1 | HTTP 404, 조회 가능한 Pages 설정 없음 |
| `gh api user --jq '{login: .login, plan: .plan.name}'` | 0 | plan null. 자격을 추정하지 않음 |

`npm test`의 기존 HTTP 흐름은 모의 Notion 테스트다. 실제 Pages·Notion·iPhone 성공 증거가 아니다. T03/T04/T06/T08은 실행하지 않았다. 계정 요금제 또는 공개 범위 결정, merge 승인, 원격 Pages 설정·수동 게시가 다음 단계다.
