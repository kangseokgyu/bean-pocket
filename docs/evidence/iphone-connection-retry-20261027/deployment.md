# 통합·일반판 게시 완료

- 기능 브랜치: `codex/iphone-connection-retry`.
- 수정 및 배포 커밋: `84a6bd8b99d2f0074afeb331315bc7235e9be97a`. 기존 main `785f1c6`에서 fast-forward 통합. 기존 작업 폴더는 시작·통합 시 깨끗했으며 이번 변경만 선별했다.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: `261874a66bf8`.
- 일반판 `pages.yml --ref main -f probes=false` 실행 [40460802439](https://github.com/kangseokgyu/bean-pocket/actions/runs/40460802439): `completed / success`. 상세 결과 `deployment-run.json`, 진행 기록 `deployment-watch.txt`.

## 검증 결과

| 검증 | 종료 코드 | 결과 | 근거 |
| --- | --- | --- | --- |
| 기능 브랜치 전체 `npm test` | 0 | 570/570, skip 0 | `npm-test.log` |
| 독립 코드 검토 | — | APPROVE, Required 0, Critical 0 | `critic/README.md` |
| 독립 브라우저 | 0 | 실제 OPFS + fake Notion, 12/12 | `critic/browser-results.json` |
| 독립 mutation | 0/1 | 무변경 대조군 성공, 버그 3종 모두 검출 | `critic/mutation-results.json` |
| main 통합 후 `npm test` | 0 | 570/570, skip 0 | `main-tests.tap` |
| main `npm run build:pages` | 0 | `261874a66bf8` | `main-build.txt` |
| main `npm run check:pages` | 0 | 통과 | `main-check.txt` |
| 공개 파일 비교 | 0 | 20개 전부 HTTP 200 및 로컬 바이트 일치 | `public-files.json` |
| 공개 Chrome 시작 화면 | 0 | 빌드 일치, 페이지 오류 0, 390px 넘침 없음 | `public-browser.json`, `public-390.png` |

공개 파일 비교는 `node verify-public.mjs <dist 경로> <결과 JSON 경로>`로 재현한다. 공개 브라우저는 `node check-public-browser.cjs <증거 출력 폴더> 261874a66bf8`로 실행했다. 두 스크립트 모두 별도 설치 없이 기존 bundled runtime을 사용한다. 공개 확인 시 실제 Notion 연결·쓰기 및 사용자 브라우저 프로필 접근은 하지 않았다.

## 에이전트 설정과 인계

생성 도구에 역할명 지정 기능이 없어 아래는 업무 역할과 실제 도구 별칭·ID의 대응이다.

- worker-1 → Rawls (`01a17b92-d5db-7bc2-8b28-cfc5a7d49434`): 생성 설정 `gpt-6-luna / max`. 테스트와 RED 근거 작성 후 사용량 한도 오류로 중단했다. 무한 재시도하지 않았다.
- worker-2 → Franklin (`01a17bf9-9c3b-7341-9b65-325b736356cf`): 정책상 대체 설정 `gpt-6.1-sol / medium`을 생성 도구에 지정했다. 기존 변경을 인계받아 구현·필수 검증 완료.
- critic → Hume (`01a17c00-b3b8-76b2-86e3-77d9ff59603f`): 생성 설정 `gpt-6.1-sol / medium`. 코드 수정 없이 독립 검토·브라우저·mutation 검증 완료.

메인은 요구사항·추가 원인 근거·인계·통합·게시를 담당했다. 기능 브랜치 검증은 중복 실행하지 않았으며 main 통합 후 검사는 프로젝트 필수 절차에 따라 수행했다. 검토 후 제품 코드는 변경하지 않았다. 이 게시 기록과 통합·공개 확인 증거는 제품 빌드에 영향을 주지 않는 문서 전용 후속 커밋으로 남긴다.

## 미확인 범위

실제 iPhone 홈 화면 앱에서 업데이트 적용 후 재실행, 기존 클라이언트 서비스워커 전환, 실제 Notion 토큰·권한·원본 데이터는 직접 확인하지 않았다. iPhone에서는 기존 홈 화면 아이콘으로 다시 열어 하단 빌드가 `261874a66bf8`인지 확인하고 재실행 시 기존 연결이 복원되는지 확인해야 한다. 이미 기기 저장소 자체가 소실된 경우 설정 복구까지 보장하지 않는다.
