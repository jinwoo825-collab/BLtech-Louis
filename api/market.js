// 실시간 경제지표 프록시 (Yahoo Finance) — Vercel 서버리스 함수
// 코스피/코스닥/원달러/원엔/미국채10년 을 한 번에 조회해 JSON 으로 반환합니다.
// CORS 허용(*) — 로컬(.bat) 대시보드에서도 이 함수를 호출해 동일하게 사용합니다.

const SYMBOLS = {
  kospi: '^KS11',     // 코스피 종합
  kosdaq: '^KQ11',    // 코스닥 종합
  usdkrw: 'KRW=X',    // 원/달러
  jpykrw: 'JPYKRW=X', // 원/엔 (1엔당 원)
  ust10y: '^TNX',     // 미국 10년 국채 금리
};

async function fetchOne(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  if (!r.ok) throw new Error('status ' + r.status);
  const j = await r.json();
  const m = j.chart.result[0].meta;
  const price = m.regularMarketPrice;
  const prev = (m.chartPreviousClose != null) ? m.chartPreviousClose : m.previousClose;
  return {
    price,
    prev,
    change: (price != null && prev != null) ? price - prev : 0,
    changePct: prev ? ((price - prev) / prev * 100) : 0,
    time: m.regularMarketTime || null,
  };
}

export default async function handler(req, res) {
  const data = {};
  await Promise.all(Object.entries(SYMBOLS).map(async ([key, sym]) => {
    try { data[key] = await fetchOne(sym); }
    catch (e) { data[key] = null; }
  }));
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.status(200).json({ ts: Date.now(), data });
}
