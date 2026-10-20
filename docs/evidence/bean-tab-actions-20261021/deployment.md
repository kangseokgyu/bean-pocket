# 원두 탭 아이콘 변경 게시 — 2026-10-21

사용자 ‘푸쉬하고 게시해줘’ 승인 후 `0350ebdc8d86f6b816e0aa865ceeff2968afa114`를 origin/main에 push하고 일반판 Pages workflow를 실행했다.

- [Actions 39516437386](https://github.com/kangseokgyu/bean-pocket/actions/runs/39516437386): success. 대상 head는 위 커밋과 일치.
- runner 전체364/364 통과·실패0, 일반 빌드/검사·배포 성공. 빌드 `4527608c52d5`.
- 공개 HTTPS 파일18개 모두 HTTP200·로컬 dist 바이트 일치. [비교 결과](published-https.txt). 최초 index.html 요청은 시간 초과였으며 해당 파일 한 번 재시도 후 일치했다.
- 실행: `git push origin main`, `gh workflow run pages.yml --repo kangseokgyu/bean-pocket --ref main -f probes=false`, `gh run view 39516437386 --repo kangseokgyu/bean-pocket --json headSha,status,conclusion,jobs`, 공개 파일 비교 Python. 모두 최종 exit0.
- workflow 원문 로그: `/tmp/ax-bean-icons-pages.log`.

원두 탭의 새 원두 폼은 기본 숨김이며 `+`로 연다. 입력 취소·저장 성공 후 다시 숨긴다. 새로고침은 `↻` 아이콘이다. 이번 게시에서 iPhone 실기기 조작·기존 설치 앱의 새 빌드 전환은 직접 확인하지 않았다.
