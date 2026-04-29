module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const { endpoint, code } = req.query;
  const TOKEN = process.env.ITICK_TOKEN;

  // Debug: cek token
  if (!TOKEN) {
    return res.status(500).json({ code: -1, msg: 'TOKEN MISSING' });
  }

  const BASE = 'https://api.itick.id';

  try {
    let url = '';

    if (endpoint === 'quote') {
      url = `${BASE}/stock/quote?token=${TOKEN}&region=ID&code=${code}`;
    } else if (endpoint === 'kline') {
      const iv = req.query.interval || '8';
      const lm = req.query.limit || '21';
      url = `${BASE}/stock/kline?token=${TOKEN}&region=ID&code=${code}&kType=${iv}&limit=${lm}`;
    } else if (endpoint === 'yahoo_history') {
      const period2 = Math.floor(Date.now() / 1000);
      const period1 = period2 - 90 * 86400;
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.JK?interval=1d&period1=${period1}&period2=${period2}`;
    } else {
      return res.status(400).json({ code: -1, msg: 'Unknown endpoint' });
    }

    // Log URL untuk debug (hapus setelah fix)
    console.log('Fetching:', url.replace(TOKEN, 'TOKEN_HIDDEN'));

    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!r.ok) {
      return res.status(200).json({ 
        code: -1, 
        msg: `iTick HTTP ${r.status}`,
        url_debug: url.replace(TOKEN, 'TOKEN_HIDDEN')
      });
    }

    const j = await r.json();
    return res.status(200).json(j);

  } catch (e) {
    return res.status(200).json({ 
      code: -1, 
      msg: e.message,
      type: e.constructor.name
    });
  }
};
