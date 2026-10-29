# 추출 시작 카드 선택 데모 — 2026-10-29

요청: 추출 기록 시작 시 원두·레시피를 제목 버튼 대신 카드 전체를 눌러 선택하는 화면을 우선 데모로 제공한다.

범위: `brew-picker-demo.html`의 독립 샘플. 실제 추출 시작 화면의 동작과 데이터 저장은 변경하지 않는다. 기존 기록 데모에서 새 데모로 이동할 수 있다. 원두 카드 → 레시피 카드 → 조합 확인을 제공하며, 검색·이전 단계·처음부터 다시 체험·미완성 레시피 선택 제한을 포함한다. 기존 원두 페이지의 배경색, 카드 테두리, hover 색을 따른다. 카드 하나는 native button 하나이며 제목·메타데이터·여백 모두 같은 선택 동작을 수행한다.

## 검증

- RED: `node --test test/pwa-build.test.mjs` 종료 1. 새 데모 파일이 배포 산출물에서 누락되어 예상 파일 목록 비교 실패 (`red-build-files.txt`).
- 첫 전체 검사에서는 예상 파일 목록 정렬 순서 오류 1건 발생. CSS → HTML → MJS로 정렬을 수정했다.
- Chrome/Playwright: 320, 390, 768, 1024, 1440px에서 카드 여백·조건 영역 클릭, 원두/레시피 검색, 빈 검색 결과, 미완성 레시피 disabled, Enter/Space 선택, 이전 단계, 재시작 통과. 가로 넘침과 console/page 오류 없음 (`browser-results.json`). 실제 렌더링은 `beans-1440.png`, `recipes-390.png` 확인.
- `npm run build:pages` 종료 0, 빌드 `9eb523bf70d8`.
- `npm run check:pages` 종료 0.
- 자체 리뷰: 실제 앱 흐름과 데이터 통신에 변경 없음. 텍스트는 textContent로 렌더링하고 단계 이동 시 제목에 포커스를 전달한다. 배포 허용 목록·콘텐츠 검사·SW 캐시·빌드 테스트에 새 파일 3개를 함께 반영했다.

## 확인 범위

브라우저 데모 상호작용을 확인했다. 실제 Notion 저장, iPhone Safari 및 홈 화면 설치 상태, 스크린 리더 실제 낭독은 확인하지 않았다.

- 최종 `npm test` 종료 0. 전체 결과는 `tests-summary.txt`에 기록했다.

## 통합 및 게시 완료

- 기능 커밋: `256ef598aa63a588d22570e485768df81f73a64b`, main fast-forward 통합.
- 통합 후 `npm test`: 종료 0, 638개 통과, 실패/건너뜀 0. 통합 빌드·산출물 검사도 종료 0.
- 일반판 게시: `gh workflow run pages.yml --ref main -f probes=false`.
- Actions: https://github.com/kangseokgyu/bean-pocket/actions/runs/40858085382 — build/deploy 성공.
- 공개 데모: https://kangseokgyu.github.io/bean-pocket/brew-picker-demo.html
- 공개 빌드: `9eb523bf70d8`. 2026-10-29 19:32 KST 공개 HTML/CSS/MJS/기록 데모/SW/메인 HTML 6개 HTTP 200 및 로컬 산출물 SHA-256 일치. 공개 Chrome에서도 원두 카드 여백 → 레시피 조건 영역 → 준비 완료 흐름 확인 (`public-result.json`).

## 후속 변경: 카드 가운데 구분선 제거

사용자 요청에 따라 `.card-detail`의 `border-top`만 삭제했다. 최신 main(기록 비교 데모 삭제 작업 포함)을 반영하여 `npm test` 631개 통과, 실패·건너뜀 0, 종료 0. `npm run build:pages`, `npm run check:pages`, `git diff --check` 통과. 자체 diff 리뷰로 카드 레이아웃과 클릭 동작은 그대로 유지됨을 확인했다.

기능 커밋 `b0c51754a3cb2a6cfc423bd758ccdf46be982e46`, 일반판 빌드 `0cd44a903339`. [Pages 실행 40864217519](https://github.com/kangseokgyu/bean-pocket/actions/runs/40864217519)의 통합 테스트·빌드·배포 성공. 공개 CSS HTTP 200 및 로컬 빌드와 일치. 공개 Chrome 390/1440px에서 원두·레시피 카드 모두 `borderTopWidth: 0px` 확인 (`no-divider-public.json`). iPhone 실기기는 미확인.

## 후속 변경: 원산지·로스터리·노트 간격 축소

사용자 요청에 따라 원산지 아래 여백 20px와 상세 정보 상하 padding 12px, 노트의 자동 상단 여백 및 padding 12px를 정리했다. 메타데이터 각 줄 사이를 4px로 통일하고 카드 하단 동작 문구에 자동 여백을 두어 정보가 한 묶음으로 보이도록 했다. 원두·레시피 카드의 공통 정보 스타일에 적용했다.

- 커밋 `c4994b999767b8284adb654f28a1de66880fe23f`를 main에 fast-forward 통합.
- `npm test` 종료 0: 631개 통과, 실패·건너뜀 0. `npm run build:pages`, `npm run check:pages`, `git diff --check` 종료 0.
- 자체 리뷰: CSS 네 규칙의 여백만 수정했으며 텍스트·선택 동작 변경 없음.
- 일반판 빌드 `f4f989abae57`, [Pages 실행 40865416477](https://github.com/kangseokgyu/bean-pocket/actions/runs/40865416477) 통합 테스트·빌드·배포 성공.
- 공개 https://kangseokgyu.github.io/bean-pocket/brew-picker-demo.html 에서 Chrome 320/390/768/1024/1440px의 원두·레시피 메타데이터 간격 각각 4px, 가로 넘침 없음, 카드 선택 및 준비 완료 흐름과 page 오류 없음 확인. 공개 CSS HTTP 200 및 로컬 빌드와 바이트 일치.
- 근거: `spacing-public.json`, `spacing-beans-390.png`. iPhone 실기기 미확인.

## 후속 변경: 카드 화살표 통일

사용자 피드백에 따라 원두·레시피 카드 우측 상단의 `↗`와 전용 `.arrow` 스타일을 제거했다. 선택 가능한 카드에는 하단 선택 문구의 `→` 하나만 남기고, 미완성 레시피에는 화살표를 표시하지 않는다. 자체 diff 리뷰로 데이터·선택 이벤트와 여백 설정은 유지됨을 확인했다.

- 기능 커밋 `a4eab9d0bd0a53a099864fa0f8bab0709f263bfb`, main fast-forward 통합.
- `npm test`: 631개 통과, 실패·건너뜀 0, 종료 0. `npm run build:pages`, `npm run check:pages`, `git diff --check` 통과.
- 일반판 빌드 `cb722a0bcf1a`, [Pages 실행 40865879585](https://github.com/kangseokgyu/bean-pocket/actions/runs/40865879585) 통합 검사·배포 성공.
- 공개 https://kangseokgyu.github.io/bean-pocket/brew-picker-demo.html Chrome 320/390/768/1024/1440px에서 카드 위쪽 화살표 없음, 선택 가능 카드당 하단 화살표 1개, 비활성 카드 0개, 가로 넘침 없음 확인. 카드 여백 클릭과 키보드 Enter 선택 및 준비 완료 화면 확인, page 오류 없음.
- 공개 CSS·MJS·메인 HTML HTTP 200, 로컬 빌드와 바이트 일치. 근거 `arrows-public.json`, `arrows-beans-390.png`. iPhone 실기기는 미확인.
