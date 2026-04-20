// api/proxy.js — Vercel Serverless Function
// Proxy semua request ke ITICK API dengan CORS headers
// Token ITICK disimpan di Vercel Environment Variables (aman)

const ITICK_BASE = 'https://api.itick.org';
const REGION = 'ID';

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Ambil token dari environment variable Vercel (AMAN — tidak exposed ke browser)
  const TOKEN = process.env.ITICK_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: 'ITICK_TOKEN not configured in Vercel env vars' });
  }

  // Ambil endpoint dari query: /api/proxy?endpoint=quote&code=GOTO
  const { endpoint, ...params } = req.query;
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint parameter required' });
  }

  // Validasi endpoint yang diizinkan
  const allowed = ['quote', 'ticks', 'kline', 'tick', 'info'];
  if (!allowed.includes(endpoint)) {
    return res.status(400).json({ error: `endpoint not allowed. Use: ${allowed.join(', ')}` });
  }

  // Build URL ke ITICK
  const searchParams = new URLSearchParams({ region: REGION, ...params });
  const url = `${ITICK_BASE}/stock/${endpoint}?${searchParams}`;

  try {
    const response = await fetch(url, {
      headers: {
        'token': TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `ITICK API error: ${response.status}` });
    }

    const data = await response.json();

    // Set CORS & cache headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3, stale-while-revalidate=5'); // cache 3 detik
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
