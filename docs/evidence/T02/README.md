# T02 로컬 게시 준비 검증

- 일시: 2026-10-18 (Asia/Seoul)
- 환경: macOS, Node v22.17.0, Ruby 내장 YAML parser
- 범위: `.github/workflows/pages.yml`, `docs/pages-deploy.md`, README의 최소 PWA 안내
- 검증 대상: T01 `5134656` 위에 이 증거와 함께 커밋한 T02 설정·문서
- 상태: 로컬 설정 검증. 실제 Actions 실행·배포는 T03 미실행

## 설정 검사

`ruby -r yaml`로 `YAML.load_file(".github/workflows/pages.yml")`를 실행하고 다음 계약을 assertion으로 검사했다. 종료 코드 **0**.

- 트리거는 `workflow_dispatch` 하나뿐이다. push에 의한 자동 게시 없음.
- `build` job은 `github.event.repository.default_branch`의 ref에서만 실행한다.
- 전역 권한은 `contents: read`다. `deploy` job에서만 `pages: write`, `id-token: write`를 부여한다.
- 빌드 job은 회귀 테스트 → 빌드 → 산출물 검사 → 업로드 순서다.
- 업로드 action의 path는 `dist` 하나다.
- 배포 job은 `needs: build`이며 `github-pages` 환경을 사용한다.

Ruby의 YAML 1.1 parser가 `on`을 boolean 키로 읽는 차이는 `workflow["on"] || workflow[true]`로 처리했다. Actions 자체 실행·서버의 schema 검증을 수행한 것은 아니다. `actionlint`는 설치되어 있지 않아 실행하지 않았다.

로컬 `npm run build:pages`와 `npm run check:pages`의 최종 결과는 [T01 증거](../T01/README.md)에 기록했다. 두 명령 모두 종료 0, 버전 `6738e488ff5e`이며 전체 테스트 40개도 통과했다. 배포 범위는 그 검사에 통과한 정적 산출물뿐이다. critic의 T01/T02 재검토는 PASS이며 설정·배포 문서에서 미해결 지적은 없다.

원격 준비는 [T00 증거](../T00/README.md)를 따른다. 사용자 승인으로 PUBLIC 전환했고 Pages source는 workflow, HTTPS 활성화, 환경의 허용 브랜치는 main이다. 이 설정을 실제 게시 성공으로 간주하지 않는다.

## 다음 단계

사용자에게 구현·검증·독립 검토와 커밋을 제시해 merge 승인을 받는다. 승인 후 통합 및 수동 게시, 실제 URL 검증을 수행한다. 아이폰 Safari·홈 화면 결과는 T04에서 실제로 확인해야 한다.
