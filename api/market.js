// 실시간 경제지표 프록시 — Vercel 서버리스 함수
// 코스피/코스닥/원달러/원엔/미국채10년 = Yahoo Finance
// 국고채 10년(대한민국) = TradingView scanner (Yahoo에 한국 국채가 없어서)
// CORS 허용(*) — 로컬(.bat) 대시보드에서도 이 함수를 호출해 동일하게 사용합니다.

const YAHOO = {
  kospi: '^KS11',
  kosdaq: '^KQ11',
  usdkrw: 'KRW=X',
  jpykrw: 'JPYKRW=X',
  ust10y: '^TNX',
};

async function fetchYahoo(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!r.ok) throw new Error('status ' + r.status);
  const j = await r.json();
  const m = j.chart.result[0].meta;
  const price = m.regularMarketPrice;
  const prev = (m.chartPreviousClose != null) ? m.chartPreviousClose : m.previousClose;
  return {
    price, prev,
    change: (price != null && prev != null) ? price - prev : 0,
    changePct: prev ? ((price - prev) / prev * 100) : 0,
    time: m.regularMarketTime || null,
  };
}

// 대한민국 국고채 10년 수익률 (TVC:KR10Y) — TradingView scanner
async function fetchKR10Y() {
  const r = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    body: JSON.stringify({ symbols: { tickers: ['TVC:KR10Y'] }, columns: ['close', 'change', 'change_abs'] }),
  });
  if (!r.ok) throw new Error('scanner ' + r.status);
  const j = await r.json();
  const it = (j.data || [])[0];
  if (!it || !it.d) throw new Error('no data');
  const close = it.d[0], chgPct = it.d[1], chgAbs = it.d[2];
  return {
    price: close,
    prev: (close != null && chgAbs != null) ? close - chgAbs : null,
    change: chgAbs || 0,
    changePct: chgPct || 0,
    time: null,
  };
}

export default async function handler(req, res) {
  const data = {};
  await Promise.all([
    ...Object.entries(YAHOO).map(async ([key, sym]) => {
      try { data[key] = await fetchYahoo(sym); } catch (e) { data[key] = null; }
    }),
    (async () => { try { data.kr10y = await fetchKR10Y(); } catch (e) { data.kr10y = null; } })(),
  ]);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.status(200).json({ ts: Date.now(), data });
}
