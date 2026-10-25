# BP 로고 일반판 게시 — 2026-10-25

- 기능 커밋: 69242b0, main 통합: 7bc45b85c7dc0753b0437616c8f28b845973fdce.
- main의 병행 문서 커밋으로 fast-forward 불가: 기존 문서 커밋을 보존하는 merge로 통합. 충돌 없음.
- main 통합 후 npm test: 종료 0, 453/453. npm run build:pages 및 npm run check:pages: 종료 0.
- 빌드: 706b9e7c229a.
- pages.yml, main, probes=false. build 19초, deploy 8초, success.
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40167560106
- 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 index.html, icons/bp-logo.png, styles.css, sw.js 모두 HTTP 200 및 로컬 dist와 바이트 일치 (published-files.json). 공개 HTML 빌드 706b9e7c229a 확인.
- 로컬 Chrome의 5개 폭·오프라인 재로드 검증 완료. 실제 iPhone 및 기존 홈 화면 앱의 SW 업데이트는 직접 확인하지 않음.
- CI에 기존 Actions Node 20 강제 Node 24 실행 및 ubuntu-latest 이미지 이행 안내가 표시됨. 작업과 무관한 workflow 수정은 없음.
