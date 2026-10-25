# BP 탭 아이콘 — 2026-10-25

- 기존 BP PNG에서 종횡비를 보존해 32×32 favicon-bp.png (1,401 bytes)를 생성했다. 기존 페이지 색상의 여백으로 밝거나 어두운 브라우저 탭에서 글자가 구분된다.
- index.html의 rel=icon을 새 파일로 연결하고 빌드·버전 해시·SW 캐시 허용 목록에 포함했다.
- 전체 테스트 453/453, npm run build:pages 및 npm run check:pages 종료 0. 빌드 f3afc64a9f4e.
- Chrome 임시 프로필에서 favicon 링크·HTTP 200·32×32 PNG·SW 캐시 포함 및 오프라인 재로드 확인 (browser.json).
- 변경 검토: 상대 경로·실제 크기·배포 공급·캐시 일치 확인. 이미지 생성 호출 없이 기존 BP 이미지로 크기 조정했다. 새로운 의존성 없음.
- Chrome 탭 바 자체 및 실제 iPhone에서는 미확인.
