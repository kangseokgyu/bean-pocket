# PWA 검증 안내

현재 제품은 정적 GitHub Pages PWA다. 브라우저가 Notion API에 직접 연결하며 저장소에는 Node 웹 서버가 없다. Node.js는 테스트, 빌드, 마이그레이션 도구에 사용한다.

## 자동 검증

저장소 루트에서 전체 단위·통합 테스트와 일반 Pages 산출물을 검사한다.

```sh
npm test
npm run build:pages
npm run check:pages
```

테스트는 도메인 규칙, Notion 요청과 응답, OPFS 연결 파일, 제출 journal, UI 동작, 서비스 워커와 빌드 산출물을 검사한다. Notion 응답은 테스트 안에서 모의 처리하며 실제 워크스페이스에 요청을 보내지 않는다.

## 로컬 화면 확인

`./run-preview.sh`를 실행해 빌드된 앱을 `/bean-pocket/` 경로에서 연다. 포트를 바꾸려면 `./run-preview.sh 4189`처럼 실행한다. 로컬 화면·모의 요청은 실제 Pages 게시나 실제 Notion 연결 성공을 증명하지 않는다.

PWA 모듈을 수정할 때는 [파일 안내](ui-refactoring.md#where-to-start)에서 시작 파일과 관련 테스트를 찾는다. 리팩터링 검토의 상세 결과는 [UI 리팩터링 증거](evidence/ui-refactor-20261106/README.md)에 기록한다.

## 실제 서비스 확인

실제 Notion 연결 확인은 기기의 앱 연결 설정에서 수행한다. 앱은 브라우저 전용 저장소를 사용하므로 Safari, 홈 화면 앱, PC의 연결 설정은 공유되지 않는다. 테스트 데이터베이스로 실제 쓰기를 수행할 때는 사용자가 의도한 등록만 저장하고 검증용 데이터를 임의로 추가하지 않는다.

게시 URL, 공개 빌드, 사용자 확인 범위는 [구현 상태](implementation-status.md)와 해당 작업의 증거 문서를 따른다. 자동 테스트 통과와 실제 서비스 확인을 같은 결과로 보고하지 않는다.
