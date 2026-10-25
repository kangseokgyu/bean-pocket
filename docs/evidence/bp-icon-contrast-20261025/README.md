# 탭 아이콘 배경 대비 — 2026-10-25

- 기존 32px PNG의 중앙 픽셀 [0,0,0,0], alpha 최솟값 0: 투명 영역에 브라우저 탭 색상이 비쳐 로고 대비가 낮아질 수 있었다.
- image_gen 내장 편집으로 기존 BP 로고에 밝은 아이보리 배경을 채우고 32×32 PNG로 축소했다. 최종 pwa/icons/favicon-bp-ivory.png. 모든 픽셀 alpha 255 확인, 좌상단 [254,248,237,255].
- 프롬프트: Edit target: provided Bean Pocket BP coffee-bean logo. Change ONLY background: composite the exact unchanged dark espresso brown BP mark on a solid opaque very light ivory background (#FFF9ED). Fill all formerly transparent pixels, including the curved bean splits inside letters, with the same very light ivory. Preserve exact letter shapes and color. Make a square favicon graphic with the mark centered, occupying about 90% of width, aspect ratio of lettering preserved. Flat plain background, no gradients, no shadows, no texture, no new elements, no text beyond existing BP. High contrast background and brown mark. Entire output must be opaque.
- favicon 파일명을 바꾸고 HTML·빌드 허용 목록·SW 캐시·검사 및 fixture를 동기화해 이전 favicon 캐시와 경로를 분리했다.
- npm test: 종료 0, 471/471. npm run build:pages 및 npm run check:pages: 종료 0. 빌드 31b5ed298ffa.
- 첫 빌드는 dist의 구 favicon 파일이 허용 목록 밖 파일로 남아 실패했다. 구 산출물 1개만 제거한 뒤 빌드·검사 성공.
- 임시 Chrome 프로필에서 새 favicon 경로·HTTP 200·실제 32×32 PNG·SW 캐시 포함·오프라인 재로드 및 콘솔 오류 없음 확인 (browser.json).
- 변경 검토: 헤더 원본 로고 보존, 새 경로 전체 일치, 상대 경로와 불투명 이미지 확인. 새 의존성 없음.
- 실제 브라우저 탭 바 표시 및 iPhone에서는 미확인.
