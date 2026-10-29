# 프로젝트 작업 지침

## 기능별 워크트리

- 사용자 지시(2026-10-21): 기능별 워크트리와 `codex/` 기능 브랜치에서 작업하고 검증 후 main에 merge한다. 기존 작업 폴더의 미커밋 변경은 포함하거나 되돌리지 않는다.
- 사용자 지시(2026-10-21): 이 프로젝트의 merge와 게시는 상시 승인한다. 변경 내용과 검증 결과를 확인한 뒤 추가 승인 요청 없이 main에 merge하고, 통합 후 테스트·빌드 검사를 통과하면 게시까지 진행한다. 이 프로젝트의 상시 승인은 전역 merge 승인 규칙보다 우선한다.

## 테스트 완료 후 게시

- 사용자 지시(2026-10-21): 이 프로젝트에서는 테스트가 완료되면 게시까지 진행한다.
- 변경에 필요한 테스트와 `npm test`, `npm run build:pages`, `npm run check:pages`가 모두 통과하면 별도 게시 승인을 다시 요청하지 않고 이번 작업의 변경을 선별해 커밋·push하고 일반판 GitHub Pages 게시를 실행한다.
- 게시 절차는 `docs/pages-deploy.md`를 따른다. 기존 `pages.yml`의 수동 실행 방식을 사용하며 `probes=false`로 실행한다.
- 변경하지 않은 검증 대상에 대해 같은 검증을 불필요하게 반복하지 않는다. 검증 이후 코드가 바뀌면 영향받는 검증을 다시 실행한다.
- merge와 게시는 사용자 상시 승인에 따라 추가 승인 요청 없이 진행한다. 기능별 워크트리·브랜치, 변경 선별, 필수 검증과 게시 후 공개 반영 확인은 유지한다.
- 테스트·빌드·배포 실패는 원인을 확인하고 해결한다. 게시 완료 후 실행 결과, 공개 빌드 버전과 파일 반영을 확인하고 검증 근거를 기록한다.
- 최종 보고에는 게시 주소·빌드 버전·테스트 결과와 실제로 확인하지 못한 범위를 포함한다.

## pstack Agent Skills (프로젝트 로컬)

- Codex는 `.agents/skills/<skill-name>/SKILL.md`에서 프로젝트 스킬을 탐색한다. 요청과 스킬의 description·trigger를 대조해 관련 스킬만 고르고, 필요한 시점에 해당 스킬의 `references/`, `playbooks/`, `scripts/` 및 `.agents/docs/` 지원 문서를 읽는다. 설치한 원본 `SKILL.md`와 스킬 내부 파일은 프로젝트 정책을 반영한다는 이유로 수정하지 않는다.
- 비사소한 엔지니어링 작업은 필요하면 `poteto-mode`를 기본 라우터로 쓰고, 작업에 직접 필요한 스킬만 적용한다. upstream의 라우팅·모델·도구 권고는 아래 프로젝트 정책을 따른다.

| 작업 | 관련 pstack 스킬 |
| --- | --- |
| 요구사항·복잡한 조사 | `figure-it-out`, `poteto-mode`, `how`, `why` |
| 설계·모듈 경계 | `architect`, `principle-model-the-domain`, `principle-boundary-discipline` |
| 기능 구현·버그 수정 | `poteto-mode`의 해당 playbook, `tdd`, `principle-fix-root-causes`, `principle-sequence-verifiable-units` |
| 검증·리뷰 | `principle-prove-it-works`, `blast-radius`, `interrogate` (허용된 Critic 역할 범위에서만) |
| TypeScript·형식 검증 | `typescript-best-practices`, `create-formal-verification-skill`, `statechart` |
| 문서·문구 | `technical-writing`, `unslop` |

- 우선순위는 현재 사용자 명시 요청과 기존 승인 → 이 `AGENTS.md`의 필수 프로젝트 정책 → 실제 도구·기술 제약 → pstack의 일반 워크플로 순이다. 충돌 시 상위 규칙을 따르고, 실제 제약과 영향은 보고한다.
- 에이전트 역할은 Orchestrator, Worker, Critic으로 제한한다. Orchestrator는 메인 에이전트가 `gpt-6.1-sol` / `high`, Worker는 `gpt-6-luna` / `max`, Critic은 `gpt-6.1-sol` / `medium`을 쓴다. Worker가 429 등 요청 한도 오류로 중단되면 무한 재시도하지 않고 `gpt-6.1-sol` / `medium`으로 대체한다. 모델과 reasoning effort는 생성 도구에서 명시한다. 지정할 수 없거나 해당 모델을 사용할 수 없으면 제한을 알리고, 대체 설정은 사용자 지시나 프로젝트 정책을 따른다. 허용된 대체 설정이 없으면 사용자에게 모델 선택을 확인하고, 그동안 해당 에이전트에 의존하지 않는 작업을 진행한다. 실제 사용 설정을 보고하며 요청문에 모델명을 적는 것만으로 지정했다고 보고하지 않는다. Worker의 429 fallback만 위에 정한 허용 예외다.
- Orchestrator는 요구사항·작업 분해·완료 조건을 정하고 Worker의 구현과 Critic의 검증을 중복하지 않는다. Worker와 Critic은 순차 진행한다. Critic은 독립 검토만 하고 코드를 수정하지 않으며, 지적사항은 Worker가 수정한 뒤 Critic이 재검토한다. 에이전트는 중첩 생성하지 않는다. 역할과 맥락이 맞는 기존 에이전트를 우선 재사용한다. 에이전트 생성 도구에 이름 지정 인자가 없으면 역할명은 업무상 호칭으로만 쓰고, UI 표시 이름을 지정했다고 말하지 않는다.
- pstack의 기본 모델·reasoning budget·다중 모델 panel, 병렬 위임, 매번 새 에이전트를 만들라는 지침은 프로젝트 정책을 바꾸지 않는다. `arena`, `swarm`, `interrogate`, `reflect`, `architect` 등에서 추가·병렬 subagent를 요구하는 절차는 허용된 역할·순서·모델 범위 안에서만 수행하고, 범위를 벗어나면 해당 단계를 생략하거나 순차적인 허용 절차로 처리하며 제한을 보고한다.
- 동작을 추가·변경할 때는 기존 `node --test` 환경에서 테스트를 먼저 작성하고 의도한 실패를 확인한 뒤 구현한다. 문서·설정 설치는 동작 테스트를 억지로 만들지 말고 파일·참조·출처 일치 검증을 적용한다. 게시 전 필수 명령은 위의 테스트 완료 후 게시 절차를 따른다.
- 기능별 워크트리와 `codex/` 브랜치 전략, 사용자의 기존 변경 보호, 커밋·merge·CI·게시 정책은 이 문서의 앞 절을 따른다. pstack의 PR 생성·merge·게시 요구사항은 별도 권한이 아니다. 프로젝트의 상시 merge·게시 승인은 정해진 검증 조건을 충족할 때 적용되며, 현재 사용자 요청이 더 제한적이면 그 요청이 우선한다.
- upstream `setup-pstack`은 Cursor용 `~/.cursor/rules/pstack-models.mdc`를 쓰는 설정 스킬이다. 이 프로젝트에서는 실행하지 않고 홈 설정이나 프로젝트 밖 설정 파일을 변경하지 않는다. 에이전트 모델·추론 수준은 위 프로젝트 정책을 따른다.
- pstack 스킬은 Cursor의 `Task`, `AskQuestion`, custom mode, Bugbot, Automations, PR 도구, `poteto-agent`·`comment-sicko` 및 Cursor 모델 문자열을 전제할 수 있다. Claude Code 어댑터 문서는 `.agents/docs/harness/claude-code.md`에 보관되어 있으나 Codex용 어댑터가 아니다. 현재 Codex 도구에서 실제 지원되는 항목만 사용하고, 지원되지 않는 호출·인자·통합은 실행한 것처럼 표현하지 말고 필요한 경우 생략 사유를 보고한다. `.agents/agents/`의 upstream 에이전트 문서는 참고 자료이며 Codex subagent를 등록하지 않는다.
- 원본·설치 방법·파일별 SHA-256 manifest와 Codex 사용상 한계는 `.agents/README.md`에 기록한다. 별도 전역 라우터·시작 훅을 만들거나 pstack의 upstream 스크립트를 설치 검증 과정에서 실행하지 않는다.
