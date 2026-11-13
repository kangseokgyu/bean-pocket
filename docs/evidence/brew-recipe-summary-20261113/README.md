# 추출 레시피 요약 — 2026-11-13

레시피 선택 후 추출 준비 화면에 원두량, 물 온도, 단계별 이름·시간·물 양을 표시한다. 편집 영역이 접혀 있어도 요약은 보이며 조건 변경, 단계 추가·삭제, 초안 복구를 반영한다. 기록 재추출은 기록의 스냅샷을 사용한다.

Worker 생성 설정: `gpt-6.1-terra` / `max` (Chandrasekhar). Critic 생성 설정: `gpt-6.1-sol` / `medium` (Hilbert). 프로젝트 `AGENTS.md`의 Worker 기본값도 사용자 요청에 따라 변경했다.

## 검증

- `red.tap`: 구현 전 새 요구사항 테스트 실패 확인.
- `green.tap`: 구현 후 집중 테스트 통과.
- `npm test`: 812개 통과, 종료 코드 0 (`npm-test.log`).
- `npm run test:browser`: 24건 통과, 종료 코드 0 (`browser.log`).
- `npm run build:pages`, `npm run check:pages`: 통과, 종료 코드 0 (`build.log`, `check.log`).
- 최종 일반판 빌드: `93e1a8758660`.
- `brew-run-390.png`: 모바일 너비 추출 준비 화면.

실제 iPhone Safari 및 홈 화면 설치 실행은 확인하지 않았다. 원본 작업 폴더의 기존 CSS 변경은 이번 변경에 포함하지 않았다.

## 독립 검토

Critic 승인: 차단 지적 없음. 관련 테스트 3/3 및 diff 검사 통과. 390px 화면, 전체 테스트·브라우저·빌드 로그 확인. 전체 검증의 불필요한 재실행은 하지 않았다.

## 게시 완료

- 게시 커밋: `23fcc8cecbbe48038c326bf4b1f463c23e748bb6`.
- [Pages 실행 43444537019](https://github.com/kangseokgyu/bean-pocket/actions/runs/43444537019): 성공. `probes=false`, main 통합 테스트·빌드·검사 및 배포 통과.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드 `93e1a8758660` 확인. `index.html`, `ui/screens/brew.mjs`, `styles.css` 모두 HTTP 200 및 검증한 dist와 바이트 일치 (`public.json`).
- 기존 사용자 CSS diff는 통합 전후 Git blob 식별자를 제외하고 동일함을 확인했다.
