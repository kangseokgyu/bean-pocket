# UI 리팩터링 브라우저 검증

기능과 UI를 보존하는지 확인하기 위한 Chromium 기준 기록이다. 운영 Notion에 접근하지 않는다. 실제 View·Controller·Notion 어댑터·Command·Submission State·Connection File을 메모리 저장소와 모의 Notion API에 연결한다.

## 기준 결과

- 소스 커밋은 `0e0c2f36466b9d65b9fd70051fe911610eeb9061`이다.
- `node verify.mjs baseline`이 종료 코드 0으로 완료됐다. 결과는 [baseline/results.json](baseline/results.json)에 있다.
- 390px와 1280px에서 홈, 원두 목록·상세, 레시피 목록·상세, 기록 목록, 추출 원두 선택·레시피 선택·진행 화면 18개를 기록했다.
- 원두·레시피 폼의 입력 중 재렌더링에서 Dialog 노드, 입력값, 포커스를 확인했다. 취소 후 모의 API 쓰기 수와 journal이 바뀌지 않았음을 확인했다.
- UI를 통한 즐겨찾기 토글을 확인했다. 총 검증 항목은 21개다.

## 비교 방법

서로 다른 원본·후보 체크아웃을 준비한다. 별도 터미널에서 다음 명령으로 로컬 서버를 시작한다.

```sh
node server.mjs /absolute/baseline/checkout /absolute/candidate/checkout
```

검증 스크립트는 Playwright와 Chromium이 필요하다. `PLAYWRIGHT_MODULE`과 `CHROME_EXECUTABLE` 환경 변수로 설치 경로를 지정할 수 있다. 이 저장소에 브라우저 패키지를 추가하지 않는다.

```sh
node verify.mjs baseline
node verify.mjs candidate
```

결과 기본 경로는 `/tmp/bean-pocket-refactor-browser`다. `BEAN_BROWSER_RESULTS`로 변경할 수 있다. 후보 검증은 기준의 각 `#app-root` DOM과 정확히 비교하고, 스크린샷 해시를 기록한다. 기준 URL과 후보 URL의 경로 접두사만 정규화한다. 레이아웃·문구·버튼 상태를 정규화해 숨기지 않는다.

## 검증 환경에서 수정한 가정

최초 21개 검증은 통과했으나, 지연 조회 완료를 기다리는 조건을 추가한 실행은 시간 초과로 실패했다. 모든 객체의 `loading`·`checking` 값을 기다린 것이 원인이었다. 레시피 목록의 통계는 상세 화면에 들어갈 때 조회하므로 목록에서 `loading` 상태가 남을 수 있다. 대기 조건을 현재 화면이 실제 수행하는 조회로 한정한 뒤 기준 21개가 통과했다. 제품 코드는 수정하지 않았다. 목록 상태를 바꾸어 검증을 통과시키지 않았다.

## 확인 범위

이 검증은 Chromium의 모의 데이터 UI 결과다. 실제 Notion 저장, iPhone Safari, 홈 화면 PWA, 다중 탭 Service Worker 업데이트를 실행했다는 의미가 아니다. Node 테스트 및 공개 배포 파일 검증은 별도 기록으로 확인한다.

## R1 및 R2/R3-A 비교 결과

R1 커밋 `7c87aad`의 [비교 결과](r1-results.json)는 21개 시나리오가 통과했다. 화면 18개의 DOM과 스크린샷 해시가 같았고 View 메서드 30개와 Controller 메서드 16개의 목록이 일치했다.

R2/R3-A 비교에는 원두 저장 응답을 모의 API에서 지연시키는 시나리오를 추가했다. 버튼의 `aria-busy` 표시, 진행 토스트 중복 억제, 재제출의 쓰기 방지와 저장한 원두의 목록 표시를 확인한다. 이 검증을 추가한 [기준](baseline/results.json)과 `ae53081`의 [후보](r2a-verified-results.json) 모두 22개 시나리오가 통과했다. HTML 속성 순서만 제외한 화면 DOM은 18개 모두 일치했다. [픽셀 비교](r2a-pixels.json)에서 16개 스크린샷은 같았다. 기록 화면의 두 스크린샷은 각각 드롭다운 화살표 다섯 곳의 190픽셀이 달랐다. 화면 크기와 DOM은 같았다.

공개 기준 버전 `214f2f1363ed`에서 [Chromium 오프라인 재실행](public-browser-baseline.json)을 확인했다. Service Worker 캐시의 정적 파일 26개가 공개 파일과 일치했다. 이는 리팩터링 후보의 배포 결과가 아니다.

픽셀 비교는 `node compare-pixels.mjs /absolute/baseline/screenshots /absolute/candidate/screenshots`로 실행한다. 필요하면 `PNGJS_MODULE`에 설치 경로를 지정한다.

R3 커밋 `44d1e78`에서 [브라우저 비교 22개](r3-results.json)가 통과했다. 화면 DOM은 18개 모두 일치했다. [픽셀 비교](r3-pixels.json)는 R2/R3-A와 같은 두 기록 화면의 드롭다운 화살표 차이만 기록했다.
