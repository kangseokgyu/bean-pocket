# bean-pocket — 커피 레시피 북

원두별로 추출 조건을 조정하고 결과를 비교하는 개인용 PWA다. 앱은 GitHub Pages에서 정적 파일로 제공되며 브라우저가 Notion API에 직접 연결한다. 프로젝트에는 Node 웹 서버나 `/api/*` 백엔드가 없다.

## 로컬 확인

Node.js 22.9 이상에서 테스트하고 Pages 파일을 만든다.

```sh
npm test
npm run build:pages
npm run check:pages
```

로컬 미리보기는 `./run-preview.sh`로 연다. 이 스크립트는 실험 페이지를 포함한 정적 빌드를 `/bean-pocket/` 경로에서 제공한다. 미리보기는 실제 Pages 게시나 Notion 연결 검증을 대신하지 않는다.

게시 절차는 [Pages 배포 안내](docs/pages-deploy.md), 최신 구현·검증 상태는 [구현 상태](docs/implementation-status.md)를 참고한다.

## Notion 연결

각 브라우저에서 Notion 통합 토큰과 `beans`, `recipes`, `steps`, `records` 데이터 소스 ID를 입력한다. 연결은 해당 브라우저의 앱 전용 파일에 저장된다. Safari, 홈 화면 앱, PC 설정은 서로 공유되지 않는다. 연결 파일에는 자격 정보를 보관하므로 소스, URL, 공개 문서나 빌드에 넣지 않는다.

앱은 봉지 데이터 소스를 조회하거나 바꾸지 않는다. 기존 봉지 데이터베이스와 속성은 사용자가 직접 관리한다. 현재 Notion 구조와 선택 속성은 [데이터베이스 구성](docs/notion-database-setup.md), 연결·복구 방법은 [PWA 사용 안내](docs/pwa-usage.md)에 기록했다.

## 데이터와 동작

원두와 공용 레시피를 독립적으로 관리한다. 추출 준비에서 공용 레시피나 이전 기록의 조건을 조정하고, 날짜·별점·선택 컵노트와 전체 조건 스냅샷을 저장한다. 저장 기록은 같은 원두끼리 비교할 수 있다. 유용한 조건은 별도 공용 레시피로 저장하고 원두별 사용자 베스트를 지정할 수 있다.

제품 계약은 [SPEC.md](SPEC.md), 용어는 [용어집](GLOSSARY.md), PWA 모듈 안내는 [UI 파일 안내](docs/ui-refactoring.md#where-to-start)에 있다. 버튼과 아이콘 기준은 [UI 가이드](docs/button-icon-guidelines.md)에 있다.

## 검증 범위

`npm test`는 도메인, 브라우저용 Notion client, 연결 파일, 제출 journal, UI와 정적 Pages 산출물을 검사한다. 모의 요청은 실제 Notion 저장을 증명하지 않는다. 배포 주소와 실기기 확인 범위는 [검증 상태](docs/implementation-status.md)와 각 작업의 증거 문서를 따른다.
