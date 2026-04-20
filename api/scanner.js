// api/scanner.js — Auto Scanner Semua Saham IDX
// Dipanggil dari dashboard setiap 30 detik
// Scan 200+ saham, score otomatis, return A+ recommendations

const ITICK_BASE = 'https://api.itick.org';
const REGION = 'ID';

// 200+ saham IDX yang di-scan otomatis
const IDX_FULL = [
  'GOTO','BBCA','BMRI','BBRI','BBNI','TLKM','ASII','UNVR','BREN','AMMN',
  'MDKA','ADRO','PTBA','ITMG','ANTM','INCO','TINS','MEDC','PGAS','AKRA',
  'ICBP','INDF','KLBF','SIDO','MYOR','HMSP','GGRM','CPIN','JPFA','AALI',
  'LSIP','UNTR','HEXA','AUTO','GJTL','SMSM','SMGR','INTP','WTON','WIKA',
  'PTPP','ADHI','WSKT','JSMR','ISAT','EXCL','FREN','MTEL','TOWR','TBIG',
  'EMTK','BUKA','DNET','ARTO','BBYB','BBTN','BJBR','BJTM','NISP','MEGA',
  'BNGA','PNBN','ACES','MAPI','RALS','LPPF','ERAA','PWON','BSDE','SMRA',
  'CTRA','LPKR','DILD','PANI','KAEF','TSPC','MIKA','HEAL','KLBF','MNCN',
  'SCMA','FILM','PGEO','INCO','NCKL','MBMA','CUAN','ESSA','HRUM','BYAN',
  'DSSA','MCOL','ABMM','ARII','MYOH','MBSS','RIGS','SOCI','BSSR','KKGI',
  'ELSA','PKPK','RUIS','WINS','LEAD','SMDR','TMAS','NELY','HITS','BLTA',
  'BULL','PSSI','SAFE','CBMF','ASSA','BIRD','GIAA','CMPP','PPRE','META',
  'MTDL','MLPT','ACST','EPMT','DOID','GEMA','ICON','MREI','ABDA','AHAP',
  'AMAG','ASBI','ASJT','ASMI','ASRM','LPGI','MDRN','PNIN','PNLF','VINS',
  'AMOR','BMHS','DNAR','SAME','SILO','SRAJ','PRDA','CARE','DGNS','MENI',
  'LABA','FOOD','ARGO','CEKA','DLTA','FAST','MLBI','ROTI','SKBM','SKLT',
  'STTP','ULTJ','AISA','BTEK','BTPN','BVIC','DNAR','INPC','MCOR','SDRA',
  'AGRO','BANK','BCIC','BEKS','BGTG','BINA','BNBA','BPII','BRIS','BTPS',
  'IBFN','INPC','MAYA','NAGA','NOBU','PNBS','RBMS','AGRS','AHAP','ASDM',
  'BPFI','CFIN','FINN','HDFA','MFIN','PBID','TIFA','UCID','VRNA','WOMF',
];

function calcScore(q) {
  if (!q) return 0;
  const price    = q.ld  || 0;
  const prevClose= q.pc  || price;
  const high     = q.h   || price;
  const low      = q.lo  || price;
  const open_    = q.o   || price;
  const vol      = q.v   || 0;
  const avgVol   = q.avol|| vol || 1;

  const chg      = prevClose ? (price - prevClose) / prevClose * 100 : 0;
  const volRatio = avgVol ? vol / avgVol : 1;
  const gap      = prevClose ? (open_ - prevClose) / prevClose * 100 : 0;
  const rsi      = chg > 3 ? 68 : chg > 1 ? 58 : chg < -3 ? 32 : chg < -1 ? 42 : 52;
  const vwap     = (high + low + price) / 3;

  // Trap detection
  const upperWick    = (high - Math.max(open_, price)) > Math.abs(price - open_) * 1.5;
  const rsiExtreme   = rsi > 75 || rsi < 25;
  const volumeNoMove = volRatio > 2 && Math.abs(chg) < 0.3;
  const gapDump      = gap < -2;
  const anyTrap      = upperWick || rsiExtreme || volumeNoMove || gapDump;

  if (anyTrap) return { score: 0, label: 'avoid', chg, volRatio, rsi, vwap, gap };

  // Scoring
  let score = 0;
  score += chg >= 2 ? 28 : chg >= 1 ? 22 : chg >= 0 ? 15 : 5;
  score += (price > vwap) ? 23 : 12;
  score += volRatio >= 2.5 ? 19 : volRatio >= 1.5 ? 14 : volRatio >= 1 ? 8 : 3;
  score += rsi <= 65 ? 14 : rsi <= 72 ? 9 : 3;
  score += Math.abs(gap) <= 1 ? 10 : Math.abs(gap) <= 2 ? 7 : 3;
  score = Math.min(score, 100);

  // Auto label
  const hour = new Date().getHours();
  const isAfternoon = hour >= 13;
  let label = 'b';
  if (!isAfternoon && score >= 90) label = 'ai';       // A+ Intraday
  else if (isAfternoon && score >= 85) label = 'ab';   // A+ BSJP
  else if (score < 50) label = 'avoid';

  return { score, label, chg, volRatio, rsi, vwap, gap,
    trap: { upperWick, rsiExtreme, volumeNoMove, gapDump, fakeBreak: false } };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  const TOKEN = process.env.ITICK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'ITICK_TOKEN not set' });

  // Ambil filter dari query: ?filter=aplus untuk hanya A+
  const { filter = 'all', limit = '50' } = req.query;

  try {
    // Scan dalam batch 20 saham (batas API)
    const BATCH_SIZE = 20;
    const results = [];

    for (let i = 0; i < Math.min(IDX_FULL.length, parseInt(limit)); i += BATCH_SIZE) {
      const batch = IDX_FULL.slice(i, i + BATCH_SIZE);
      try {
        const r = await fetch(
          `${ITICK_BASE}/stock/ticks?region=${REGION}&codes=${batch.join(',')}`,
          { headers: { token: TOKEN } }
        );
        const j = await r.json();
        if (j.code === 0 && j.data) {
          batch.forEach(ticker => {
            const q = j.data[ticker];
            if (!q || !q.ld || q.ld <= 0) return;
            const ind = calcScore(q);
            // Filter sesuai request
            if (filter === 'aplus' && !['ai','ab'].includes(ind.label)) return;
            if (filter === 'avoid' && ind.label !== 'avoid') return;
            results.push({
              ticker,
              price:    q.ld,
              chg:      parseFloat((ind.chg || 0).toFixed(2)),
              score:    ind.score,
              label:    ind.label,
              volRatio: parseFloat((ind.volRatio || 0).toFixed(2)),
              rsi:      ind.rsi,
              vwap:     parseFloat((ind.vwap || 0).toFixed(0)),
              gap:      parseFloat((ind.gap || 0).toFixed(2)),
              volume:   q.v || 0,
              high:     q.h || q.ld,
              low:      q.lo || q.ld,
            });
          });
        }
      } catch (e) { /* skip batch error */ }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Stats
    const aplus   = results.filter(r => ['ai','ab'].includes(r.label));
    const bSetup  = results.filter(r => r.label === 'b');
    const avoided = results.filter(r => r.label === 'avoid');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    return res.status(200).json({
      timestamp: new Date().toISOString(),
      total_scanned: results.length,
      summary: { aplus: aplus.length, b_setup: bSetup.length, avoid: avoided.length },
      stocks: results,
      top_picks: aplus.slice(0, 10), // Top 10 A+ saja
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
