# 홈 히어로 검증 기록

## 결과

- 집중 UI 테스트 `node --test --test-name-pattern='home is the default' test/pwa-ui.view.test.mjs`: 통과, 1/1.
- 전체 `npm test`: 통과, 610/610, 실패·건너뜀 0.
- `npm run build:pages`: 통과, 빌드 버전 `0b2385480db2`.
- `npm run check:pages`: 통과.
- 실제 브라우저에서 제작 코드의 `view.mjs`와 `styles.css`를 사용한 임시 미리보기 확인: 320, 390, 768, 1280px 모두 `documentScrollWidth`와 `bodyScrollWidth`가 뷰포트 너비와 같아 가로 overflow가 없다.
- 브라우저에서 `추출 시작` 클릭 후 해시 경로가 `#/brew/bean`으로 바뀌는 것을 확인했다.
- 스크린샷을 각 뷰포트에서 확인했다. 모바일은 그림이 텍스트·CTA 아래에 놓이고, 데스크톱은 두 열로 배치된다.

## 환경과 증거

- 원래 PWA 시작 화면은 이 브라우저에서 기기 저장소 초기화 단계에 머물렀다. 연결 파일이나 Notion 쓰기 없이, 제작 코드만 포함한 임시 정적 미리보기로 레이아웃과 CTA를 확인했다.
- 미리보기 파일: `/private/tmp/home-guide-hero-preview/pwa/hero-preview.html` (루프백 URL `http://127.0.0.1:4174/pwa/hero-preview.html`).
- 실행 로그: `home-guide-hero-npm-test.log`, `home-guide-hero-build-pages.log`, `home-guide-hero-check-pages.log`.
