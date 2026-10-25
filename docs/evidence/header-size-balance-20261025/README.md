# 로고·메뉴 크기 균형 — 2026-10-25

- 모바일: 로고 60×36 → 52×32px, 메뉴 글자 11 → 14px.
- 큰 화면: 로고 72×44 → 60×36px, 메뉴 글자 13 → 15px. 이미지 HTML 크기도 기본 CSS와 일치.
- 단순 표시 변경으로 별도 동작 테스트 추가 없이 기존 테스트와 실제 브라우저 검증 적용.
- npm test 종료 0: 453/453 통과. 로그: /tmp/header-balance-tests.log.
- npm run build:pages 및 npm run check:pages 종료 0. 빌드 d87265410fd9. 로그: /tmp/header-balance-build.log.
- 격리 Chrome/Playwright: 연결된 빈 데이터 UI로 320, 360, 390, 600, 601, 768, 1024, 1440px 확인. 모든 메뉴 높이 44px 이상, 로고·메뉴·설정 겹침 없음, 가로 넘침 없음, 콘솔 오류 없음. browser.json 및 mobile.png 참조.
- 최초 검사에서 연결 전 숨겨진 메뉴를 측정해 좌표 0으로 실패. 연결 상태 재현 후 전체 너비 검증 통과. 앱 코드 수정은 필요하지 않았음.
- 직접 코드 검토: 크기 선언과 HTML만 변경, 기존 object-fit·접근성 텍스트·터치 높이 유지. 새 의존성 없음.
- Chrome DevTools MCP 미제공으로 설치된 Chrome과 Playwright 사용. 실제 iPhone 및 기존 설치 클라이언트의 업데이트 반영은 미확인.
