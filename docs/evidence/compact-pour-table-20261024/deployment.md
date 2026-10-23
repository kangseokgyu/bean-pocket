# 게시 결과

- 배포 커밋: 7f46a770db765968d16c12c42fc6596ebf593daf (codex/compact-pour-table → main, fast-forward).
- main 통합 후 npm test 449/449, npm run build:pages, npm run check:pages 모두 종료 코드 0. main-*.log 참조.
- 일반판 workflow: pages.yml, ref=main, probes=false.
- 실행: https://github.com/kangseokgyu/bean-pocket/actions/runs/39991850595 — build / deploy 성공.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: 108bb1c0fc2d.
- index.html / ui/view.mjs / styles.css / manifest.webmanifest / sw.js / icons/icon-192.png 모두 HTTP 200이며 로컬 검증 산출물과 바이트 일치 (public.json).
- 새 Chromium 세션에서 공개 페이지의 버전 표시 확인, JS 실행 오류 없음 (public-390.png).
- GitHub Actions는 성공했으며 실행 중 상위 action의 Node 20 폐기 예고와 ubuntu-latest 이미지 이전 안내가 있었다. 이번 UI 변경 범위에서 workflow는 변경하지 않았다.
- 실제 iPhone Safari와 홈 화면 PWA의 기존 캐시 갱신·재실행, 실제 Notion 연결 데이터로의 실행은 미확인. 로컬 합성 데이터의 실제 브라우저 표 검증과 공개 산출물 반영 확인을 구분한다.
- 게시 이후 추가 커밋은 이 검증 증거 문서·스크립트·이미지만 포함하며 앱 빌드 입력은 변경하지 않는다.
