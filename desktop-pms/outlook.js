// Outlook(Microsoft Graph) 캘린더 연동 모듈
// - OAuth 2.0 Authorization Code + PKCE (MSAL.js, 공개 클라이언트) → 비밀번호/시크릿 저장 안 함
// - Microsoft 로그인 팝업으로 대표가 직접 로그인, 토큰은 브라우저(MSAL 캐시)에만 보관
// - 일정 조회/추가/수정/삭제 = Microsoft Graph /me/events 호출
// 전역 객체 window.Outlook 로 노출됩니다.
(function () {
  "use strict";
  var CFG = window.OUTLOOK_CONFIG || {};
  var clientId = CFG.clientId || "";
  try { var saved = localStorage.getItem("blt.ol.clientId"); if (saved) clientId = saved; } catch (e) {}
  var tenant = CFG.tenant || "common";
  var SCOPES = ["User.Read", "Calendars.ReadWrite"];
  var TZ = (CFG.timeZone) || "Asia/Seoul";
  var pca = null, ready = false, pollTimer = null, changeCb = null;

  function configured() { return !!clientId; }
  function setClientId(id) { clientId = (id || "").trim(); try { localStorage.setItem("blt.ol.clientId", clientId); } catch (e) {} ready = false; pca = null; }

  function redirectUri() { return location.origin + location.pathname; }

  async function ensure() {
    if (ready && pca) return;
    if (!clientId) throw new Error("Client ID가 설정되지 않았습니다.");
    if (typeof msal === "undefined") throw new Error("로그인 라이브러리(MSAL)를 불러오지 못했습니다. 인터넷 연결을 확인하세요.");
    pca = new msal.PublicClientApplication({
      auth: { clientId: clientId, authority: "https://login.microsoftonline.com/" + tenant, redirectUri: redirectUri() },
      cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
    });
    await pca.initialize();
    var accts = pca.getAllAccounts();
    if (accts.length && !pca.getActiveAccount()) pca.setActiveAccount(accts[0]);
    ready = true;
  }

  function connected() { return !!(pca && pca.getActiveAccount()); }
  function account() { var a = pca && pca.getActiveAccount(); return a ? { name: a.name, email: a.username } : null; }

  async function connect() {
    await ensure();
    var r = await pca.loginPopup({ scopes: SCOPES, prompt: "select_account" });
    pca.setActiveAccount(r.account);
    return account();
  }
  async function signout() {
    if (!pca) return;
    var a = pca.getActiveAccount();
    try { await pca.logoutPopup({ account: a, mainWindowRedirectUri: redirectUri() }); }
    catch (e) { try { pca.setActiveAccount(null); } catch (e2) {} }
  }

  async function token() {
    await ensure();
    var a = pca.getActiveAccount() || pca.getAllAccounts()[0];
    if (!a) throw new Error("not_connected");
    try { var r = await pca.acquireTokenSilent({ scopes: SCOPES, account: a }); return r.accessToken; }
    catch (e) { var r2 = await pca.acquireTokenPopup({ scopes: SCOPES, account: a }); return r2.accessToken; }
  }

  async function graph(method, path, body) {
    var t = await token();
    var res = await fetch("https://graph.microsoft.com/v1.0" + path, {
      method: method,
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", Prefer: 'outlook.timezone="' + TZ + '"' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    var j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok) throw (j && j.error) ? new Error(j.error.message || j.error.code) : new Error("Graph 오류 " + res.status);
    return j;
  }

  function pad(n) { return String(n).padStart(2, "0"); }
  function addHour(hhmm) { var p = hhmm.split(":"); var h = (Number(p[0]) + 1) % 24; return pad(h) + ":" + (p[1] || "00"); }
  function nextDay(d) { var dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + 1); return dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate()); }

  function toEvent(ev) {
    var sd = ev.start && ev.start.dateTime ? ev.start.dateTime : null;
    return {
      id: ev.id,
      subject: ev.subject || "(제목 없음)",
      date: sd ? sd.slice(0, 10) : "",
      time: (ev.isAllDay || !sd) ? "" : sd.slice(11, 16),
      location: (ev.location && ev.location.displayName) || "",
      allDay: !!ev.isAllDay,
    };
  }
  function buildGraphEvent(o) {
    if (o.time) {
      return {
        subject: o.title, location: { displayName: o.place || "" }, isAllDay: false,
        start: { dateTime: o.date + "T" + o.time + ":00", timeZone: TZ },
        end: { dateTime: o.date + "T" + addHour(o.time) + ":00", timeZone: TZ },
      };
    }
    return {
      subject: o.title, location: { displayName: o.place || "" }, isAllDay: true,
      start: { dateTime: o.date + "T00:00:00", timeZone: TZ },
      end: { dateTime: nextDay(o.date) + "T00:00:00", timeZone: TZ },
    };
  }

  async function listEvents() {
    var now = new Date();
    var from = new Date(now.getTime() - 3 * 86400000);
    var to = new Date(now.getTime() + 90 * 86400000);
    var q = "/me/calendarView?startDateTime=" + from.toISOString() + "&endDateTime=" + to.toISOString() +
      "&$orderby=start/dateTime&$top=100&$select=subject,start,end,location,isAllDay";
    var j = await graph("GET", q);
    return (j.value || []).map(toEvent);
  }
  async function createEvent(o) { return await graph("POST", "/me/events", buildGraphEvent(o)); }
  async function updateEvent(id, o) { return await graph("PATCH", "/me/events/" + encodeURIComponent(id), buildGraphEvent(o)); }
  async function deleteEvent(id) { return await graph("DELETE", "/me/events/" + encodeURIComponent(id)); }

  function onChange(cb) { changeCb = cb; }
  async function refresh() {
    try { var ev = await listEvents(); if (changeCb) changeCb(ev, null); return ev; }
    catch (e) { if (changeCb) changeCb(null, e); throw e; }
  }
  function startPolling(ms) { stopPolling(); pollTimer = setInterval(function () { if (connected()) refresh().catch(function () {}); }, ms || 60000); }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  window.Outlook = {
    configured: configured, setClientId: setClientId, ensure: ensure,
    connected: connected, account: account, connect: connect, signout: signout,
    listEvents: listEvents, createEvent: createEvent, updateEvent: updateEvent, deleteEvent: deleteEvent,
    onChange: onChange, refresh: refresh, startPolling: startPolling, stopPolling: stopPolling,
  };
})();
