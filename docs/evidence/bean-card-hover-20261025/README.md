# 원두 카드 호버 효과 — 2026-10-25

원두 카드에 포인터 커서와 연한 초록 배경·테두리 효과를 추가했다. 마우스 환경 `(hover: hover) and (pointer: fine)`에서만 색상을 150ms 동안 전환하며, 모션 줄이기 설정에서는 전환을 끈다.

검증 명령과 결과:

- `browser-check.cjs`: 구현 전 `browser-red.txt`에서 배경색이 변하지 않아 의도한 assertion 실패, 종료 코드 1. 구현 후 `browser-green.txt`, `browser.json`에서 Chromium 320/390/768/1024/1440px 호버 배경·테두리 변화, 포인터, 호버 해제 원복, 모션 줄이기 transition 0s, 클릭·여백 클릭·키보드·삭제 분리·가로 넘침·pageerror 검사를 통과했다. 터치 환경 호버 미적용과 탭 이동도 통과. 종료 코드 0.
- `npm test`: `test.txt`, 478 통과, 실패·skip 0, 종료 코드 0.
- `npm run build:pages`: `build.txt`, 빌드 `55045ce69d65`, 종료 코드 0.
- `npm run check:pages`: `check.txt`, 통과, 종료 코드 0.
- `hover-*.png`: 실제 Chromium 호버 스크린샷. 390px 이미지를 직접 열어 색상과 레이아웃 확인.

메인 에이전트 자체 검토: CSS만 수정하며 기존 카드 라우팅·삭제 버튼·포커스 처리를 보존한다. 레이아웃을 움직이지 않는 색상 전환으로 범위를 제한했다. 새 의존성·데이터 변경 없음. 차단 사항 없음. 작은 표시 변경이므로 서브에이전트를 구성하지 않았다.

실제 iPhone Safari 및 설치 앱은 미검증. 게시 결과는 deployment.md에 기록한다.
