// 대표이사 AI 비서 — Vercel 서버리스 함수 (Anthropic Claude)
// 영업·생산·구매·재무·연구개발 데이터를 종합해 의사결정을 돕고, 위험을 먼저 알립니다. (읽기 전용)
// 기본은 꺼짐: 환경변수 ANTHROPIC_API_KEY 가 없으면 {ok:false, reason:"no_key"} 를 반환 → 프론트는 로컬 엔진으로 동작.
// 선택: 환경변수 BL_CHAT_PASSCODE 설정 시, 요청 헤더 x-bl-pass 가 일치해야 함(오남용 방지).

async function readBody(req) {
  if (req.body) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body; }
  return await new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const SYSTEM = `당신은 비엘테크(주) 대표이사의 AI 경영 비서입니다. 일반적인 잡담이 아니라, 제공된 회사 데이터에 근거해 경영 의사결정을 돕습니다.

[답변 형식] 반드시 아래 4단계 순서로, 각 제목을 굵게(**제목**) 표기하세요.
**결론** — 한두 문장으로 핵심 답.
**근거** — 데이터의 구체적 숫자로 뒷받침(불릿 -).
**위험** — 관련 리스크(없으면 "특이 위험 없음").
**추천 행동** — 대표가 취할 다음 행동(불릿 -).

[원칙]
- [현황 데이터]의 실제 숫자에만 근거하세요. 데이터에 없는 내용은 추정하지 말고 모른다고 하세요.
- 데이터를 절대 직접 수정하지 마세요. 수정 요청이 오면 무엇을 어떻게 바꿀지 요약한 뒤 "확인해 주시면 반영하겠습니다"라고 되물어 반드시 확인을 받으세요(임의 실행 금지).
- 한국어로, 대표이사에게 보고하듯 간결하게. 탐색적 사고 과정은 쓰지 말고 최종 답변만 출력하세요.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, x-bl-pass');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(200).json({ ok: false, reason: 'method' }); return; }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(200).json({ ok: false, reason: 'no_key' }); return; }

  const pass = process.env.BL_CHAT_PASSCODE;
  if (pass && req.headers['x-bl-pass'] !== pass) { res.status(200).json({ ok: false, reason: 'bad_pass' }); return; }

  let body;
  try { body = await readBody(req); } catch { body = {}; }
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  if (!messages.length) { res.status(200).json({ ok: false, reason: 'empty' }); return; }
  const snapshot = body.snapshot || {};
  const system = SYSTEM + '\n\n[현황 데이터]\n' + JSON.stringify(snapshot);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1200,
        system,
        messages,
      }),
    });
    const j = await r.json();
    if (!r.ok) { res.status(200).json({ ok: false, reason: 'api_error', detail: (j && j.error && j.error.message) || '' }); return; }
    const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    res.status(200).json({ ok: true, text });
  } catch (e) {
    res.status(200).json({ ok: false, reason: 'network' });
  }
}
