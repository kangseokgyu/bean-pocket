# bean-pocket — 커피 레시피 북

원두별 핸드드립 레시피와 날짜별 별점·컵노트를 기록하는 개인용 웹사이트다. 원두, 원두 봉지, 레시피, 물 붓기 단계, 추출 기록의 저장소는 노션이다.

## GitHub Pages PWA 준비

`PLAN.md`에 따른 GitHub Pages PWA 이전을 완료했다. Notion 직접 통신·기기 파일·조회·저장 상태와 생성/복사 화면을 구현했다. 2026-10-21 지정 실기기 시나리오와 기존 운영 연결·읽기를 사용자 보고 범위에서 확인했다. 최종 상태는 [현재 구현 상태](docs/implementation-status.md)를 따른다. 기존 서버 실행 방법은 아래에 유지한다.

```sh
npm run build:pages
npm run check:pages
```

게시 대상은 생성된 `dist/`뿐이다. `.env.local`이나 Notion 토큰을 빌드에 전달하지 않는다. [게시 준비 상태](docs/pages-readiness.md)와 [수동 게시·복귀·아이폰 확인 절차](docs/pages-deploy.md)를 따른다. 로컬 검증을 실제 Pages 게시나 iPhone 실기기 통과로 해석하지 않는다.

PWA의 기기별 연결·입력·불확실 저장 복구는 [PWA 사용 안내](docs/pwa-usage.md)를 참고한다. 기존 운영 연결·읽기는 사용자 확인을 완료했으며, [최종 인계](docs/evidence/T30/README.md)에 범위와 검증 근거를 기록했다. 아래 환경변수와 서버 메모리 토큰 설명은 기존 Node 서버에만 해당한다.

## 기존 Node 서버 로컬 실행

Node.js 22.9 이상에서 실행한다. 외부 패키지 설치 없이 실행하도록 구성한다.

```sh
cp .env.example .env.local
# .env.local에 본인의 Notion 데이터 소스 ID 5개를 입력한다.
npm start
```

`npm start`는 `.env.local`을 자동으로 읽는다. `NOTION_BEANS_DATA_SOURCE_ID`, `NOTION_BAGS_DATA_SOURCE_ID`, `NOTION_RECIPES_DATA_SOURCE_ID`, `NOTION_STEPS_DATA_SOURCE_ID`, `NOTION_RECORDS_DATA_SOURCE_ID`를 설정한다. Notion 데이터베이스 ID가 아닌 각 데이터 소스의 ID를 사용한다. 서버 환경변수가 이미 설정되어 있으면 파일보다 우선한다. 설정 변경 후에는 서버를 재시작한다.

이미 `.env.local`이 있으면 덮어쓰지 말고 `.env.example`의 누락된 항목만 추가한다. 실제 값은 `.env.local`에만 보관하고, GitHub에는 값이 비어 있는 `.env.example`을 올린다. `.env.local`은 Git 추적 대상에서 제외되어 있다.

실행 후 터미널에 표시된 로컬 주소를 연다. 기본 주소는 `http://127.0.0.1:4173`이다. 현재 버전에는 웹사이트 로그인이나 계정별 접근 제한이 없다. 서버는 모든 네트워크 인터페이스에서 수신하고 모든 호스트 이름을 허용한다. 다른 기기에서는 서버 컴퓨터의 접속 가능한 주소를 사용한다. 변경 요청은 접속한 호스트와 같은 출처에서만 허용한다.

## 노션 연결

채팅의 Notion 플러그인 연결과 로컬 웹사이트의 Notion API 연결은 별개다. 로컬 웹사이트의 연결 설정에서 Notion 내부 연결 키를 입력하면 서버 메모리에만 보관하며 서버 재시작 시 다시 입력한다. 또는 `.env.local`의 `NOTION_TOKEN`이나 서버 환경변수로 키를 설정하면 시작 시 자동 연결한다. 파일에 입력한 키는 로컬 파일에 보관되므로 GitHub에 올리지 않는다.

1. [Notion 내부 연결 공식 안내](https://developers.notion.com/guides/get-started/internal-connections)에 따라 개발자 포털에서 본인 워크스페이스의 내부 연결을 만들고 읽기·삽입·수정 권한을 설정한다.
2. 본인의 커피 레시피 북 페이지에서 해당 연결의 접근을 허용한다.
3. 웹사이트의 연결 설정에 키를 입력하고 연결을 확인한다.

키를 채팅, 소스 파일, 브라우저 저장소에 넣을 필요가 없다. 연결 검증이 완료되기 전에는 실제 노션 저장이 작동한다고 표시하지 않는다.

## 사용하는 데이터

데이터베이스 구조와 환경변수의 대응은 [노션 구성 기록](docs/notion-database-setup.md)에 있다. 실제 식별자는 `.env.local` 또는 서버 환경변수에 보관한다. 전체 요구사항은 [인터뷰 기록](docs/recipe-book-interview.md), 용어는 [용어집](GLOSSARY.md)을 참고한다.

조건이 달라진 레시피는 기존 레시피를 복사해 새 레시피로 저장한다. 추출 기록을 저장할 때 당시 조건과 물 붓기 단계를 함께 보존한다.

## 검증

```sh
npm test
```

단계 시간·물 양, 날짜·별점, 봉지와 원두 관계, 레시피 복사와 당시 조건 보존, 노션 통신의 오류 처리를 검증한다. 모의 통신 테스트와 실제 노션 저장 검증은 구분한다.

최신 PWA 자동 테스트·독립 검토·미검증 범위는 [실행 상태](docs/implementation-status.md)와 각 작업의 증거를 따른다. 기존 서버의 브라우저 검증은 [검증 기록](docs/verification.md)에 있으며, [기존 서버 구현 흐름 HTML](docs/app-flow.html)은 네트워크 없이 파일로 열 수 있다.
