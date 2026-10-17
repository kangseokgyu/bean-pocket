# GitHub Pages 게시 준비 — T00

확인일: 2026-10-18 (Asia/Seoul). 기준 명세 커밋: `cc8bd76`.

## 최초 확인 결과

| 항목 | 실제 확인 결과 |
|---|---|
| 저장소 | `kangseokgyu/bean-pocket`, **PRIVATE** |
| 기본 브랜치 | `main` |
| 현재 작업 브랜치 | `codex/pages-first-implementation` |
| 게시 실행자 권한 | 현재 GitHub 인증 사용자의 저장소 권한 `ADMIN` |
| 현재 Pages | `GET /repos/kangseokgyu/bean-pocket/pages` → HTTP 404. 현재 계정으로 확인 가능한 사이트 설정 없음 |
| 계정 요금제 | `GET /user`의 `plan.name`이 null. 비공개 Pages 자격을 확인하지 못함 |
| 선택할 게시 소스 | GitHub Actions. 저장소 전체가 아닌 검사된 `dist/`만 업로드 |
| 프로젝트 하위 경로 | `/bean-pocket/` (예정 경로이며 실제 게시 확인 전) |
| 추가 비용·공개 전환 없이 게시 가능 여부 | **미확인**. 저장소는 비공개이며 요금제가 확인되지 않음 |

GitHub Free는 공개 저장소에 Pages를 제공한다. 비공개 저장소는 Pro 이상의 해당 요금제가 필요하다. [GitHub 공식 이용 조건](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)을 2026-10-18에 확인했다. 기존에 지원 요금제를 사용하고 있는지 확인하거나, 무료 계정이면 공개 전환에 대한 별도 결정이 필요하다. 공개·유료 전환은 수행하지 않았다.

최초 조사 시점에는 T00 **검증 대기**, T03 게시 및 M1 **차단**으로 판정했다. 이후 사용자 결정과 설정 결과는 아래에 기록한다.

## 사용자 결정 이후 최종 상태

사용자가 “무료 계정이며 저장소 공개 전환을 허용”이라고 명시했다. 이 승인으로 2026-10-18 저장소를 **PUBLIC**으로 전환했다. 별도 요금제 변경은 없다. 원격 Pages의 `build_type=workflow`, `https_enforced=true`를 확인했고 Actions는 활성화되어 있다. `github-pages` 환경은 `main` 브랜치만 허용한다.

전환 전 `HEAD`와 `origin/main`에서 접근 가능한 37개 blob을 검사했다. 점검한 자격증명 패턴과 로컬 비공개 설정값의 일치는 발견되지 않았다. 과거 비공개 식별자가 있던 별도 로컬 브랜치는 원격에 없고 push하지 않는다. 이 검사는 모든 형태의 비밀값 부재를 보증하는 전체 감사가 아니다.

T00 상태는 **완료**다. 무료 Pages 게시 조건과 필요한 원격 설정을 확인했다. API가 반환한 예정 주소는 `https://kangseokgyu.github.io/bean-pocket/`이며 사이트 상태는 아직 null이다. 실제 앱 게시 성공·접속 검증은 T03에서 수행한다. 미통합 기능 브랜치를 배포하지 않으며, T03은 사용자 merge 승인 대기다.

## 게시 전 설정

1. 비공개 저장소 Pages 자격 또는 사용자가 승인한 공개 범위를 확정한다.
2. 사용자에게 변경과 검증 결과를 제시하고 명시적인 merge 승인을 받는다.
3. 승인된 변경을 기본 브랜치에 통합한다. 현재 기능 브랜치의 커밋은 미통합 상태다.
4. Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정한다.
5. `github-pages` 환경의 배포 브랜치를 기본 브랜치로 제한한다. Actions 실행 허용과 `pages: write`, `id-token: write` 배포 권한을 확인한다.
6. 수동 워크플로로 첫 게시 후 실제 HTTPS URL 및 자원을 확인한다.

[GitHub 공식 custom workflow 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)를 기준으로 빌드·업로드와 배포 job을 구분한다. Notion 토큰·실제 데이터 소스 설정은 Actions에 전달하지 않는다.

## 변경 경계와 검증

사용자의 이번 요청에 따라 새 브랜치를 만들고 기존 수정 3개와 미추적 문서 7개만 명시적으로 선택해 `cc8bd76`에 커밋했다. `.env.local`을 포함한 무시 파일은 추가하지 않았다. 이후 작업은 같은 브랜치에서 목적별 커밋으로 남기며 merge는 별도 승인을 따른다.

- `npm test` 최초 실행: 종료 1, 29개 중 16개 통과·13개 실패. HTTP 테스트의 `listen EPERM`은 샌드박스의 로컬 포트 바인딩 제한이었다.
- 같은 코드에서 권한을 부여한 `npm test`: 종료 **0**, **29개 통과 / 0개 실패**, Node v22.17.0. 기존 기준 테스트는 정상이다.
- GitHub 인증도 샌드박스 내부에서는 keyring 접근 제한으로 실패했으나, 권한 부여 후 인증과 읽기 조회가 정상 실행됐다. 인증값은 기록하지 않는다.
- 상세 명령·종료 코드·미검증 범위: [T00 증거](evidence/T00/README.md).
