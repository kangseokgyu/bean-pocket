# 봉지 기능 제외 게시 확인

- 게시 완료: 2026-10-26 13:39:58 KST.
- 주소: https://kangseokgyu.github.io/bean-pocket/
- 게시 commit: `661bc791e76ffa1f45a22445a5a3f30d24a82caf`; 일반판 build `da92f2364938`.
- workflow: `pages.yml`, `workflow_dispatch`, main, `probes=false`.
- [실행 40270176908](https://github.com/kangseokgyu/bean-pocket/actions/runs/40270176908): build/deploy 모두 success.
- CI 전체 테스트 497/497 pass, fail/skip 0. Pages build/check 성공. [CI 원문](deployment-ci.txt), [실행 상태](deployment-run.json).
- 공개 HTTPS 20개 파일 모두 HTTP 200 및 로컬 dist 바이트 일치. index.html/sw.js의 빌드 표시도 검증 산출물과 같다. [파일별 SHA-256 대조](public-verification.json).
- Worker `gpt-6-luna/max`, Critic `gpt-6.1-sol/medium` 실제 생성 설정. 429/모델 대체 없음.

## 변경과 보존

봉지 메뉴·생성·삭제·새 기록의 봉지 연결을 제외했다. snapshot의 `bagless-v1` 기록만 표시·평가 집계한다. 기존 Notion 봉지/기록 원본과 5개 source 호환, 숨겨진 관계의 원두·레시피 삭제 보호를 유지한다. 동시 완료된 레시피 카드 클릭 개선도 통합해 보존했다.

## 확인하지 않은 범위

실제 Notion 쓰기, iPhone/Safari, 실제 OPFS/native lock 장애 복구 및 설치된 앱의 service worker 업데이트 적용은 직접 확인하지 않았다. Chrome 1280/390px 합성 데이터 검증과 자동 회귀 검증은 [Critic 보고서](critic-report.md)에 기록했다. 공개 파일 일치는 이미 실행 중인 iPhone 앱의 새 버전 적용을 의미하지 않는다.

CI의 action Node 20 종료 예정/runner image 안내는 비차단 경고였으며 이번 범위에서 workflow를 수정하지 않았다. 복귀가 필요하면 직전 성공 배포 commit `a1dcb789348a80368d4aa221ddddbfd873a29675`의 근거를 확인하고 관련 기능 변경만 되돌린 후 동일 검증·게시 절차를 따른다.
