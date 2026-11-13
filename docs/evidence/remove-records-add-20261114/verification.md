# 추출 기록 중복 추가 버튼 제거

추출 기록 상단의 + 버튼과 전용 이벤트, showRecordForm 메서드, 전용 분기를 제거했다. 다른 기록 작성 경로와 공유 입력창은 유지했다. 단순 삭제 작업으로 서브에이전트 없이 직접 수행했다.

Laziness Protocol에 따라 사용처가 사라진 코드만 삭제했다. Model the Domain에 따라 기존 기록·초안 구조를 유지했다. Cursor 전용 deslop·control-ui 도구는 제공되지 않아 diff 확인과 프로젝트 Chrome 검증을 사용했다.

## 검증

- 제거 전 버튼 존재 때문에 회귀 테스트가 실패하는 것을 확인했다. 첫 실패 출력은 DOM 객체 출력 중 메모리 한도에 도달하여 존재 여부를 boolean으로 비교하도록 수정했다.
- npm test 통과. 813개 성공, 실패 0개. tests.log에 로컬 로그를 남겼다.
- npm run build:pages 및 npm run check:pages 통과. 일반판 빌드 2518db12f4a7. build.log에 로컬 로그를 남겼다.
- npm run test:browser 통과. Chrome 회귀 검사 24개 성공. browser.log에 로컬 로그를 남겼다. 최초 시도는 샌드박스의 localhost listen EPERM으로 중단되어 실행 권한을 적용해 재시도했다.
- 실제 Chrome이 생성한 390px·1280px 기록 화면 DOM에서 중복 버튼 부재를 확인했다. 화면과 상세 결과는 /private/tmp/remove-records-final-browser/regression에 보관했다.
- git diff --check 통과. pwa 내 show-record-form 및 showRecordForm 참조가 남아 있지 않음을 확인했다.
- iPhone 실기기와 실제 Notion 저장은 확인하지 않았다. 브라우저 검사는 가짜 저장소를 사용했다.

원래 작업 폴더의 pwa/styles.css 미커밋 변경을 보존했다. 원격 main의 최신 변경을 기능 브랜치에 반영한 뒤 다시 검증했다.
