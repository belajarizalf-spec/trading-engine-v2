const https = require('https');

function httpsGet(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'token': token,
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      timeout: 8000,
    };
    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch(e) { reject(new Error('Parse error: ' + data.slice(0,200))); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, code, interval, limit } = req.query;
  const TOKEN = process.env.ITICK_TOKEN;

  if (!TOKEN) return res.status(500).json({ code: -1, msg: 'TOKEN MISSING' });

  const BASE = 'https://api-free.itick.org';

  try {
    let url = '';

    if (endpoint === 'quote') {
      url = `${BASE}/stock/quote?region=ID&code=${code}`;

    } else if (endpoint === 'kline') {
      url = `${BASE}/stock/kline?region=ID&code=${code}&kType=${interval||'8'}&limit=${limit||'21'}`;

    } else if (endpoint === 'yahoo_history') {
      const p2 = Math.floor(Date.now() / 1000);
      const p1 = p2 - 90 * 86400;
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.JK?interval=1d&period1=${p1}&period2=${p2}`;
      const r = await httpsGet(url, TOKEN);
      return res.status(200).json({ code: 0, data: r.json });

    } else {
      return res.status(400).json({ code: -1, msg: 'Unknown endpoint' });
    }

    const result = await httpsGet(url, TOKEN);
    return res.status(200).json(result.json);

  } catch (e) {
    return res.status(200).json({ code: -1, msg: e.message });
  }
};
