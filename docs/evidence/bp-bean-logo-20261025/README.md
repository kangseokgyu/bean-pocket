# BP 원두 로고 — 2026-10-25

- 헤더 BEAN POCKET 텍스트를 투명 PNG BP 로고로 교체. 생성 도구: built-in image_gen.
- 생성 프롬프트: Use case: logo-brand. Asset type: compact mobile app header logo for Bean Pocket, a coffee journal. Primary request: Create exactly the two uppercase letters "BP" as one handsome, highly legible monogram, with the rounded strokes formed like roasted coffee beans and a subtle curved coffee-bean split in each letter. Flat elegant graphic logo, solid deep espresso brown, organic rounded bold letterforms, crisp edges, minimal detail so legible at 42px tall. Horizontally arranged B then P, balanced proportions about 1.6:1. Isolated on a genuinely transparent background with tight framing and minimal outer padding. No additional text, no tagline, no surrounding badge, no cup, no drop shadow, no photorealism, no mockup. Text verbatim: "BP".
- 생성 PNG의 투명 여백 정리·288×170 리사이즈, 알파 보존. 최종 pwa/icons/bp-logo.png (37,954 bytes).
- 로고를 배포 허용 목록, 버전 해시, SW 캐시에 포함. 대체 텍스트 Bean Pocket 제공.
- 테스트 선행: 새 로고 산출물 미공급으로 실패 확인 (red.log). 첫 구현은 SW와 검사기의 배열 순서 불일치로 실패, 목록 순서를 일치시켜 해결.
- npm test: 종료 0, 453/453 통과 (tests.log).
- npm run build:pages, npm run check:pages: 종료 0. 빌드 706b9e7c229a.
- 격리 Chrome/Playwright: 320, 390, 768, 1024, 1440px 로고 로드·대체 텍스트·가로 넘침 없음·콘솔 오류 없음·오프라인 재로드 통과 (browser.json, mobile.png).
- Playwright 기본 Chromium 미설치로 첫 실행 불가. 설치된 Chrome의 임시 프로필 사용으로 검증 완료.
- 직접 변경 검토: 상대 경로, 이미지 종횡비, 접근성, 캐시·해시 반영 및 기존 허용 목록 유지 확인. 새 의존성 없음.
- 실제 iPhone 및 기존 설치 클라이언트의 서비스워커 업데이트는 미확인.
