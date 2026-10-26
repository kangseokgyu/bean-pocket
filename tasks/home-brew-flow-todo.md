# 홈 화면 및 추출 시작 플로우 작업 체크리스트

- [x] RED: 홈 기본 경로·메뉴·추출 선택/안내·기록 prefill 회귀 테스트를 먼저 작성하고 실패 로그 보관
- [x] 홈 기본 라우트(`/`, `/home`), 히어로와 네 메뉴 구현
- [x] 원두 선택, 검색·페이지네이션, 빈 목록 등록 안내·복귀 구현
- [x] 레시피 선택, 선택 원두 검증, 검색·페이지네이션·선택 보존 구현
- [x] 추출 안내에 주요 조건·붓기 표·추출 가이드 표시; 타이머 자동진행 제외
- [x] 추출 완료 후 원두·레시피·오늘 날짜가 채워진 기존 기록 폼 연결
- [x] 직접 URL·새로고침·누락 parent/recipe·관계 불일치·뒤로가기 검증
- [x] 기존 draft·연결 변경·journal/lock/unknown 중복방지 및 명시적 `/beans` 테스트 유지
- [x] GREEN 로그 및 필요한 테스트 하네스 경로 수정 기록
- [x] `npm test` 통과 (545 pass, 0 fail/cancel)
- [x] `npm run build:pages` 통과
- [x] `npm run check:pages` 통과
- [x] 브라우저 흐름 확인 가능성 점검 (Mac 잠금으로 브라우저 자동화 불가; 미검증으로 기록)
- [x] Critic 검토용 diff·로그·요약 준비; merge/push/게시 인계

증거 및 인계 요약: `docs/evidence/home-brew-flow-20261027/summary.md`
