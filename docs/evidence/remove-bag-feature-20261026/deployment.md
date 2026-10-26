# 봉지 기능 전체 제거 게시 결과 — 2026-10-26

- 기능 커밋 `53d0769`, 독립 검토 수정 `2bcb246`, 재승인 기록 `42b0019`, 통합 검증 기록 및 배포 커밋 `2ef9b837f57d577ce72b2364dc7f9c10045899fb`.
- `codex/remove-bag-feature` 기능 워크트리에서 구현·테스트했고 깨끗한 main에 fast-forward 통합했다. 사용자의 기존 변경은 포함하거나 되돌리지 않았다. main과 이번 기능 브랜치를 push했다.
- 통합 후 `npm test`: exit 0, 508/508. `npm run build:pages`, `npm run check:pages`: 각각 exit 0. `main-test.txt`, `main-build.txt`, `main-check.txt` 참조. 최초 sandbox listen EPERM은 권한 부여 실행으로 해결했으며 실패 로그도 보존했다.
- Critic은 소스·테스트 변경과 증거를 독립 검토했다. 서버 안내와 용어집 불일치를 Worker가 수정했고 recipes 관계 대상 검증도 복원했다. 수정 focused 147/147 통과 후 Critic 재승인. `critic-review.md` 참조.
- 일반판 `pages.yml`, ref `main`, `probes=false`: [실행 40286722621](https://github.com/kangseokgyu/bean-pocket/actions/runs/40286722621). GitHub Actions의 regression tests·static PWA build·artifact check·build/deploy jobs 모두 success.
- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 공개 빌드: **b56bc1934364**.
- `node /private/tmp/bean-pocket-public-verify.cjs /Users/kangseokgyu/workspace/AX-1day/dist /Users/kangseokgyu/.codex/worktrees/remove-bag-feature/AX-1day/docs/evidence/remove-bag-feature-20261026`: exit 0. 보관본 `public-check.cjs`. 공개 20개 전체 정적 파일 HTTP 200 및 로컬 검증 산출물과 byte 일치. `public.json`에 SHA-256과 결과 기록.
- 독립 임시 프로필의 설치 Chrome 390px에서 공개 페이지 버전 일치, pageerror 0 확인. `public-390.png`를 직접 열어 확인했다.
- fake-only Chrome 390/1280px에서 4DB 연결, 원두·레시피·단계·기록 생성, 삭제 취소, 기록 있는 원두 차단, 기록 없는 원두 삭제·목록 갱신을 확인했다. console error/warning 0, pageerror 0, 외부 요청 0. `critic-browser-results.json` 참조.
- 이 게시 근거 추가는 앱 빌드 입력을 바꾸지 않는다. 불필요한 동일 검사·재배포는 하지 않는다.

## 범위와 한계

봉지 DB 설정·조회·스키마·모델·원두 관계·봉지 기반 원두 추론을 앱에서 제거했다. 4개 DB만 사용한다. 과거 Notion 봉지 DB·속성·행·관계는 원격 수정하지 않았으며 마이그레이션도 만들지 않았다. 봉지의 흔적만으로 원두가 판별되던 과거 기록은 unresolved로 보존하고 삭제를 차단한다. 원두·레시피·기록의 삭제 보호와 journal 안전성은 유지한다.

실제 Notion 자격정보로 연결·저장하는 종단 검증, iPhone/Safari·홈 화면 PWA의 기존 캐시 업데이트·설치/삭제/재설치, 실제 OPFS/native locks/file picker는 미검증이다. unknown/partial 복구는 자동 테스트와 독립 코드 검토 범위이며 브라우저 직접 조작으로 재현하지 않았다.

롤백은 이번 기능 변경을 별도 기능 브랜치에서 revert하고 동일 검사·독립 검토·main 통합·일반판 게시를 따른다. 실제 Notion 데이터를 변환하지 않았으므로 데이터 역변환 작업은 없다.
