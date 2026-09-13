/**
 * mlDataCollector.service.js
 *
 * Collects labeled training data for the AI meme coin prediction model.
 *
 * HOW IT WORKS:
 *  1. Every time pollAndAct() runs, it calls collector.snapshot(rankedCoins)
 *     which saves launch-time features for each token to a pending/ file.
 *  2. 60 minutes later the labeler checks DexScreener for the token peak mcap
 *     and writes: label=1 (reached $5M+) or label=0 (did not).
 *  3. All labeled records go to backend/data/ml_training/labeled_tokens.jsonl
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR     = path.join(__dirname, '..', '..', 'data', 'ml_training');
const PENDING_DIR  = path.join(DATA_DIR, 'pending');
const LABELED_FILE = path.join(DATA_DIR, 'labeled_tokens.jsonl');
const STATS_FILE   = path.join(DATA_DIR, 'collector_stats.json');

const LABEL_DELAY_MS          = 60 * 60 * 1000;
const POSITIVE_MCAP_THRESHOLD = 5000;
const MAX_PENDING_AGE_MS      = 3 * 60 * 60 * 1000;
const BASE58_RE               = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

for (const dir of [DATA_DIR, PENDING_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

let stats = { snapshots: 0, labeled: 0, positive: 0, negative: 0, startedAt: new Date().toISOString() };
try {
  if (fs.existsSync(STATS_FILE)) stats = { ...stats, ...JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')) };
} catch {}

function saveStats() {
  stats.lastUpdatedAt = new Date().toISOString();
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); } catch {}
}

function extractFeatures(coin) {
  const buys  = parseInt(coin.buys  || 0, 10);
  const sells = parseInt(coin.sells || 0, 10);
  const total = buys + sells;
  const ageMin = parseInt(coin.ageMinutes || 0, 10);
  return {
    mktCapK:          parseFloat(coin.mktCapK    || 0),
    liquidityK:       parseFloat(coin.liquidityK || 0),
    volumeK:          parseFloat(coin.volumeK    || 0),
    netBuyK:          parseFloat(coin.netBuyK    || 0),
    buySellRatio:     total > 0 ? buys / total : 0.5,
    bCurvePercent:    parseFloat(coin.bCurvePercent ?? 0),
    bCurveVelocity:   ageMin > 0 ? parseFloat(coin.bCurvePercent ?? 0) / ageMin : 0,
    ageMinutes:       ageMin,
    devRugPercent:    parseFloat(coin.devRugPercent ?? 0),
    devTotalLaunches: parseInt(coin.devTotalLaunches ?? 1, 10),
    devBalanceSol:    parseFloat(coin.devBalanceSol  ?? 0),
    holdersCount:     parseInt(coin.holdersCount  || 0, 10),
    watchersCount:    parseInt(coin.watchersCount || 0, 10),
    watchersDelta:    parseInt(coin.watchersDelta || 0, 10),
    hasSocialLinks:   (coin.twitterUrl || coin.telegramUrl) ? 1 : 0,
    hasWebsite:       coin.websiteUrl ? 1 : 0,
    // isCTO: CTOs happen hours-days after launch — always 0 at T+0 in live path.
    // Stored here for record completeness; EXCLUDE from training if snapshotAgeMinutes > 30.
    isCTO:            coin.isCTO ? 1 : 0,
    isGraduated:      (coin.bCurvePercent >= 100) ? 1 : 0,
    txCount:          parseInt(coin.txs || 0, 10),
    // Epsilon guard: Math.max(buys, 1) prevents division by zero when buys=0
    uniqueBuyerRatio: Math.min(1, parseInt(coin.holdersCount || 0, 10) / Math.max(buys, 1)),
    // Zero-latency launch-slot cluster features
    cluster_sniper_count: parseInt(coin.cluster_sniper_count || 0, 10),
    cluster_sniper_supply_pct: parseFloat(coin.cluster_sniper_supply_pct || 0),
  };
}

function snapshotToken(coin) {
  if (!coin?.address || !BASE58_RE.test(coin.address)) return;
  const ageMin = parseInt(coin.ageMinutes || 0, 10);
  // Only snapshot tokens between 5–30 min old — matches the live pipeline's observation window.
  // Snapshots taken >30 min after launch may have isCTO=true or other late-stage features
  // that are structurally absent in the live path, causing train/serve mismatch.
  if (ageMin < 5 || ageMin > 30) return;
  const pendingPath = path.join(PENDING_DIR, `${coin.address}.json`);
  if (fs.existsSync(pendingPath)) return;
  const record = {
    address: coin.address, name: coin.name || 'Unknown', symbol: coin.symbol || '???',
    snapshotAt: new Date().toISOString(),
    snapshotAgeMinutes: ageMin,  // stored for training-set age-filter validation
    labelAfter: Date.now() + LABEL_DELAY_MS,
    mktCapAtSnapshotK: parseFloat(coin.mktCapK || 0),
    features: extractFeatures(coin),
  };
  try { fs.writeFileSync(pendingPath, JSON.stringify(record)); stats.snapshots++; } catch {}
}

async function labelPendingTokens() {
  let files;
  try { files = fs.readdirSync(PENDING_DIR); } catch { return; }
  const now = Date.now();
  const ready = files.filter(f => {
    if (!f.endsWith('.json')) return false;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8'));
      return r.labelAfter && now >= r.labelAfter;
    } catch { return false; }
  }).slice(0, 5);

  for (const file of ready) {
    const pendingPath = path.join(PENDING_DIR, file);
    let record;
    try { record = JSON.parse(fs.readFileSync(pendingPath, 'utf8')); }
    catch { try { fs.unlinkSync(pendingPath); } catch {} continue; }

    if (now - new Date(record.snapshotAt).getTime() > MAX_PENDING_AGE_MS) {
      try { fs.unlinkSync(pendingPath); } catch {}
      continue;
    }

    let peakMktCapK = 0;
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${record.address}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GMGN-ML-Collector/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        const pairs = Array.isArray(data) ? data : (data.pairs || []);
        const maxMcap = pairs.reduce((mx, p) => {
          const v = parseFloat(p.marketCap || p.fdv || 0);
          return v > mx ? v : mx;
        }, 0);
        peakMktCapK = maxMcap / 1000;
      }
    } catch { continue; }

    const startMcapK = record.mktCapAtSnapshotK || 0;
    const multiplier = (peakMktCapK > 0 && startMcapK > 0) ? peakMktCapK / startMcapK : 0;
    const label = (peakMktCapK >= POSITIVE_MCAP_THRESHOLD && startMcapK < 1000 && multiplier >= 5) ? 1 : 0;

    const labeled = {
      address: record.address, name: record.name, symbol: record.symbol,
      snapshotAt: record.snapshotAt, labeledAt: new Date().toISOString(),
      label, peakMktCapK: Math.round(peakMktCapK), mktCapAtSnapshotK: startMcapK,
      multiplier: Math.round(multiplier * 10) / 10,
      ...record.features,
    };

    try {
      fs.appendFileSync(LABELED_FILE, JSON.stringify(labeled) + '\n');
      stats.labeled++;
      if (label === 1) stats.positive++; else stats.negative++;
      fs.unlinkSync(pendingPath);
    } catch {}
  }
  saveStats();
}

export class MLDataCollector {
  constructor() {
    this._labelTimer = null;
    console.log(`[ML-COLLECTOR] Initialized. Output: ${LABELED_FILE}`);
  }

  snapshot(rankedCoins) {
    if (!Array.isArray(rankedCoins) || rankedCoins.length === 0) return;
    for (const coin of rankedCoins) snapshotToken(coin);
    const p = this.pendingCount();
    if (p > 0 && stats.snapshots % 10 === 0) {
      console.log(`[ML-COLLECTOR] Pending=${p} | Labeled=${stats.labeled} | Pos=${stats.positive} | Neg=${stats.negative}`);
    }
  }

  start() {
    this._labelTimer = setInterval(() => {
      labelPendingTokens().catch(e => console.warn('[ML-COLLECTOR]', e.message));
    }, 5 * 60 * 1000);
    labelPendingTokens().catch(() => {});
    console.log('[ML-COLLECTOR] Started — labeling check every 5 minutes.');
  }

  stop() { if (this._labelTimer) clearInterval(this._labelTimer); }

  pendingCount() {
    try { return fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.json')).length; }
    catch { return 0; }
  }

  getStats() {
    return { ...stats, pendingCount: this.pendingCount(), labeledFile: LABELED_FILE };
  }
}

export const mlDataCollector = new MLDataCollector();
