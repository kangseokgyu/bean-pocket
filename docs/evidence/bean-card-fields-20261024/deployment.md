# 게시 결과

- 배포 커밋: 221ecb6fec502d21690474f1deaae50257f1bb54 (codex/bean-card-fields → main, fast-forward).
- 일반판 workflow: pages.yml, ref=main, probes=false.
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/40099615057 — build / deploy 성공.
- main 통합 후 CI에서 npm test 451/451, npm run build:pages, npm run check:pages 통과. 실행 원문은 해당 Actions 로그 및 /tmp/bean-card-ci.log 참조.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: e450b7ab5b62.
- index.html, ui/view.mjs, styles.css, manifest.webmanifest, sw.js, icons/icon-192.png: HTTP 200 및 로컬 산출물과 바이트 일치. public.json 참조.
- 새 독립 Chromium에서 공개 버전 표시 및 페이지 실행 오류 없음 확인. public-390.png 참조.
- 320/375/390/768/1440px 카드 fixture 검증 통과. 실제 iPhone과 기존 PWA 캐시 갱신, 실제 Notion 데이터 연결 실행은 미검증.
- Actions의 기존 Node 20 폐기 예고 및 ubuntu-latest 이전 안내는 이번 UI 변경 범위 밖으로 유지.
- 이 게시 이후 문서·검증 근거 커밋은 앱 빌드 입력을 변경하지 않음.
