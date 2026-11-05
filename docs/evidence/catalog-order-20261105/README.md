# 원두·레시피 정렬 변경

- 요구사항: 즐겨찾기 우선, 각 그룹 안에서는 최근 등록순.
- 공통 목록 조회에서 Notion `created_time` 내림차순을 두 번째 정렬로 사용한다. 즐겨찾기 속성이 없는 연결은 최근 등록순만 적용한다.
- 원두·레시피 모두 페이지 경계를 넘어서 즐겨찾기 우선과 최근 등록순이 유지되는 회귀 테스트를 실행했다.
- 구현 전: `node --test test/pwa-read-repository.test.mjs` 종료 1, 정렬 관련 3개 의도한 실패 (`red.log`).
- 구현 후: 같은 명령 종료 0, 67개 통과 (`green.log`).
- `npm test`: 샌드박스에서는 HTTP listen EPERM 발생. 권한 부여 후 종료 0, 731개 통과 (`npm-test.log`).
- `npm run build:pages`, `npm run check:pages`: 종료 0, 빌드 `00f85a84a4a7`.
- `git diff --check`: 종료 0.
- 실제 Notion 데이터·iPhone 설치 환경은 확인하지 않았다.

- main 통합: fast-forward, 검증 대상 소스 동일 확인. 통합 후 build:pages/check:pages 종료 0.
- 게시 커밋: `c2205068dea5ac9f2d0abaae69100fd48c75354a`.
- 일반판 게시 성공: https://github.com/kangseokgyu/bean-pocket/actions/runs/41960840178 (`deploy.log`, gh run watch 종료 0).
- 초기 게시 요청 41960753503은 push 완료 전 이전 커밋으로 시작되어 취소하고 재실행했다.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 확인: verify-public.mjs 종료 0, 빌드 `00f85a84a4a7`, 27개 파일 모두 로컬 dist 바이트와 일치 (`public-files.json`).
