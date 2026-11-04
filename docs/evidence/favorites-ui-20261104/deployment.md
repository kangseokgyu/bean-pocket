# 즐겨찾기 목록 변경 게시

- 게시 주소는 https://kangseokgyu.github.io/bean-pocket/ 이다.
- 게시한 커밋은 `33ef6f4101217f112d2fcf170622a0eb66372a3f`이다.
- 공개 빌드 버전은 `85597d48c840`이다.
- 일반판 `pages.yml`을 `probes=false`로 실행했다. [실행 41933914828](https://github.com/kangseokgyu/bean-pocket/actions/runs/41933914828)의 build와 deploy가 성공했다.
- 최신 추출 탐색 기능과 통합한 뒤 전체 테스트 726개, 관련 테스트 244개와 Pages 빌드·검사가 통과했다. `integrated-*` 파일에 결과를 보관했다.
- 독립 Critic은 조회 파일의 충돌 해결이 즐겨찾기 정렬과 선택적 속성 처리를 모두 보존함을 확인하고 승인했다.
- `verify-public.mjs`로 공개 파일 27개를 로컬 통합 빌드와 바이트 단위로 비교했다. 모두 일치했고 루트 응답은 HTTP 200이었다. 결과는 `public-files.json`이다.

이번 작업은 실제 Notion 데이터 쓰기와 iPhone 설치·재실행을 검증하지 않았다. 기존 실행 중인 PWA의 업데이트 수신 시점도 확인하지 않았다.

공개 파일 검증 명령은 다음과 같다.

```sh
node docs/evidence/brew-record-handoff-20261030/verify-public.mjs /private/tmp/ax-favorites-ui-20261104/dist https://kangseokgyu.github.io/bean-pocket/
```
