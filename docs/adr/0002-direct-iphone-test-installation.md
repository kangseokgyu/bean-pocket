---
status: superseded by ADR-0003
---

# 외부 호스팅 없이 개인 iPhone에 테스트 앱 직접 설치

2026-10-17 사용자는 설치와 업데이트가 개인 초기 테스트용이므로 다른 서비스를 이용하지 않고 본인 iPhone에 직접 업로드하기로 했다. 기존 PWA·Cloudflare Pages 배포 결정은 대체한다. 웹 화면을 포함한 iOS 앱 패키지를 Mac에서 빌드해 Xcode로 기기에 직접 설치하는 경로를 제안하며, 구체적인 도구와 무료·유료 서명 방식은 후속 인터뷰에서 확정한다.

Notion 직접 통신, 조회·신규 추가·레시피 복사, 앱 시작·새로고침·저장 후 재조회는 유지한다. 앱 자체 암호화·암호 입력·잠금·잠금 해제·기존 항목 수정·삭제는 제외한다. 토큰은 앱 전용 데이터 컨테이너의 파일에 보관하고 재실행 시 읽으며, 일반 업데이트 때 유지되고 앱 완전 삭제 후 재설치 때 남지 않아야 한다. Notion 원본은 유지한다. 검증 기기는 사용자가 지정한 iPhone 12 / iOS 27.0.1이며 빌드·서명 호환성과 저장·삭제 동작은 아직 검증하지 않았다.

무료 Personal Team의 프로비저닝은 Apple 공식 문서상 7일 후 만료되어 다시 빌드·설치해야 한다. 이 반복 설치 부담의 수용 여부를 확인하며 유료 가입은 임의로 진행하지 않는다. PC 지원은 기존 로컬 웹앱을 유지하는 안을 후속 확인한다.

근거: [Apple 개발자 계정과 Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account), [Capacitor iOS 안내](https://capacitorjs.com/docs/ios), [Apple 앱 파일 시스템](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html).

최신 사용자 요청으로 네이티브 iPhone 앱을 만들지 않기로 했으므로 본 직접 설치 방향은 폐기한다. GitHub Pages PWA 배포 가능성을 검토하며 세부 내용은 [현재 인터뷰](../iphone-interview.md)를 따른다.

현재 확정 방향은 [ADR-0003](0003-github-pages-personal-pwa.md)의 GitHub Pages PWA다.
