# 게시 확인

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `800042497a25`
- 기능 커밋 및 배포 대상: `05919314b2fe0d6af3883a99dec5d1b0cf0ff1ef`
- Actions: https://github.com/kangseokgyu/bean-pocket/actions/runs/40192016986
- `pages.yml`, main, `probes=false`: completed / success. 통합 후 회귀 테스트, 일반판 빌드, 산출물 검사, Pages 배포 통과. `gh run watch --exit-status` 종료 코드 0.
- 2026-10-25 KST 공개 파일 확인: `index.html`, `ui/view.mjs`, `styles.css`, `sw.js`, `manifest.webmanifest` HTTP 200. 캐시 우회 쿼리와 no-cache 요청으로 받은 파일 5개 모두 검증한 로컬 dist 파일과 바이트 일치. index.html의 빌드 버전도 확인. Python 검증 명령 종료 코드 0.
- Actions가 Node 20 action의 Node 24 강제 실행 및 ubuntu-latest 이미지 변경 안내를 출력했다. 이번 테스트·빌드·배포 실패 없음.
- 실제 사용자 Notion 데이터, iPhone Safari·설치 앱 터치 및 기존 실행 클라이언트의 SW 갱신은 직접 검증하지 않았다. 브라우저 동작은 합성 데이터 Chromium에서 검증했다.

롤백은 기능 변경을 되돌리는 별도 기능 브랜치에서 같은 필수 검증 후 main 통합 및 일반판 재게시하는 기존 절차를 따른다.
