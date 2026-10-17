# 최소 PWA 게시와 복귀 — T02

이 문서는 게시 절차다. 실제 배포 완료 기록은 [T03 증거](evidence/T03/README.md)에 별도로 남긴다. 현재 자격·권한 확인은 [게시 준비](pages-readiness.md)를 따른다.

## 로컬 확인

Node.js 22.9 이상에서 실행한다. 외부 패키지 설치나 `.env.local` 로드는 필요하지 않다.

```sh
npm test
npm run build:pages
npm run check:pages
```

정적 앱만 `dist/`에 생성한다. 저장소 루트, 기존 서버의 `public/`, `.env.local`, 실제 Notion 연결 설정을 업로드하지 않는다. 앱의 빌드 표시는 PWA 소스와 빌더 코드의 내용 해시를 사용한다. 배포 증거에 이 값과 Git 커밋을 함께 기록한다.

프로젝트 경로 확인 시 임시 정적 서버에서 `dist/`를 `/bean-pocket/`에 배치한다. `index.html`, 모듈·CSS·manifest·아이콘·SW가 모두 같은 하위 경로에서 HTTP 200으로 로드되는지 확인한다. `file://`로 연 결과는 SW나 HTTPS 설치 검증을 대신하지 않는다.

## 첫 게시

1. [T00 게시 조건](pages-readiness.md)을 해결한다. 비공개 저장소의 Pages 자격이 없으면 공개·과금 정책을 사용자가 결정해야 한다.
2. 변경·테스트·독립 검토 결과를 제시하고 **merge 명시적 승인**을 받은 뒤 기본 브랜치에 통합한다.
3. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정한다. `github-pages` 환경은 기본 브랜치에서만 배포할 수 있게 제한한다.
4. Actions → **Deploy minimal PWA to Pages** → Run workflow에서 **main**을 선택해 수동 실행한다. CLI에서는 `gh workflow run pages.yml --ref main`을 사용한다.
5. 빌드 job이 기존 테스트 → 허용 목록 빌드 → 산출물 검사 → `dist/` 업로드를 통과해야 배포 job이 실행된다. 배포 job만 `pages: write`, `id-token: write`를 사용한다.
6. 실행의 배포 출력 URL에서 원두 목록 자리·연결 전 안내·빌드 버전을 확인한다. JS·CSS·manifest·아이콘·SW의 404 여부, 새로고침·홈 경로 복귀를 확인한다. 실행 ID·실제 URL·커밋과 버전을 T03에 기록한다.

워크플로는 수동 실행만 제공한다. 기능 브랜치 push나 기본 브랜치 push만으로 게시하지 않는다. 원격 설정 변경과 워크플로 실행을 수행한 경우 그 결과를 별도로 기록한다. 배포에는 별도 Notion secret이 필요하지 않다.

## 직전 정상 버전으로 복귀

1. 직전 성공한 배포 실행·커밋과 현재 문제를 확인한다. 먼저 해당 버전이 실제 정상 동작한 기록을 찾는다.
2. 별도 수정 브랜치에서 문제를 만든 변경만 되돌린다. 기존 사용자 변경과 관계없는 커밋까지 일괄 되돌리지 않는다. `reset --hard`나 강제 push로 이력을 재작성하지 않는다.
3. 동일한 로컬 검사와 독립 검토를 수행한다. 사용자 merge 승인 후 복귀 커밋을 기본 브랜치에 통합한다.
4. 기본 브랜치의 워크플로를 다시 수동 실행한다. 복원한 PWA 소스와 빌더 코드의 내용 해시에 맞는 빌드 식별자와 SW 버전으로 게시한다. 해시 입력이 모두 같으면 같은 버전이 된다.
5. 실제 URL에서 표시 버전과 자원을 확인하고 Safari·홈 화면 종료 후 재실행도 확인한다. 실행 중인 클라이언트가 즉시 새 버전으로 바뀐다고 가정하지 않는다.

기본 브랜치로 통합된 workflow를 기능 브랜치에서 실행하거나 임의 ref를 주입해 승인 절차를 우회하지 않는다. 게시 실패와 새 버전의 클라이언트 적용 실패를 구분해 기록한다.

## 아이폰 첫 실행 — T04

1. iPhone 설정에서 기종과 실제 iOS 버전을 확인한다. 지정 조건은 iPhone 12 / iOS 27.0.1이며 다르면 실제 조건을 기록한다.
2. T03에서 확인한 HTTPS 주소를 Safari에서 연다. 원두 목록 자리·연결 전 안내·빌드 버전을 확인한다.
3. 공유 → 홈 화면에 추가 → 홈 화면 아이콘으로 실행한다.
4. 화면·터치·글자 잘림을 확인하고 앱을 종료한 다음 다시 실행한다.
5. Safari와 홈 화면 각각의 결과·시간·빌드 버전을 기록한다. 이 단계는 Notion 연결·저장 성공을 의미하지 않는다.

## 공식 근거

2026-10-18 확인: [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [게시 소스 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
