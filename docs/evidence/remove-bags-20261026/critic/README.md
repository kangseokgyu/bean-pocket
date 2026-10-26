# Critic 검증 원문 보관

제품 검증 대상은 `923a08a6439ebc65a91067656d3c369ae5bbb0fa`, 문서 재검토 대상은 `f02437b094a596d35c8c57b4da64a968e54c9184`다. 문서 재검토와 이번 증거 정리에서 테스트·브라우저를 재실행하지 않았다.

- `critic-bagless.test.mjs.txt`는 당시 임시 checkout의 `test/critic-bagless.test.mjs`에서 실행한 원문이다. `node --test`의 자동 탐색 대상이 되지 않도록 `.txt`로 보존한다. 재현할 때는 제품 원본이 아닌 해당 commit의 임시 checkout을 만들고, 이 파일을 그 checkout의 `test/critic-bagless.test.mjs`로 복사한 뒤 `node --test test/critic-bagless.test.mjs`로 실행한다. 상대 imports는 이 `test/` 위치를 기준으로 한다.
- `browser.cjs`, `server.mjs`, `form-shot.cjs`는 당시 실행한 하네스 원문이다. 로컬 Chrome/Playwright 모듈·워크트리 절대 경로와 `/private/tmp/remove-bags-critic` 출력 경로, localhost 포트 4267을 포함한다. 현재 evidence 폴더에서 바로 실행하는 도구가 아니다. 재현 시 임시 checkout·출력 폴더와 설치 경로에 맞춰 임시 복사본만 조정한다.
- 브라우저 재현은 임시 Chrome profile/context, fake Notion, 메모리 파일/lock, localhost 외 요청 차단을 유지한다. 개인 브라우저 프로필이나 실제 Notion 연결을 사용하지 않는다. 실행 후 검증 서버를 종료한다.
- `browser.txt`는 최종 성공 실행 출력, `browser-navigation-race.txt`는 상세 화면 전환 대기가 빠졌던 이전 하네스 실패 출력이다. ignore되는 `.log` 파일명을 `.txt`로 바꿨으며 내용은 보존했다.
- `safety.tap`, `focused-sandbox.tap`, `http.tap`, `mutation.tap`, `browser-results.json` 및 PNG의 범위와 한계는 상위 `critic-report.md`를 따른다.
