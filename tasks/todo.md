# 항목 삭제 작업 체크리스트

- [x] 테스트 실행 방식과 기존 삭제/저널/화면 패턴 확인
- [x] SPEC.md와 PLAN.md의 삭제 제외 지침 및 범위 수정
- [x] 삭제 소속 검증·journal recovery 테스트 RED → 구현 → GREEN
- [x] 봉지/레시피 기록 의존성, 제외·모호 관계 보호 테스트 RED → 구현 → GREEN
- [x] 추출 기록 카드 삭제와 재조회·평가 집계 갱신 테스트
- [x] 카드 우상단 휴지통, 항목명 확인, 미저장 입력 보존 테스트
- [x] 레시피 부모만 휴지통 이동, 단계 보존, 목록/복사/기록 선택 제외 검증
- [x] 관련 테스트 및 `npm test`, `npm run build:pages`, `npm run check:pages` 실행
- [x] Critic의 fake-only 설치 Chrome 브라우저 상호작용 검증: 1280/390px 긴 이름 및 320px 짧은 이름, 삭제·차단·취소·평가·선택지 갱신·초안 보존·응답 유실 복구 확인 (메모리 저장소/lock adapter)
- [x] `docs/evidence/entity-delete-20261023/` RED/GREEN과 검증 결과 기록
- [x] `codex/delete-bags-recipes-records` 기능 브랜치 확인; Critic 및 이후 통합·게시를 Orchestrator에 인계

기존 제한: 320px 긴 이름은 기록 필터 select의 intrinsic 폭 때문에 main과 구현 모두 `scrollWidth=360`, `innerWidth=320`, 필터/목록 폭 338px로 넘친다. 이때 기록 휴지통 일부도 오른쪽 화면 밖에 놓인다. 390px 긴 이름과 320px 짧은 이름은 통과했다. 이번 마무리에서는 기존 레이아웃을 수정하지 않는다.

- [x] P3 조사 문구 세 곳 및 Orchestrator 요청 주체 정정, 공개용 Critic 근거 선별/민감정보 검사
- [x] 문구 변경 후 UI 49/49, 전체 448/448, Pages build/check 각 한 차례 통과; raw 로그 보관 (`45fc966c78bd`)

## 2026-10-26 봉지 기능 전체 제거 — worker 체크리스트

- [x] 기존 완료 체크리스트 확인; 이 작업 전용 계획·증거 경로 기록
- [x] 테스트를 먼저 갱신해 4개 DB 설정/조회, legacy 봉지 속성 무시, 봉지 전용 원두 추론 없음의 RED 증거 저장
- [x] PWA·Node 서버 모델, 속성, 설정, 조회, 생성/삭제 경로에서 봉지 제거; 기록 `bagless-v1`, 잠금·unknown/partial·복구 보존
- [x] 기록 기반 원두/레시피 삭제 보호와 미해결 기록 fail-closed 유지; 봉지 관계만 있는 원두 삭제 허용
- [x] 구형 봉지 입력·명령이 fake Notion 요청/PATCH 없이 거절되는 테스트 및 PWA/public 화면 회귀 확인
- [x] `.env.example`, README, SPEC, PLAN, 현재 DB 설정 안내 및 tasks 계획을 4개 DB 정책으로 정합화; 과거 evidence 변경 금지
- [x] 변경 관련 `node --test`, 전체 `npm test`, `npm run build:pages`, `npm run check:pages` GREEN 로그 보관
- [x] fake Notion 외부 쓰기 0건 확인; 브라우저 확인은 격리 실행 가능 여부를 기록하고 Critic에 인계
- [x] 변경 파일·dirty 상태·검증 증거와 미검증 범위를 요약하고 Orchestrator/Critic에 인계; merge/push/deploy 하지 않음

브라우저(fake Notion) 직접 상호작용과 독립 검토는 미완료이며 Critic 담당이다. merge/push/deploy와 공개 반영 확인은 Orchestrator 담당이다. worker 자동 검증: 508/508, Pages build/check exit 0, 산출물 버전 `b56bc1934364`. 상세: `docs/evidence/remove-bag-feature-20261026/verification.md`.
