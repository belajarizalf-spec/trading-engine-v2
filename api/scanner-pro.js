// api/scanner-pro.js
// Multi-Layer Scanner Pro — 200 saham IDX aktif
// Layer 1: Core 35 | Layer 2: Momentum | Layer 3: Gorila | Layer 4: Recovery

const ITICK_BASE = 'https://api.itick.org';
const REGION = 'ID';

// 200 saham IDX paling aktif
const IDX_200 = [
  // Banking
  'BBCA','BMRI','BBRI','BBNI','BBTN','BRIS','ARTO','BBYB','BNGA','NISP',
  'MEGA','PNBN','BJBR','BJTM','BTPS','AGRO','MCOR','MAYA','NOBU','BANK',
  // Technology
  'GOTO','BUKA','EMTK','DNET','MLPT','MTDL','ENVY','AXIO','EDGE','LUCK',
  // Telco
  'TLKM','ISAT','EXCL','FREN','MTEL','TOWR','TBIG','CENT','TELE','GHON',
  // Mining
  'ADRO','PTBA','ITMG','BYAN','HRUM','DSSA','MDKA','AMMN','ANTM','INCO',
  'TINS','NCKL','MBMA','CUAN','BRMS','NICL','MCOL','ABMM','ARII','MYOH',
  'ESSA','ELSA','PKPK','ARTI','BSSR','KKGI','GTBO','SMMT','APEX','DOID',
  // Energy
  'BREN','PGEO','MEDC','PGAS','AKRA','WINS','LEAD','RIGS','SOCI','BULL',
  // Consumer
  'UNVR','ICBP','INDF','MYOR','HMSP','GGRM','KLBF','SIDO','DLTA','MLBI',
  'ROTI','ULTJ','SKBM','CEKA','FOOD','ARGO','FAST','STTP','AISA','SKLT',
  // Property
  'PWON','BSDE','SMRA','CTRA','LPKR','DILD','PANI','BKSL','DART','MKPI',
  'JRPT','ASRI','BEST','KIJA','RODA','MDLN','PPRO','NRCA','SSIA','COWL',
  // Construction
  'WIKA','PTPP','ADHI','WSKT','WTON','NRCA','ACST','TOTL','DGIK','PBSA',
  // Auto & Heavy
  'ASII','UNTR','HEXA','AUTO','GJTL','SMSM','MASA','IMAS','LPIN','BOLT',
  // Healthcare
  'KLBF','KAEF','TSPC','MIKA','HEAL','PRDA','CARE','DGNS','SAME','SILO',
  // Retail & Trade
  'ACES','MAPI','LPPF','ERAA','RALS','ARGO','MIDI','CSAP','AMRT','HERO',
  // Infrastructure
  'JSMR','CMNP','META','BIRD','TAXI','GIAA','CMPP','SAFE','ASSA','BLTA',
  // Media
  'MNCN','SCMA','FILM','VISI','MSKY','KPIG','ABBA','MARI','TMPO','OASA',
  // Industry
  'SMGR','INTP','WTON','AMFG','TOTO','ARNA','MLIA','MARK','KBLI','KBLM',
];

// Scoring functions per layer
function scoreCore(q) {
  if (!q || !q.ld) return null;
  const price = q.ld, prev = q.pc || price;
  const chg = prev ? (price-prev)/prev*100 : 0;
  const vol = q.v || 0, avgVol = q.avol || vol || 1;
  const volRatio = avgVol ? vol/avgVol : 1;
  const high = q.h || price, low = q.lo || price, open = q.o || price;
  const vwap = (high+low+price)/3;
  const gap = prev ? (open-prev)/prev*100 : 0;
  const rsi = chg>3?68:chg>1?58:chg<-3?32:chg<-1?42:52;
  const upperWick = (high-Math.max(open,price)) > Math.abs(price-open)*1.5;
  const rsiExtreme = rsi>75||rsi<25;
  const volNoMove = volRatio>2&&Math.abs(chg)<0.3;
  const gapDump = gap<-2;
  const anyTrap = upperWick||rsiExtreme||volNoMove||gapDump;
  if (anyTrap) return { score:0, label:'avoid', chg, volRatio, rsi, price, vwap, gap, trap:true };
  let s = 0;
  s += chg>=2?28:chg>=1?22:chg>=0?15:5;
  s += (price>vwap)?23:12;
  s += volRatio>=2.5?19:volRatio>=1.5?14:volRatio>=1?8:3;
  s += rsi<=65?14:rsi<=72?9:3;
  s += Math.abs(gap)<=1?10:Math.abs(gap)<=2?7:3;
  s = Math.min(s,100);
  const isAfternoon = new Date().getHours()>=13;
  const label = s>=90&&!isAfternoon?'ai':s>=85&&isAfternoon?'ab':s>=70?'b':'avoid';
  return { score:s, label, chg, volRatio, rsi, price, vwap, gap, trap:false, high, low, open, vol, prev };
}

function scoreMomentum(q, ticker) {
  if (!q || !q.ld) return null;
  const price = q.ld, prev = q.pc || price;
  const chg = prev ? (price-prev)/prev*100 : 0;
  const vol = q.v || 0, avgVol = q.avol || vol || 1;
  const volRatio = avgVol ? vol/avgVol : 1;
  const high = q.h || price, low = q.lo || price;
  // Momentum criteria: volume spike + positive movement
  if (chg < 0.5) return null; // tidak momentum kalau tidak naik
  if (volRatio < 1.5) return null; // butuh volume di atas rata-rata
  let s = 0;
  s += chg>=5?35:chg>=3?28:chg>=2?20:chg>=1?12:5;
  s += volRatio>=5?30:volRatio>=3?24:volRatio>=2?18:volRatio>=1.5?12:6;
  s += price>((high+low+price)/3)?20:10; // di atas VWAP
  s += chg>=2&&volRatio>=2?15:8; // confluence bonus
  s = Math.min(s,100);
  const label = s>=85?'momentum_aplus':s>=70?'momentum_b':'momentum_watch';
  return { score:s, label, chg, volRatio, price, vol, high, low,
    reason:`Vol ${volRatio.toFixed(1)}x · +${chg.toFixed(2)}% · ${volRatio>=3?'Unusual Activity':'Volume Naik'}` };
}

function scoreGorila(q, ticker) {
  if (!q || !q.ld) return null;
  const price = q.ld, prev = q.pc || price;
  const chg = prev ? (price-prev)/prev*100 : 0;
  const vol = q.v || 0, avgVol = q.avol || vol || 1;
  const volRatio = avgVol ? vol/avgVol : 1;
  const high = q.h || price;
  // Gorila criteria: harga < 500, volume meledak, baru mulai naik
  if (price > 500) return null; // hanya saham < 500
  if (volRatio < 2) return null; // butuh volume meledak
  if (chg < 1) return null; // harus naik
  // ARA detection: naik mendekati batas atas (35% untuk reguler, 25% untuk T+)
  const isNearARA = chg >= 20;
  const isEarlyPump = chg >= 5 && volRatio >= 5;
  let s = 0;
  s += price<=50?30:price<=100?25:price<=200?20:price<=500?15:10; // harga rendah bonus
  s += volRatio>=10?30:volRatio>=5?25:volRatio>=3?18:volRatio>=2?12:5;
  s += chg>=10?25:chg>=5?20:chg>=3?15:chg>=1?10:5;
  s += isNearARA?15:isEarlyPump?12:0;
  s = Math.min(s,100);
  const label = isNearARA?'ara_candidate':isEarlyPump?'early_pump':'gorila_watch';
  return { score:s, label, chg, volRatio, price, vol, high,
    isNearARA, isEarlyPump,
    reason:`Rp${price} · Vol ${volRatio.toFixed(1)}x · ${isNearARA?'⚡ Near ARA!':isEarlyPump?'🚀 Early Pump':'Volume Spike'}` };
}

function scoreRecovery(q, ticker) {
  if (!q || !q.ld) return null;
  const price = q.ld, prev = q.pc || price;
  const chg = prev ? (price-prev)/prev*100 : 0;
  const vol = q.v || 0, avgVol = q.avol || vol || 1;
  const volRatio = avgVol ? vol/avgVol : 1;
  const high = q.h || price, low = q.lo || price;
  const vwap = (high+low+price)/3;
  // Recovery criteria: saham yang mulai rebound dari bottom
  // Harga dekat low tapi mulai ada buying interest
  const priceNearLow = low > 0 ? (price-low)/low < 0.03 : false; // harga dekat low hari ini
  const buyingInterest = volRatio >= 1.3 && chg >= 0; // ada volume masuk
  const reboundStart = chg >= 0.5 && chg <= 5; // tidak terlalu sudah naik
  if (!buyingInterest) return null;
  if (!reboundStart) return null;
  // Deteksi Wyckoff Spring: harga sempat turun lalu naik kembali
  const wyckoffSpring = low < prev*(1-0.02) && price > prev*(0.99); // sempat turun 2% lalu recover
  let s = 0;
  s += wyckoffSpring?30:priceNearLow?20:10;
  s += volRatio>=3?25:volRatio>=2?20:volRatio>=1.5?15:volRatio>=1.3?10:5;
  s += chg>=2?20:chg>=1?15:chg>=0.5?10:5;
  s += price>vwap?15:price>prev?10:5; // harga di atas VWAP atau kemarin
  s += 10; // base score untuk recovery setup
  s = Math.min(s,100);
  const label = s>=80?'reversal_aplus':s>=65?'reversal_b':'reversal_watch';
  return { score:s, label, chg, volRatio, price, vol, high, low, wyckoffSpring,
    reason:`${wyckoffSpring?'Wyckoff Spring':'Rebound'} · Vol ${volRatio.toFixed(1)}x · +${chg.toFixed(2)}%` };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin','*');
    return res.status(200).end();
  }
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','s-maxage=25, stale-while-revalidate=30');

  const TOKEN = process.env.ITICK_TOKEN;
  if (!TOKEN) return res.status(500).json({ error:'ITICK_TOKEN not set' });

  const { layer='all' } = req.query;
  const BATCH = 20;

  try {
    // Fetch semua 200 saham dalam batch
    const allData = {};
    for (let i=0; i<IDX_200.length; i+=BATCH) {
      const batch = IDX_200.slice(i, i+BATCH);
      try {
        const r = await fetch(
          `${ITICK_BASE}/stock/ticks?region=${REGION}&codes=${batch.join(',')}`,
          { headers:{ token:TOKEN } }
        );
        const j = await r.json();
        if (j.code===0 && j.data) {
          Object.assign(allData, j.data);
        }
      } catch(e) { /* skip batch */ }
    }

    // Layer 1: Core
    const core = [], momentum = [], gorila = [], recovery = [];

    Object.keys(allData).forEach(ticker => {
      const q = allData[ticker];
      if (!q || !q.ld || q.ld<=0) return;

      // Score tiap layer
      const coreRes    = scoreCore(q);
      const momRes     = scoreMomentum(q, ticker);
      const gorilaRes  = scoreGorila(q, ticker);
      const recovRes   = scoreRecovery(q, ticker);

      const base = {
        ticker,
        price: q.ld,
        chg: coreRes ? parseFloat(coreRes.chg.toFixed(2)) : 0,
        vol: q.v || 0,
        high: q.h || q.ld,
        low: q.lo || q.ld,
      };

      // Layer 1 — Core
      if (coreRes && coreRes.score >= 70) {
        core.push({ ...base, ...coreRes });
      }

      // Layer 2 — Momentum
      if (momRes) {
        momentum.push({ ...base, ...momRes });
      }

      // Layer 3 — Gorila
      if (gorilaRes) {
        gorila.push({ ...base, ...gorilaRes });
      }

      // Layer 4 — Recovery
      if (recovRes && recovRes.score >= 65) {
        recovery.push({ ...base, ...recovRes });
      }
    });

    // Sort each layer
    core.sort((a,b) => b.score-a.score);
    momentum.sort((a,b) => b.score-a.score);
    gorila.sort((a,b) => b.score-a.score);
    recovery.sort((a,b) => b.score-a.score);

    // Summary
    const summary = {
      total_scanned: Object.keys(allData).length,
      core_signals:  core.filter(s=>['ai','ab'].includes(s.label)).length,
      momentum_hot:  momentum.filter(s=>s.label==='momentum_aplus').length,
      ara_candidates:gorila.filter(s=>s.label==='ara_candidate').length,
      reversals:     recovery.filter(s=>s.label==='reversal_aplus').length,
      timestamp:     new Date().toISOString(),
    };

    return res.status(200).json({
      summary,
      layers: {
        core:     core.slice(0,30),
        momentum: momentum.slice(0,20),
        gorila:   gorila.slice(0,20),
        recovery: recovery.slice(0,20),
      }
    });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
