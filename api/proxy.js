export default async function handler(req, res) {
  // CORS — izinkan semua origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const TOKEN = process.env.ITICK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'Token not set' });

  const { endpoint, ...params } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const allowed = ['quote', 'ticks', 'kline', 'tick', 'info'];
  if (!allowed.includes(endpoint)) return res.status(400).json({ error: 'endpoint not allowed' });

  const searchParams = new URLSearchParams({ region: 'ID', ...params });
  const url = `https://api.itick.org/stock/${endpoint}?${searchParams}`;

  try {
    const response = await fetch(url, {
      headers: { 'token': TOKEN, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
