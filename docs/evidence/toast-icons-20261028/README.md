# 토스트 로딩·완료 마이크로인터랙션 — 2026-10-28

- 요청: 저장 버튼과 같이 로딩→완료로 바뀌는 아이콘을 토스트 메시지 뒤에 표시한다.
- 변경: 기존 버튼의 회전 링·체크 SVG를 재사용한다. 저장/연결 확인 및 기본 조회 로딩에서 회전하고 saved/connected/resolved 상태는 체크가 220ms 동안 작게 확대되며 나타난다. 메시지 뒤에 아이콘을 배치하며 aria-hidden으로 중복 낭독을 방지한다.
- 오류·중립 안내에는 완료 체크를 표시하지 않는다. 저장 완료 뒤 목록 갱신 중에도 완료 체크를 유지한다. 토스트 위치·모달 배치·3초 자동 숨김 유지. 동작 줄이기 설정에서는 회전·확대 애니메이션을 끈다.
- TDD: 아이콘 전환 및 오류 초기화 테스트 2건이 구현 전 실패. 구현 후 화면 테스트 112개·전체 테스트 579개 통과. 일반판 build/check exit 0, 빌드 `0e880e3f04f8`.
- 격리된 Chromium·WebKit에서 실제 저장 버튼 클릭 후 mock submit을 통해 로딩→완료 확인. 각 320/390/768/1280px 및 390px 동작 줄이기, 총 10개 조합. CSS 회전/체크 전환, SVG, 메시지 뒤 순서, 버튼 겹침 없음, 자동 숨김, 가로 넘침·pageerror 없음 확인 (`toast-icons-browser.json`, 스크린샷). 로컬 서버 4199에서 `node browser.cjs`로 재현할 수 있다. 외부 Notion 저장은 호출하지 않는다.
- 자체 리뷰: 기존 버튼 아이콘 재사용·완료 상태 한정·오류 시 이전 체크 제거·타이머 및 ARIA 유지·모션 줄이기 확인. `git diff --check` 통과. 새 의존성 없음.
- 미검증: 실제 Notion 저장, 실기기 iPhone/소프트 키보드 및 스크린 리더 음성.

## 최신 main 반영

- 초기 통합 시 main에 삭제 확인 모달(`9baa67d`)이 추가되어 fast-forward가 불가능했다. 최신 main을 기능 브랜치에 정상 merge했고 충돌은 없었다. 삭제 모달의 토스트 억제·결과 보존 동작 유지 확인.
- merge 후 전체 테스트 587/587, build/check exit 0, 최종 제품 빌드 `0a50f2e5ab9f`. 두 브라우저의 10개 조합도 재검증 통과 (`merged-test-summary.txt`, `toast-icons-merged-*.txt`, `merged-browser.json`).

## 최종 게시 확인

- main 통합 후 전체 테스트 587/587, build/check exit 0 (`integrated-test-summary.txt`, `toast-icons-integrated-*.txt`). 제품 커밋 `6bc990ea03675326fba6002c833273bb442c8cbe`, 빌드 `0a50f2e5ab9f`.
- 일반판(`probes=false`) Pages 게시 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/40613554224
- 공개 주소 https://kangseokgyu.github.io/bean-pocket/ 의 파일 20개가 로컬 산출물과 모두 SHA-256 일치 (`toast-icons-public-files.json`).
- `node browser.cjs --public` exit 0: 공개 origin에서 공급된 UI·CSS 파일을 사용하는 격리된 fixture에서 mock 저장 버튼을 클릭했다. Chromium·WebKit 390px 모두 메시지 뒤 회전 아이콘→체크 확대 전환, 버튼 겹침 없음, 3초 자동 숨김, 가로 넘침·pageerror 없음 확인 (`toast-icons-public.json`, `public-complete.png`). 실제 연결 정보나 Notion 쓰기는 사용하지 않았다.
