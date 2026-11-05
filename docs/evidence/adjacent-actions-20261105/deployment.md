# 버튼 간격 변경 게시 결과

- 게시 주소는 https://kangseokgyu.github.io/bean-pocket/ 이다.
- 배포 커밋은 `2743a004a5ec6fe17f91ee914e24896d0e330832`이다.
- 배포 대상 빌드는 `cec5502370cb`다. 로컬 일반판 빌드에서 확인했다. 공개 서버가 반환하는 버전은 네트워크 오류로 확인하지 못했다.
- [Pages 실행 41987188007](https://github.com/kangseokgyu/bean-pocket/actions/runs/41987188007)은 `probes=false`이며 build와 deploy가 모두 성공했다.
- 기능 브랜치와 main 통합 후 전체 테스트 732개가 각각 모두 통과했다. main 통합 후 로그는 `integrated-npm-test.log`다. Pages 빌드·검사와 CI 회귀 테스트도 통과했다.
- 공개 파일 대조는 미완료다. 기존 `verify-public.mjs`의 Node fetch는 `UND_ERR_SOCKET`으로 중단되었다. 시간 제한을 둔 curl 재확인도 IPv4 SSL 연결 시간 초과와 IPv6 접속 실패로 중단되었다. 웹 조회 도구도 해당 URL 접근에 실패했다. 파일 일치와 공개 버전을 통과로 간주하지 않았다.
- 실제 iPhone Safari·설치·재실행과 실제 Notion 쓰기는 확인하지 않았다.

변경 코드는 `pwa/styles.css` 한 줄이며, 원두·레시피의 즐겨찾기·삭제 버튼 경계가 여백 없이 맞닿는다. 로컬 실제 브라우저 8개 화면 조합에서 확인했다.
