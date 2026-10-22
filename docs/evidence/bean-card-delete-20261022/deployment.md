# 일반판 게시 결과 — 2026-10-22

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `d456a8e837a4`
- 배포 커밋: `2156a830cecacf14b95c80ef4da213183d0fe2ad` (`Merge bean card trash deletion`)
- 구현 커밋 `33f9899`, 추가 검증·증거 커밋 `9c913a8`. 기능 브랜치 `codex/bean-card-delete`에서 작업 후 main에 통합했다. 기존 checkout에 미커밋 변경이 없음을 확인하고 이번 작업만 통합했다.
- 수동 workflow: `gh workflow run pages.yml --ref main -f probes=false`
- 실행: [39706845911](https://github.com/kangseokgyu/bean-pocket/actions/runs/39706845911), build·deploy 모두 success([실행 JSON](deploy.json), [watch 결과](deploy-watch.txt)). 기존 Actions의 Node 20 전환·ubuntu-latest 이전 안내는 비차단 annotation으로 기록되어 있다.
- main 통합 후 `TZ=UTC npm test`: exit 0, 410/410 통과([원문](main-tests.tap)).
- main `npm run build:pages`·`npm run check:pages`: exit 0, 같은 빌드([빌드](main-build.txt), [검사](main-check.txt)).
- 공개 정적 파일 **18/18 HTTP 200 및 SHA-256 로컬 일치**: HTML·JS·CSS·manifest·아이콘·SW·journal 모듈 포함([결과](public-files.json)).
- 별도 Chrome 프로필의 공개 앱: HTTP 200, 빌드 표시 일치, 연결 전 화면 로드, page/console 오류와 실패한 요청 0([결과](public-browser.json), [390px 화면](public-mobile.png)). 최초 스크립트는 실제 버튼 문구와 다른 locator로 대기해 timeout이었다. 실제 소스의 `연결 확인 및 저장`으로 locator만 수정해 재검증했다.
- 제품 삭제 동작은 가짜 Notion·메모리 저장소를 사용하는 실제 UI/controller/명령/저장소 어댑터로 검증했다([브라우저 결과](browser.json)). 공개 사이트에서 실제 Notion 쓰기·삭제나 iPhone/Safari 실기기 조작은 수행하지 않았다. 별도 Critic은 429로 미완료이며 사용자 승인에 따라 주 에이전트가 직접 검토했다.
- 문제 발생 시 별도 기능 브랜치에서 삭제 기능 변경만 되돌리고 필수 검증 후 동일 수동 workflow로 재게시한다. 최신 main의 다른 기능은 유지한다.

후속 증거·사용 안내 커밋은 문서만 바꾸며 공개 산출물 해시에 영향을 주지 않는다.
