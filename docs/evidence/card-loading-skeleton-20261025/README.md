# 카드 스켈레톤 로딩 — 2026-10-25

- 첫 데이터 조회 동안 카드 3개의 제목·메타데이터·버튼 자리 표시자를 표시한다. 기존 전체 화면 로딩 상태·입력 잠금·접근성 안내는 유지한다.
- 실제 데이터 도착, 연결 없음, 초기화 오류·재시도 대기, 조회 실패 후 pending 종료 시 제거한다. 기존 데이터 재조회는 실제 카드를 유지한다.
- 테스트 선행: `red.txt`의 새 테스트 5개가 스켈레톤 부재로 실패한 뒤 구현했다.
- `npm test`: 476/476 통과, 종료 코드 0 (`tests.txt`). `npm run build:pages`, `npm run check:pages`: 종료 코드 0, 빌드 `8d12f122a778`.
- 실제 Chromium: 320/390/768/1024/1440px, 카드 3개 표시, 가로 넘침 없음, reduced-motion 애니메이션 없음, 데이터 도착 후 스켈레톤·오버레이 제거, pageerror 없음 (`browser.json`, `loading-*.png`). 390px 스크린샷 시각 검토 완료.
- 코드 검토: 상태 갱신 순서, 연결 및 오류 종료, 기존 데이터 보존, 장식 요소 aria-hidden·비상호작용, 기존 스타일 재사용, 데이터/통신/저장 변경 없음 확인. 하위 에이전트를 사용하지 않은 소규모 변경이다.
- 실제 Notion 연결/저장, iPhone Safari 및 설치 앱은 검증하지 않았다.
- 회귀 시 이번 기능 커밋만 revert한 뒤 동일 검사 및 pages.yml 일반판 재게시한다.

## 통합 및 공개 반영

- 기능 커밋 `106b6e2`, main 통합 커밋 `7e2858306e2982fa3865439057705109c6b424dd`. 기능 분기 뒤 추가된 main의 기존 배포 문서 커밋을 보존하기 위해 fast-forward 대신 merge commit을 사용했다.
- main `npm test` 476/476 통과 (`main-tests.txt`), 일반판 빌드·검사 통과, 빌드 `8d12f122a778`.
- `pages.yml`, `probes=false`: 실행 [40172301029](https://github.com/kangseokgyu/bean-pocket/actions/runs/40172301029), build/deploy 성공 (`deploy.json`).
- 공개 주소 https://kangseokgyu.github.io/bean-pocket/ 에서 빌드 `8d12f122a778` 표시, 스켈레톤 요소 존재 및 연결 확인 종료 후 숨김, 페이지 오류 없음 확인.
- HTML, view 모듈, CSS, SW, manifest 등 9개 공개 파일 HTTP 200 및 로컬 빌드와 바이트 일치 (`public.json`, `public-390.png`).
- 실제 Notion 데이터 조회·저장 및 iPhone 실기기는 미검증이다. 공개 확인은 저장된 연결이 없는 별도 Chromium 세션에서 수행했다.
