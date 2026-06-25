# 📅 Outlook 캘린더 연동 설정 (Microsoft Graph · OAuth)

대시보드에서 **Outlook 일정을 조회·추가·수정·삭제**할 수 있게 합니다.
비밀번호·ID는 **저장하지 않으며**, Microsoft 로그인 창에서 대표님이 직접 로그인합니다(OAuth 2.0 + PKCE).

처음 한 번만 **Azure에 앱 등록**을 하면 됩니다. (5분)

---

## 1단계 — Azure에 앱 등록

1. https://entra.microsoft.com 또는 https://portal.azure.com 접속 → **App registrations(앱 등록)** → **New registration(새 등록)**
2. 이름: `BLtech Dashboard` (자유)
3. 지원 계정 유형: **"Accounts in any organizational directory and personal Microsoft accounts"**
   (개인 Outlook.com + 회사/학교 계정 모두 허용)
4. **Redirect URI(리디렉션 URI)** — 플랫폼은 반드시 **Single-page application (SPA)** 선택 후 아래 주소를 추가:
   - `https://b-ltech-louis.vercel.app/desktop-pms/`   ← 웹에서 사용할 때
   - `http://localhost:8765/`                          ← 내 PC에서 `대시보드 실행.bat` 으로 사용할 때

   > 두 개 모두 등록하세요. (Azure 앱 → Authentication → Single-page application → Add URI 로 추가 가능)
5. **Register(등록)** 클릭

## 2단계 — 권한 부여

1. 등록된 앱 → **API permissions(API 권한)** → **Add a permission** → **Microsoft Graph** → **Delegated permissions(위임된 권한)**
2. 다음 2개 추가:
   - `Calendars.ReadWrite`  (일정 읽기/쓰기)
   - `User.Read`            (로그인한 사용자 정보)
3. (회사/학교 계정이면) **Grant admin consent(관리자 동의)** 클릭 — 개인 계정은 불필요

## 3단계 — Client ID 복사 → 대시보드에 입력

1. 앱 **Overview(개요)** → **Application (client) ID** 복사 (예: `11111111-2222-...`)
2. 대시보드 → **📅 개인 일정** 메뉴 → 상단 **"Outlook 캘린더 연동"** 칸에 붙여넣고 **저장**
   - (또는 `desktop-pms/outlook-config.js` 의 `clientId` 에 직접 입력)

## 4단계 — 연결

1. **"Microsoft 계정으로 연결"** 버튼 클릭 → Microsoft 로그인 창에서 로그인 → 권한 동의
2. 연결되면 Outlook 일정이 표에 표시됩니다.
   - 대시보드에서 **추가·수정·삭제 → Outlook에 자동 반영**
   - **60초마다 자동 동기화**(Outlook에서 바뀐 일정도 반영) · "새로고침"으로 즉시 동기화

---

## 보안 요약
- 대표님의 **ID/비밀번호는 이 프로그램에 저장되지 않습니다.** 로그인은 Microsoft 공식 창에서만 이뤄집니다.
- 앱은 **Client ID(공개값)** 만 사용하며 비밀 키(secret)는 쓰지 않습니다(SPA 공개 클라이언트 + PKCE).
- 발급된 토큰은 브라우저 안(MSAL 캐시)에만 보관되고, 로그아웃 시 제거됩니다.

## 참고
- 로그인/연동은 **`대시보드 실행.bat`(http://localhost:8765/)** 또는 **웹(https://b-ltech-louis.vercel.app/desktop-pms/)** 에서 동작합니다.
  (`index.html`을 그냥 더블클릭한 `file://` 모드에서는 OAuth가 동작하지 않습니다.)
- "완전 실시간 푸시"(즉시 반영)가 필요하면 Microsoft Graph 구독(webhook) + 서버가 추가로 필요합니다 — 현재는 60초 폴링 방식입니다.
