# 추출 기록 비교 데모 검증

## 변경

- 원두 3종·추출 기록 12건의 가상 데이터를 사용하는 독립 데모 화면을 추가했다.
- 원두별 최고 평가 추출과 날짜·로스팅 후 경과일·레시피·분쇄·온도·도징·물·시간·컵노트를 보여준다.
- 레시피 필터, 날짜/평가 정렬, 빈 상태, 좁은 화면의 기록 카드를 제공한다.
- 기존 기록 화면에 진입 링크를 추가하고 Pages 허용 목록·보안 검사·서비스 워커 프리캐시에 데모 자산을 포함했다.
- 실제 기록·Notion 연결·저장 동작을 사용하지 않는다. 설계 계약은 `spec.md`에 기록했다.

## 실행 결과 (2026-10-29 KST)

| 명령 | 종료 코드 | 결과 | 원문 |
| --- | --- | --- | --- |
| `node --test test/pwa-records-demo.test.mjs` (별 표시 수정 전) | 1 | 5 통과, 1 실패. 3점도 별 다섯 개 표시를 재현 | `rating-red.txt` |
| `node --test test/pwa-records-demo.test.mjs test/pwa-build.test.mjs` | 0 | 20/20 통과 | `focused-green.txt` |
| `npm test` (샌드박스) | 1 | 601/616 통과. HTTP 15개가 `listen EPERM 127.0.0.1`로 실패 | `test-sandbox-failure.txt` |
| `npm test` (로컬 리스닝 허용, 수정 전) | 0 | 616/616 통과 | `test-before-rating-fix.txt` |
| `npm test` (로컬 리스닝 허용, 최종 소스) | 0 | 617/617 통과 | `test.txt` |
| `npm run build:pages` | 0 | 빌드 `2e20301486b6` 생성 | `build.txt` |
| `npm run check:pages` | 0 | Pages 산출물 검사 통과 | `check.txt` |
| `node docs/evidence/brew-record-demo-20261028/browser-validation.cjs` | 0 | 아래 Chrome 검증 통과 | `browser.txt` |

최초 계산·빌드 테스트의 RED 결과는 `test-red.md`를 참고한다. 최종 검사 이후 앱 소스 변경은 없다.

## Chrome 검증

로컬 `http://127.0.0.1:4188/bean-pocket/records-demo.html`에서 확인했다.

- 320, 768, 1024, 1440 px에서 가로 넘침 없음.
- 원두 요약 3종, 최고 평가와 상세 조건, 키보드 Enter 원두 선택 확인.
- 콜롬비아 우일라 선택 후 칼리타 필터 2건, 평가 내림차순 첫 기록 5점 확인.
- 에어로프레스 필터 빈 상태, 날짜 오름차순 첫 기록 2026-10-11 확인.
- 320 px에서 비교 표 대신 4개 기록 카드와 조건·컵노트 표시 확인.
- 콘솔 오류·페이지 오류·실패 응답·외부 요청 없음. 로컬 자원 요청 5건.
- `screen-320.png`, `screen-768.png`, `screen-1024.png`, `screen-1440.png`에 캡처 보관. Chrome 전체 페이지 캡처의 스티칭 오류를 피하기 위해 viewport 캡처를 사용했다.

## 범위와 인수인계

- Worker 최초 설정 `gpt-6-luna` / `max`가 사용량 제한으로 중단되어 허용된 대체 Worker `gpt-6.1-sol` / `medium`으로 전체 검증·별 표시 수정·증거 정리·커밋을 마쳤다.
- 이 증거는 로컬 데모와 빌드 검증이다. 실제 Notion 데이터 통합, Safari/Firefox, 공개 게시 후 반영 확인은 이 단계에서 검증하지 않았다.
- 독립 Critic 검토, main 통합, push, GitHub Pages 게시 및 공개 버전 확인은 Orchestrator가 이어서 수행한다.
