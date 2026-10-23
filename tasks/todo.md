# 항목 삭제 작업 체크리스트

- [x] 테스트 실행 방식과 기존 삭제/저널/화면 패턴 확인
- [x] SPEC.md와 PLAN.md의 삭제 제외 지침 및 범위 수정
- [x] 삭제 소속 검증·journal recovery 테스트 RED → 구현 → GREEN
- [x] 봉지/레시피 기록 의존성, 제외·모호 관계 보호 테스트 RED → 구현 → GREEN
- [x] 추출 기록 카드 삭제와 재조회·평가 집계 갱신 테스트
- [x] 카드 우상단 휴지통, 항목명 확인, 미저장 입력 보존 테스트
- [x] 레시피 부모만 휴지통 이동, 단계 보존, 목록/복사/기록 선택 제외 검증
- [x] 관련 테스트 및 `npm test`, `npm run build:pages`, `npm run check:pages` 실행
- [ ] 브라우저 상호작용 시나리오 (fake-only 앱은 로드했으나 시나리오는 실행하지 않음; Critic에게 미검증으로 인계)
- [x] `docs/evidence/entity-delete-20261023/` RED/GREEN과 검증 결과 기록
- [x] `codex/delete-bags-recipes-records` 기능 브랜치 확인; Critic 및 이후 통합·게시를 Orchestrator에 인계
