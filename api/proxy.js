export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, code, interval, limit } = req.query;
  const TOKEN = process.env.ITICK_TOKEN;

  try {

    // ── ITICK endpoints (existing) ──
    if (endpoint === 'quote' || endpoint === 'kline') {
      let url = '';
      if (endpoint === 'quote') url = `https://api.itick.org/sstock/quot?region=ID&code=${code}&token=${TOKEN}`;
      if (endpoint === 'kline') url = `https://api.itick.org/sstock/kline?region=ID&code=${code}&kType=${interval||8}&num=${limit||21}&token=${TOKEN}`;
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const j = await r.json();
      return res.status(200).json(j);
    }

    // ── IDX Foreign Flow ──
    if (endpoint === 'idx_foreign') {
      const r = await fetch(
        'https://www.idx.co.id/umbraco/Surface/StockData/GetStockSummary?start=0&length=20&s=ForeignBuy&o=desc',
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.idx.co.id/' } }
      );
      const j = await r.json();
      return res.status(200).json({ code: 0, data: j });
    }

    // ── IDX Top Gainer ──
    if (endpoint === 'idx_gainer') {
      const r = await fetch(
        'https://www.idx.co.id/umbraco/Surface/StockData/GetStockSummary?start=0&length=20&s=PercentChange&o=desc',
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.idx.co.id/' } }
      );
      const j = await r.json();
      return res.status(200).json({ code: 0, data: j });
    }

    // ── IDX Top Loser ──
    if (endpoint === 'idx_loser') {
      const r = await fetch(
        'https://www.idx.co.id/umbraco/Surface/StockData/GetStockSummary?start=0&length=20&s=PercentChange&o=asc',
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.idx.co.id/' } }
      );
      const j = await r.json();
      return res.status(200).json({ code: 0, data: j });
    }

    // ── IDX Sector Performance ──
    if (endpoint === 'idx_sector') {
      const r = await fetch(
        'https://www.idx.co.id/umbraco/Surface/StockData/GetIndexConstituent?indexCode=ALL&start=0&length=0',
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.idx.co.id/' } }
      );
      const j = await r.json();
      return res.status(200).json({ code: 0, data: j });
    }

    // ── Yahoo Finance Historical ──
    if (endpoint === 'yahoo_history') {
      const ticker = code + '.JK';
      const to   = Math.floor(Date.now() / 1000);
      const from = to - (90 * 24 * 60 * 60); // 90 hari
      const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${from}&period2=${to}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });
      const j = await r.json();
      return res.status(200).json({ code: 0, data: j });
    }

    return res.status(400).json({ error: 'Unknown endpoint' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
