# 게시 결과 — 2026-10-22

- 공개 주소: https://kangseokgyu.github.io/bean-pocket/
- 이번 빌드 `7ad3862bddd7`, 배포 커밋 `c4ac528cc691e1749ee7c91c48ccda6ad491f4d7`, 구현 커밋 `008fff9`.
- `pages.yml --ref main -f probes=false`, [실행 39707443356](https://github.com/kangseokgyu/bean-pocket/actions/runs/39707443356) build·deploy success([JSON](deploy.json), [watch](deploy-watch.txt)).
- main 통합 후 `TZ=UTC npm test`: 410/410 통과, exit 0([원문](main-tests.tap)). `npm run build:pages`·`npm run check:pages`: exit 0([빌드](main-build.txt), [검사](main-check.txt)).
- 공개 대조 중 병행 작업이 공유 main 산출물을 재빌드했다. 최초에는 기존 공개 `7ad3862bddd7`을 새로운 로컬 산출물과 비교해 index/CSS/SW 세 파일이 불일치했다([최초 비교](initial-comparison.json)). 이후 고정한 기능 빌드로 대조할 때는 후속 게시가 이미 공개 버전을 바꿨다. 잘못된 비교 기준을 성공으로 보고하지 않고 최신 빌드의 별도 스냅샷을 만들었다.
- 후속 [게시 39707567360](https://github.com/kangseokgyu/bean-pocket/actions/runs/39707567360)은 `8faef89b85bdc508ffb222ed3543b4dd0eea1590`에서 성공했다. 이 커밋은 이번 통합 커밋의 후손이며 휴지통 변경을 그대로 포함한다.
- **최종 공개 빌드 `164d8078a964`**의 파일 18/18 HTTP 200 및 고정한 최신 산출물과 SHA-256 일치. 공개 CSS에 `margin: -14px -8px 0 0; color: #737373`이 포함됨을 확인했다([결과](public-files.json)). 후속 로딩 오버레이 변경은 병행 작업의 범위다.
- 브라우저 화면·동작 검증은 이번 기능 빌드의 가짜 Notion·메모리 저장소와 실제 앱 어댑터로 수행했다. 실제 Notion 쓰기와 iPhone/Safari 실기기 검증은 수행하지 않았다.
- 후속 문서·증거 커밋은 산출물 해시에 영향을 주지 않는다.
