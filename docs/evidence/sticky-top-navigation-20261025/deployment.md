# 일반판 게시 결과

- 변경 커밋: `e2cfa1d7c1c0e52ce34479239edf0b3ae0d70455`
- main 통합 후 `npm test` 452/452, `npm run build:pages`, `npm run check:pages` 모두 종료 0.
- 빌드: `664d5b995172`
- 수동 실행: `pages.yml`, `main`, `probes=false`
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40166246341
- 게시 주소: https://kangseokgyu.github.io/bean-pocket/
- 실행 결과: success. build 20초, deploy 10초.
- 공개 반영 확인: index.html의 빌드 `664d5b995172` 확인. index.html, styles.css, ui/view.mjs, sw.js, manifest.webmanifest 모두 HTTP 200이며 로컬 dist와 바이트 일치. 상세는 published-files.json.
- 실제 iPhone·홈 화면 앱 및 사용자의 기존 서비스워커 클라이언트 갱신은 미검증.
