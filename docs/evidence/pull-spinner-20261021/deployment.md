# 당겨서 새로고침 스피너 게시 — 2026-10-21

사용자 ‘게시해줘’ 승인 후 커밋 `91ef9cc38b825aab64fe859a034f5fbc7758c1c6`를 origin/main에 push하고 일반판 Pages workflow를 실행했다.

- [Actions 39537842069](https://github.com/kangseokgyu/bean-pocket/actions/runs/39537842069): success. 대상 head는 위 커밋과 일치. runner 375/375 통과 및 빌드·검사·배포 성공. `/tmp/ax-spinner-pages.log`, `/tmp/ax-spinner-deploy-result.json`.
- 빌드 `90ca998fd496`. [공개 사이트](https://kangseokgyu.github.io/bean-pocket/)의 HTTPS 파일 18개 모두 HTTP 200이며 로컬 dist 바이트와 일치했다. `/tmp/ax-spinner-published-https.txt`.
- 실행: `git push origin main`, `gh workflow run pages.yml --ref main -f probes=false`, `gh run view` 및 Python HTTPS 파일 비교. 최종 exit 0.

당기는 중 스피너 표시·화면 이동, 손 놓은 뒤 회전 및 전체 새로고침을 게시했다. 로컬 화면·자동 테스트 범위는 [구현 검증](README.md)을 따른다. Safari/iPhone 실기기의 실제 스와이프와 기존 설치 앱의 새 빌드 전환은 직접 확인하지 않았다.
