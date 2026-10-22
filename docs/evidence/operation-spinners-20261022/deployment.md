# 게시 결과 — 2026-10-22

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `53411a0d82cf`. 구현 완료 커밋 `54849321d244516533fe3289839513f0df0f8643`; main 통합·배포 커밋 `58d994cd428ac1bb4b3c18d7311f5b4a9a664df4`.
- 기존 비동기 추가·복사·삭제·연결 설정 변경·재조회·복구에 공통 12-spoke 스피너를 적용했다. pending 시작부터 마지막 목록 재조회까지 유지하며 성공·실패 후 종료한다. 동기 입력/탐색에는 추가하지 않았다. 지원하지 않던 CRUD 기능을 새로 만들지는 않았다.
- 사용자 상시 승인으로 기능 브랜치 `codex/operation-spinners`를 main에 통합하고, 통합 후 `TZ=UTC npm test` 413/413, `npm run build:pages`, `npm run check:pages` 모두 exit 0. 근거: [tests](main-tests.tap), [build](main-build.txt), [check](main-check.txt).
- 일반판 `pages.yml --ref main -f probes=false`를 실행했다. [실행 39731292942](https://github.com/kangseokgyu/bean-pocket/actions/runs/39731292942) build/deploy 모두 success. [실행 JSON](deployment.json), [대기 로그](deployment-watch.txt).
- 게시 후 고정한 후보 산출물 `/private/tmp/operation-spinners-53411a0d82cf-dist`와 공개 파일 18/18을 비교했다. 모두 HTTP 200이며 SHA-256이 일치했다. index의 표시 빌드도 같은 산출물에 포함된다. [공개 파일 근거](public-files.json).
- [최종 독립 리뷰](critic-2-final-5484932.md)는 APPROVE. 실제 Chromium mobile touch tap 및 짧은 pull release/cancel 후 하단 저장, 마지막 조회 3.6초 지연, 단일 중앙 스피너 유지·종료, reduced-motion, 실패 시 입력 보존·다시 저장 활성화를 검증했다.
- 초기 sandbox의 localhost EPERM, 최초 모의 DOM 비교 OOM, 테스트 조회 시점 오류, selector 잔존과 모바일 변형 문제는 inventory와 단계별 기록에 구분했다. 최초의 스크롤/마우스 QA 결과를 최종 모바일 수정의 검증으로 확대하지 않았다.
- Actions의 Node 20 action 실행 전환·Ubuntu 이미지 전환 안내는 비차단 annotation이며 이번 게시가 성공했다. 워크플로 변경은 이번 범위에 포함하지 않았다.
- 미검증: 실제 iPhone/Safari, 실제 Notion 쓰기, 스크린리더 발화, 이미 설치된 PWA의 업데이트 반영. 모의 데이터 및 Chromium touch emulation 결과와 구분한다.
- 이후 증거 문서/로그 공백 정리 커밋은 앱 소스·빌드 해시에 영향을 주지 않는다. 에이전트 실제 생성 설정은 [agent-settings.md](agent-settings.md)에 기록했다.
