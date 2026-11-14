# 기록 필터 공간 축소

- 제목과 필드 라벨은 접근성 이름으로 유지하고 시각적으로 숨김. 선택 버튼 두 개와 활성 조건의 초기화를 한 줄로 배치.
- 초기화는 조건이 없는 초기 화면과 초기화 직후 숨김. 기존 검색 선택 인터페이스 유지.
- 테스트 선행: 초기 상태 및 초기화 후 hidden 검사 실패 확인. 테스트 DOM이 classList를 제공하지 않아 className으로 구현 수정.
- 최종 `npm test`: exit 0, 814/814 통과 (`/tmp/compact-filters-final-test.log`). 초기 병행 실행의 로그 충돌 때문에 별도 최종 로그로 결과 확정.
- `npm run build:pages`, `npm run check:pages`: exit 0. 빌드 `8dda0ee2e45b`.
- Chrome/Playwright: 320/390/768px에서 필터 높이 44px, 버튼 같은 행, 화면 가로 넘침 없음. 320px 긴 이름 말줄임과 선택/초기화 확인.
- 브라우저 harness의 검색 목록 공급이 로딩 상태에서 지연되어 고정 원두 데이터를 view.setSearchOptions로 공급해 UI 조작을 검증함. 실제 Notion 검색 통합 및 iPhone Safari/설치 PWA는 미검증.
- 기존 작업 폴더의 미커밋 pwa/styles.css는 포함하거나 수정하지 않음.
