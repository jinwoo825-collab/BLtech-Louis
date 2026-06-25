// ===== Outlook(Microsoft Graph) 연동 설정 =====
// Azure Portal에서 앱 등록(SPA) 후 'Application (client) ID'를 아래 clientId 에 넣으세요.
// (대시보드 화면의 "Outlook 캘린더 연동" 칸에 직접 붙여넣어도 됩니다 — 그 값이 우선합니다.)
//
// 설정 방법: 같은 폴더의 OUTLOOK-SETUP.md 참고
// 보안: 비밀번호/ID는 어디에도 저장하지 않습니다. Microsoft 로그인(OAuth 2.0 + PKCE)만 사용합니다.

window.OUTLOOK_CONFIG = {
  clientId: "",        // 예: "11111111-2222-3333-4444-555555555555"
  tenant: "common",    // 개인+회사 계정 모두: "common" / 특정 조직만: 테넌트 ID
  timeZone: "Asia/Seoul"
};
