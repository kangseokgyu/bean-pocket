# 수정판 이후 안전 전환 후보 게시 — 2026-10-20

이 문서는 게시 당시 기록이다. 이후 실기기 확인과 현재 판정은 [T29 최종 결과](../README.md)와 [T30 최종 인계](../../T30/README.md)를 따른다.

사용자 ‘게시’ 승인 후 HTML 주석 변경 한 파일만 `0831f3d`로 커밋·origin/main push하고 일반판 workflow를 실행했다. 기존 진행 문서 변경은 커밋하지 않았다.

- [Actions 39437330924](https://github.com/kangseokgyu/bean-pocket/actions/runs/39437330924): success, head `0831f3d6d5447a3714dec57c8630ad47110eae7a`.
- runner 전체362/362·일반 build/check·배포 성공. 명령 모두 exit0.
- 일반 빌드 `47ab61dfe376`, 쿼리 없는 공개 URL 18개 모두 HTTP200 및 후보 바이트 일치。`safe-transition-published-https.txt`。
- 로그 `/tmp/ax-t29-safe-deploy.log`、`/tmp/ax-t29-safe-actions.log`、`/tmp/ax-t29-safe-https.log`。

다음 실기기 관찰: iPhone `4fbcbf514c52`의 미저장 이름 `업데이트 보존 확인 2`를 유지한 채 홈 화면으로 잠시 나갔다 복귀해 foreground 업데이트 확인을 유도한다. 앱 강제종료·새로고침·입력 취소·저장은 하지 않는다. 입력 유지 및 빌드를 보고받고, 이후 입력 취소 후 새 빌드 자동 전환 여부를 관찰한다. 이 단계는 게시만 완료이며 실기기 안전 전환은 미검증이다.
