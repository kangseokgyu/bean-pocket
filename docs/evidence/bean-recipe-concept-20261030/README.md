# 원두 화면 컨셉 통일 검증

사용자의 목표는 원두 화면을 레시피와 비슷한 컨셉으로 맞추는 것이다. 원두 목록은 산지·농장과 로스터리를 상단에 배치하고 품종·프로세싱·향미 노트를 하위 그룹으로 묶었다. 상세는 레시피와 같은 카드와 구역 제목 스타일로 원두 정보와 추출 기록을 구분했다.

기존 Bean 데이터 구조와 렌더러를 유지했다. 레시피와 원두를 공통 상세 렌더러로 재구성하는 대안은 요청에 비해 변경 범위가 커서 채택하지 않았다. 목록 이동·삭제, 상세 복귀, 기록 정렬과 상태별 안내는 보존했다.

- 기준 커밋은 `9acca24`, 선행 검사 커밋은 `607deb7`, 구현 커밋은 `33b9ec3`이다.
- Worker는 `gpt-6-luna / max`, 이후 Critic은 `gpt-6.1-sol / medium`으로 순차 실행했다. 독립 검토에서 차단 결함은 없었다.
- 구현 전 `node --test --test-name-pattern='bean cards lead|bean details group' test/pwa-ui.view.test.mjs`가 새 정보 계층 부재로 실패했고 구현 후 통과했다. 해당 원본 출력은 도구 결과에만 남았다.
- `npm test`는 657개 통과, 0개 실패다. 최초 실행은 로컬 서버의 sandbox loopback bind `EPERM`으로 실패했고, 승인된 권한으로 재실행해 통과했다.
- 최종 소스 변경 후 `npm run build:pages`, `npm run check:pages`, `git diff --check`가 모두 종료 코드 0으로 완료됐다. 산출 버전은 `577065263af1`이다.
- Worker가 실제 빌드 renderer와 합성 fixture를 사용해 Chrome 390×844 및 데스크톱에서 원두 목록·상세를 확인했다. 내용의 정보 계층과 긴 값의 줄바꿈을 확인했다. 실제 Notion 연결이나 사용자 데이터 변경은 없었다. 별도 저장된 스크린샷은 없으며 실제 iPhone 검증은 수행하지 않았다.
- 임시 fixture는 `/private/tmp/ax-bean-recipe-preview-root/index.html`이다. 미리보기 서버는 종료했다. 전체 임시 폴더를 제공하는 서버 실행은 자동 검토에서 거부되어, 필요한 파일만 담은 전용 폴더로 범위를 줄였다. 미해결 승인 차단은 없다.
- [일반판 게시 실행](https://github.com/kangseokgyu/bean-pocket/actions/runs/41007844493)은 `main`, `probes=false`로 성공했다. 통합 코드의 테스트·빌드·산출물 검사도 통과했다.
- [공개 앱](https://kangseokgyu.github.io/bean-pocket/)에서 빌드 `577065263af1`을 확인했다. HTML, CSS, 화면 모듈, 서비스워커와 manifest가 HTTP 200이며 검증한 로컬 빌드와 바이트 단위로 일치했다. [공개 파일 해시](public-files.json)에 결과를 기록했다.

상세 로컬 로그는 `/private/tmp/ax-bean-recipe-npm-test.log`, `/private/tmp/ax-bean-recipe-npm-test-escalated.log`, `/private/tmp/ax-bean-recipe-build-pages.log`, `/private/tmp/ax-bean-recipe-check-pages.log`다. 문서 기록은 앱 버전 해시에 영향을 주지 않는다.
