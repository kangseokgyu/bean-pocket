# T00 실행 증거

- 일시: 2026-10-18, Asia/Seoul
- 환경: macOS, Node v22.17.0, 로컬 작업트리
- 검증 대상: `cc8bd76` (초기 명세 커밋, 기존 실행 코드 변경 없음)
- 상태: 최초 비공개 Pages 자격 검증 대기 → 사용자 공개 전환 승인과 설정 확인 후 **완료**

| 명령 | 종료 코드 | 결과 |
|---|---|---|
| `git status --short`, `git branch --show-current` | 0 | 기존 변경 10개 확인 후 사용자 요청대로 별도 브랜치 최초 커밋 |
| `npm test` (샌드박스) | 1 | 16 통과, HTTP 13개 `listen EPERM` |
| `npm test` (권한 부여) | 0 | tests 29, pass 29, fail 0, skipped 0 |
| `gh auth status` (권한 부여) | 0 | keyring 인증 정상. 비밀값 보관·출력 사본 없음 |
| `gh repo view --json nameWithOwner,visibility,defaultBranchRef,url,viewerPermission` | 0 | PRIVATE, main, ADMIN |
| `gh api repos/kangseokgyu/bean-pocket/pages` | 1 | HTTP 404, 조회 가능한 Pages 설정 없음 |
| `gh api user --jq '{login: .login, plan: .plan.name}'` | 0 | plan null. 자격을 추정하지 않음 |

`npm test`의 기존 HTTP 흐름은 모의 Notion 테스트다. 실제 Pages·Notion·iPhone 성공 증거가 아니다. T03/T04/T06/T08은 실행하지 않았다.

## 사용자 승인 이후 원격 설정

- 승인: 사용자가 무료 계정이며 저장소 공개 전환을 허용한다고 명시.
- `git fetch --no-tags origin main`: 종료 0. 원격 main은 `4561a9e442cf7577c40113b4f9d284c80fefbe97`.
- `HEAD`와 `origin/main`의 37개 blob 검사: 종료 0, 점검 대상 자격증명 패턴·로컬 비공개 설정값 일치 0개. 출력에는 값 원문을 남기지 않았다. 원격 브랜치 main 1개, 태그 없음. 이전 로컬 이력은 원격 미포함.
- `gh repo edit kangseokgyu/bean-pocket --visibility public --accept-visibility-change-consequences`: 종료 0. 재조회 `PUBLIC`, `main`, `ADMIN`.
- `gh api --method POST repos/kangseokgyu/bean-pocket/pages -f build_type=workflow`: 종료 0. `build_type=workflow`, `public=true`, `status=null`.
- Pages 재조회: 종료 0. `https_enforced=true`, 예정 주소 `https://kangseokgyu.github.io/bean-pocket/`.
- Actions 권한 조회: 종료 0, enabled true. `github-pages` 배포 브랜치 정책 조회: 종료 0, main branch만 허용.

원격 설정은 준비 완료이지만 앱 게시와 실제 URL 확인은 미실행이다. 변경과 최종 검증·리뷰 결과를 제시한 후 merge 승인을 받아 기본 브랜치에 통합하고 수동 게시하는 것이 다음 단계다.
