export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { endpoint, code, interval, limit } = req.query;
  const TOKEN = process.env.ITICK_TOKEN;

  if (!TOKEN) {
    return res.status(500).json({ code: -1, msg: 'ITICK_TOKEN not set' });
  }

  const BASE = 'https://api.itick.id';

  try {
    let url = '';

    if (endpoint === 'quote') {
      url = `${BASE}/stock/quote?token=${TOKEN}&region=ID&code=${code}`;
    } else if (endpoint === 'kline') {
      const iv = interval || '8';
      const lm = limit || '21';
      url = `${BASE}/stock/kline?token=${TOKEN}&region=ID&code=${code}&kType=${iv}&limit=${lm}`;
    } else if (endpoint === 'yahoo_history') {
      // Yahoo Finance via public API
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - 90 * 86400;
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.JK?interval=1d&period1=${period1}&period2=${period2}`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const j = await r.json();
      return res.status(200).json({ code: 0, data: j });
    } else {
      return res.status(400).json({ code: -1, msg: 'Unknown endpoint' });
    }

    const r = await fetch(url);
    const j = await r.json();
    return res.status(200).json(j);
