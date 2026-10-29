# 공식 pstack 프로젝트 설치 (2026-10-29)

사용자 요청에 따라 Addy Osmani 프로젝트 스킬 25개, 전용 공통 참조 7개, 라이선스와 이전 CLI skills-lock.json을 제거하고 공식 cursor/plugins/pstack으로 교체했다.

- 원본: https://github.com/cursor/plugins/tree/1ba91fc25c0977741dd0e267849e6234b037ed0a/pstack
- 설치: 스킬 58개, 스킬 파일 535개와 지원 파일 33개. 설치 파일은 원본과 바이트 단위로 일치한다.
- 출처·실제 SHA-256: `.agents/pstack-install-manifest.json`. CLI computedHash를 임의 생성하지 않았다.
- Codex 호환·정책 우선순위: AGENTS.md와 .agents/README.md. Cursor 전용 호출·홈 설정 초기화·자동화는 활성화하지 않았다.
- 중간에 선택한 미러는 사용자의 원본 지정 후 배제했다. 미러 기반 설치 파일이나 출처 기록은 남기지 않았다.

## 검증

- npm test: 종료 코드 0, 631 통과, 실패·취소·건너뜀 0.
- npm run build:pages: 종료 코드 0, 빌드 cb722a0bcf1a.
- npm run check:pages: 종료 코드 0.
- 정적 검사: 스킬명·535개 스킬 파일 해시·33개 지원 파일 해시 일치, Markdown 170개 검사, 실제 로컬 상대 링크 모두 연결. 예시 URL 자리표시자는 파일 링크에서 제외했다.
- git diff --check: 통과. 최종 정책 문구 수정 후 관련 규칙 검사와 diff 검사를 통과했다. 앱 소스가 동일하므로 전체 테스트를 반복하지 않았다.
- 전체 설치·검증 로그는 기본 작업 폴더의 `.state/pstack-install-20261029/`에 보존했다 (gitignore 대상).

## 독립 검토

Worker는 생성 도구에서 gpt-6-luna / max를 명시했고 실제 별칭은 Jason이다. Critic은 gpt-6.1-sol / medium을 명시했고 실제 별칭은 Dalton이다. 도구에 이름 지정 인자가 없어 역할명은 업무상 호칭으로 사용했다. Worker 다음 Critic 순서로 진행했으며 중첩 에이전트는 생성하지 않았다.

Critic은 공식 원본·파일 해시·삭제 범위·참조 경로·검증 로그·프로젝트 정책을 독립적으로 검토했다. 모델을 사용할 수 없을 때 승인된 대체 설정이 없으면 사용자에게 확인한다는 기존 규칙이 축약된 점을 P2로 지적했다. Worker가 AGENTS.md와 .agents/README.md에 규칙을 복원했고 Critic이 재검토하여 승인했다. 남은 조치 사항은 없다.

## 한계

실제 Codex 스킬 자동 탐색 및 각 스킬의 도구 실행은 이 설치 턴에서 평가하지 않았다. 다음 턴에 스킬 목록을 확인한다. 설치 전 홈 설정 해시 스냅샷이 없어 전역 파일 무변경을 해시 비교로 입증하지는 못했다. 설치 명령은 프로젝트 경로만 대상으로 했으며 홈 초기화나 upstream 스크립트는 실행하지 않았다. iPhone/Safari/홈 화면 실기기 검증은 수행하지 않았다.

게시 실행과 공개 파일 확인 결과는 이 폴더의 deployment.md에 기록한다.
