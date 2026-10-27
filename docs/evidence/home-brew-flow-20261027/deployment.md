# 홈·추출 흐름 게시 확인

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/#/home
- 공개 빌드: **3a88d931f566**.
- 게시 커밋: `c92aefc73c1ffe9c2abba14fdab437d213292ca7`. 독립 승인 코드 `21e84dc5ecf7b0acf8256e46873ead3d68aeb28c`에 검토 문서만 추가했다.
- 최신 main의 탭 스켈레톤 개선을 포함해 기능 브랜치에서 검증 후 main으로 fast-forward했다. 사용자 프로젝트 상시 승인에 따라 push 및 `gh workflow run pages.yml --ref main -f probes=false`를 실행했다.
- 배포: [40432553084](https://github.com/kangseokgyu/bean-pocket/actions/runs/40432553084), build/deploy 모두 success. 완료 2026-10-27 10:27 KST. main의 회귀 테스트·일반판 빌드·산출물 검사를 배포 job 전에 다시 통과했다.
- 로컬 통합 검증: 전체 561개, 집중 111개, 실제 저장 모듈 + fake Notion 브라우저 9개 통과. Critic 독립 재검증은 집중 111개, 기본 E2E 9개, 지연 응답 E2E 10개 통과. 상세는 `integration-summary.md`, `critic-integration-review.md`.
- 공개 파일 검증: `verify-public.mjs`로 배포 파일 20개의 HTTP 200과 SHA-256 일치를 확인했다. 결과 `public-files.json`, allMatch=true.
- 공개 브라우저: 격리 headless Chrome 390×844에서 홈 URL 첫 진입, 빌드 표시, 연결 전 안내 확인. 페이지 오류 0, HTTP 실패 0, 가로 넘침 없음. `public-browser.json`, `public-home-390.png`.
- 실제 Notion 데이터는 수정하지 않았다. live Notion 쓰기, 실제 Safari/iPhone 설치형 PWA, 기존 클라이언트의 service worker 업데이트, 검색 페이지네이션 및 연결 변경/unknown과 새 흐름을 결합한 브라우저 E2E는 미검증이다. 검색·연결·unknown의 기존 자동 회귀는 전체 테스트에 포함된다.

## 실제 에이전트 설정

- worker: `gpt-6-luna` / `max`, 도구 별칭 Kierkegaard (`01a179c6-94c1-7620-bcab-9df26955ba47`). 수정 중 사용량 제한으로 중단됐다.
- 프로젝트 허용 대체 worker-2: `gpt-6.1-sol` / `medium`, Singer (`01a17adf-1deb-7e22-b8bd-44ce10064de4`). 수정·통합 검증 담당.
- critic: `gpt-6.1-sol` / `medium`, Mencius (`01a179da-0d4b-7953-afa6-70f17e4f4daf`). 최초 3건 지적 후 수정본과 통합본을 순차 재검토했다.
- 생성 도구는 이름 지정을 지원하지 않아 위 역할명은 업무상 호칭이다. 모델·추론 수준은 생성 인자로 명시했다. 서브에이전트가 추가 에이전트를 만들지 않았다.

## 보관·복귀

- 최초 main 폴더에 이 채팅이 만들었던 계획 2개와 실패 테스트 초안 1개는 `/private/tmp/bean-pocket-home-brew-early-drafts-20261027/`에 보관했다. 사용자 기존 변경은 포함하거나 되돌리지 않았다.
- 기능 워크트리는 이 채팅의 활성 checkout으로 보존했다.
- 복귀가 필요하면 `docs/pages-deploy.md`에 따라 기능 변경만 별도 브랜치에서 revert하고 같은 검증 후 일반판을 재게시한다. 강제 push나 기존 데이터 삭제는 필요하지 않다.
