# 입력창·버튼 스와이프 게시 — 2026-10-21

사용자의 ‘이 프로젝트에서는 테스트가 완료되면 게시까지 진행해줘’ 지시에 따라 프로젝트 지침을 기록하고 검증된 변경을 게시했다.

- 배포 커밋: `e2e690f6afd6979971591fa042911f2f78f506c2`.
- [Actions 39540099228](https://github.com/kangseokgyu/bean-pocket/actions/runs/39540099228): success. 대상 head 일치, runner 377/377 통과, 일반판 빌드·검사·배포 성공. `/tmp/ax-control-pull-pages.log`, `/tmp/ax-control-pull-deploy-result.json`.
- 빌드 `503e0e3ba6bb`. [공개 사이트](https://kangseokgyu.github.io/bean-pocket/)의 HTTPS 파일 18개 모두 HTTP 200이며 로컬 dist 바이트와 일치했다. `/tmp/ax-control-pull-published-https.txt`.
- 실행: `git push origin main`, `gh workflow run pages.yml --ref main -f probes=false`, `gh run view` 및 Python HTTPS 파일 비교. 최종 exit 0.

입력창·버튼 등에서 시작하는 아래 방향 스와이프도 새로고침으로 처리한다. 자동 검증 범위는 [구현 검증](README.md)을 따른다. Safari/iPhone 실기기 조작과 기존 설치 앱의 새 빌드 전환은 직접 확인하지 않았다.
