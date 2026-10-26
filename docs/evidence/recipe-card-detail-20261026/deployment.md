# 게시 확인

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/#/recipes
- 빌드: `be824830580f`
- 기능 커밋 및 배포 대상: `a1dcb789348a80368d4aa221ddddbfd873a29675`
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40266590353
- main / `pages.yml` / `probes=false`: completed / success. 통합 후 회귀 테스트·일반판 빌드·산출물 검사·배포 성공. `gh run watch --exit-status` 종료 코드 0.
- `public-verification.json`: 공개 HTML·CSS·UI 모듈·SW·manifest HTTP 200, 검증 dist와 바이트 일치. HTML 새 빌드 버전 확인. 캐시 우회 쿼리와 no-cache 요청을 사용한 Python urllib 검증 종료 코드 0.
- 기존 Actions Node 20→24 실행 및 ubuntu-latest 이미지 변경 안내가 출력됐으며 실패 없음.
- 실제 iPhone Safari·설치 앱·기존 클라이언트 SW 갱신 및 실제 Notion 데이터 조작은 미검증. 실제 Chromium의 합성 데이터와 터치 에뮬레이션으로 UI 동작을 확인했다.

문제 시 기능 변경만 별도 브랜치에서 되돌린 후 기존 필수 검증과 일반판 게시 절차를 따른다.
