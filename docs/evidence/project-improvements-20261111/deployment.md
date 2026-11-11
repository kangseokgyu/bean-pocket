# 게시 확인 — 2026-11-12 (Asia/Seoul)

- 게시 커밋: `ec4f7e1a82d9c22e68933a6c8afabf34a2e46342`
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `5627dbe9659f`
- 수동 일반판 게시 (`probes=false`): https://github.com/kangseokgyu/bean-pocket/actions/runs/43074778473 — success
- 새 main 검증 CI: https://github.com/kangseokgyu/bean-pocket/actions/runs/43074778198 — success
- Worker 최종 검증: npm test 802/802, npm run build:pages, npm run check:pages, Chromium 24/24 통과. 최종 독립 Critic PASS는 critic-final.md와 후속 보고서를 따른다.
- 공개 HTTPS 57개 파일을 no-cache 요청으로 읽어 검증한 dist 파일과 바이트 단위 비교: 모두 HTTP 200 및 일치. 파일별 SHA-256은 public-files.json.
- 기존 원본 체크아웃의 미커밋 pwa/styles.css는 보호했다. 원격 main의 최신 변경은 기능 브랜치에 통합했고 검증 후보를 origin/main에 fast-forward 반영했다. 원본 로컬 main/작업 파일은 갱신하지 않았다.
- 이번 검증은 모의 Notion Chromium 및 실제 공개 정적 산출물 검증이다. 실제 Notion 쓰기와 iPhone Safari/홈 화면 앱은 이번 작업에서 확인하지 않았다.
- 이 기록 추가는 문서 변경이며 제품 산출물과 공개 빌드에는 영향을 주지 않는다.
