// 비엘테크 임직원 전용 AI 도우미 — Vercel 서버리스 함수 (Node.js + OpenAI)
// - 회사 지식베이스(company-knowledge.js)에 근거해 회사 관련 질문에 답변
// - 기본은 꺼짐: 환경변수 OPENAI_API_KEY 가 없으면 {ok:false, reason:"no_key"} 반환
// - 내부용 접속 보호: 환경변수 ASSISTANT_PASSCODE 설정 시, 헤더 x-emp-pass 가 일치해야 함
// - 모델은 환경변수 OPENAI_MODEL 로 지정(기본값 아래) — 정확한 모델 ID로 바꾸기 쉽게 분리
import { COMPANY_KB } from './company-knowledge.js';

async function readBody(req) {
  if (req.body) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body; }
  return await new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// 모델 ID는 소문자여야 함(예: gpt-5.5). 대문자/공백을 넣어도 자동 보정.
const MODEL = (process.env.OPENAI_MODEL || 'gpt-5.5').trim().toLowerCase();

const SYSTEM = `당신은 비엘테크(주)의 임직원 전용 AI 도우미입니다. 아래 [회사 정보]에 근거해 임직원의 회사 관련 질문에 친절하고 정확하게 답합니다.
- 회사 정보에 있는 내용은 구체적으로 답하고, 없는 내용은 지어내지 말고 "확인되지 않은 정보"라고 안내한 뒤 담당 부서 문의를 권하세요.
- 한국어로, 정중하고 간결하게(핵심 위주, 불릿 활용).

[회사 정보]
${COMPANY_KB}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-emp-pass');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(200).json({ ok: false, reason: 'method' }); return; }

  // 내부 접속 코드 검사 (설정된 경우)
  const pass = process.env.ASSISTANT_PASSCODE;
  if (pass && req.headers['x-emp-pass'] !== pass) { res.status(200).json({ ok: false, reason: 'bad_pass' }); return; }

  let body;
  try { body = await readBody(req); } catch { body = {}; }

  // 로그인 검증용 핑 (OpenAI 호출 없이 접속 코드만 확인)
  if (body.ping) { res.status(200).json({ ok: true, ping: true, model: MODEL }); return; }

  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(200).json({ ok: false, reason: 'no_key' }); return; }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!messages.length) { res.status(200).json({ ok: false, reason: 'empty' }); return; }

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
        max_completion_tokens: 1200,
      }),
    });
    const j = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, reason: 'api_error', detail: (j && j.error && j.error.message) || ('HTTP ' + r.status) }); return; }
    const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    res.status(200).json({ ok: true, text: text.trim(), model: MODEL });
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'network', detail: String(e && e.message || e) });
  }
}
