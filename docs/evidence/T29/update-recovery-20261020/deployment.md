# 업데이트 복구 수정판 게시 — 2026-10-20

이 문서는 게시 당시 기록이다. 이후 실기기 확인과 현재 판정은 [T29 최종 결과](../README.md)와 [T30 최종 인계](../../T30/README.md)를 따른다.

사용자 “게시해줘.” 명시 승인 후 `0a54c3e`를 origin/main에 push하고 일반판 Pages workflow를 실행했다. 기존 진행 문서 변경은 push에 포함하지 않았다.

- [Actions 39436345642](https://github.com/kangseokgyu/bean-pocket/actions/runs/39436345642): success, head `0a54c3ed569c47515f02c324d0569c0eda886d8b`.
- runner 전체 테스트 362/362, 실패0. 일반판 build/check 및 배포 성공.
- 일반 빌드 `4fbcbf514c52`. 쿼리 없는 실제 공개 URL의 정적 파일 18개 모두 HTTP200 및 로컬 후보 바이트 일치. `published-https.txt`.
- 실행 명령: `git push origin main`, `gh workflow run pages.yml --ref main -f probes=false`, `gh run watch 39436345642 --exit-status --interval 10`, HTTPS 비교 스크립트. 모두 exit0.
- 로그: `/tmp/ax-t29-fix-deploy.log`, `/tmp/ax-t29-fix-actions.log`, `/tmp/ax-t29-fix-https.log`.

iPhone 수정판 진입은 아직 미검증이다. 사용자에게 입력 취소 상태에서 홈 화면 앱 완전 종료·재실행 후 빌드와 자동 연결·기존 원두 목록 확인을 요청한다. 구버전 진입 복구와 수정판에서의 다음 빌드 안전 전환 검증은 구분한다. 삭제·재설치·초기화는 이 단계에서 실행하지 않는다.
