# 게시 확인

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 빌드: `55045ce69d65`
- 배포 커밋: `4dc5d544c134a3eb9b7aae82a3a1355093e3ab3d`
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40192445886
- main, `pages.yml`, `probes=false`, completed / success. 통합 후 테스트·빌드·산출물 검사·배포 통과. `gh run watch --exit-status` 종료 코드 0.
- `public-verification.json`: 공개 HTML·CSS·UI 모듈·SW·manifest HTTP 200 및 검증 dist와 바이트 일치, HTML의 새 빌드 버전 확인. Python urllib 검증 종료 코드 0.
- 기존 Actions 런타임 Node 20→24 안내와 ubuntu-latest 이미지 변경 안내가 있으며 실패 없음.
- 실제 iPhone Safari·설치 앱 및 기존 클라이언트 SW 갱신은 미검증. 터치는 Chromium 에뮬레이션 검증.

문제 시 기능 변경만 별도 브랜치에서 되돌려 기존 필수 검증 및 일반판 재게시 절차를 따른다.
