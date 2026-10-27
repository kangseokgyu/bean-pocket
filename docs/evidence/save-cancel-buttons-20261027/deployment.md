# 게시 확인 — 2026-10-27

- 기능 커밋 및 배포 main: `198a369fe7ab47478f58f4efded209b7e885115b`.
- `codex/save-cancel-buttons` 기능 워크트리에서 구현하고 Critic 승인 후 clean main에 fast-forward 통합했다.
- 통합 후 `npm test`: exit 0, 575/575 (`integrated-test.txt`).
- 통합 후 `npm run build:pages` / `npm run check:pages`: exit 0 (`integrated-build.txt`, `integrated-check.txt`).
- 일반판 `probes=false` 수동 게시: [Actions 40503649835](https://github.com/kangseokgyu/bean-pocket/actions/runs/40503649835), `completed/success` (`deployment-result.json`, `deployment-watch.txt`).
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `df39b205d8b3`.
- 공개 HTTPS 파일 20개 전부 HTTP 200 및 로컬 최종 dist와 SHA-256 일치 (`public-files.json`).
- 격리 Chrome에서 공개 사이트 320/390/1280px 연결 설정 확인: 저장·취소 44px 높이·14px 글자·아이콘, 취소 시 닫힘, 가로 넘침 없음, pageerror 및 자원 오류 없음 (`public-browser.json`, `public-settings-*.png`).
- 최초 공개 브라우저 확인은 연결 설정이 자동으로 열린 상태에서 뒤의 설정 버튼을 다시 누르려 해 timeout으로 실패했다. 이미 열린 상태를 다루도록 검증 스크립트만 수정하고 재실행해 세 너비 모두 통과했다. 제품 수정은 없었다.
- 실제 Notion 데이터 쓰기, iPhone/Safari 실기기, 기존 설치 PWA 업데이트 적용은 미실행이다. 개별 폼의 모든 입력·실패 조합을 브라우저에서 전수 검증한 것은 아니며 공통 경로·단위 테스트·대표 브라우저 흐름으로 검증했다.
- 관리 워크트리 정리는 앱에서 primary checkout 제거 불가로 거부되어 보존했다. 기능 브랜치와 main은 push 완료했다.

이 기록의 후속 커밋은 검증 문서·스크립트·캡처만 포함하고 앱 소스 및 빌드를 변경하지 않는다.
