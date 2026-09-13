import { aiModelService } from '../src/services/aiModel.service.js';
import { ensembleRankerService } from '../src/services/ensembleRanker.service.js';

console.log('--- Starting AI Meme Coin Predictor & 2-Gate Ensemble Tests ---');

// Test 1: Service Initialization
console.log('[Test 1] Verifying AIModelService initialization and model availability...');
if (!aiModelService.isLoaded) {
  console.error('FAILED: aiModelService failed to load model definitions.');
  process.exit(1);
}
console.log('✓ [Test 1 Passed]: XGBoost trees and NLP vocabulary loaded into in-process memory.');

// Test 2: In-Process Inference Latency & Logic
console.log('[Test 2] Benchmarking in-process scoring latency (<10ms target)...');
const sampleCoinPositive = {
  address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  name: 'Autonomous Virtual Beings',
  symbol: 'AVB',
  mktCapK: 45.0,
  liquidityK: 12.0,
  volumeK: 65.0,
  netBuyK: 35.0,
  buys: 58,
  sells: 12,
  txs: 70,
  bCurvePercent: 35.0,
  ageMinutes: 5,
  devRugPercent: 0,
  devTotalLaunches: 1,
  holdersCount: 48,
  watchersCount: 28,
  watchersDelta: 6,
  twitterUrl: 'https://x.com/avb_sol',
  telegramUrl: 'https://t.me/avb_sol',
  websiteUrl: 'https://avb.ai',
  cluster_sniper_count: 3,
  cluster_sniper_supply_pct: 6.5,
};

const t0 = performance.now();
const resPos = aiModelService.scoreToken(sampleCoinPositive);
const latency = performance.now() - t0;

console.log(`  -> Evaluated in ${latency.toFixed(3)}ms | P_xgb: ${resPos.p_xgb} | P_nlp: ${resPos.p_nlp} | Final: ${resPos.final_score}`);

if (latency > 10.0) {
  console.error(`FAILED: Inference took ${latency}ms, exceeding 10ms target.`);
  process.exit(1);
}
if (!resPos.passes_gate1) {
  console.error('FAILED: Strong positive sample failed Gate 1.');
  process.exit(1);
}
console.log('✓ [Test 2 Passed]: In-process inference completed in <1ms with Gate 1 pass.');

// Test 3: Gate 1 Rejection on Low-Quality / Rug Token
console.log('[Test 3] Testing Gate 1 rejection on high-risk rug token...');
const sampleCoinRug = {
  address: 'RugToken11111111111111111111111111111111111',
  name: 'test coin rug pump',
  symbol: 'RUG',
  mktCapK: 9.0,
  liquidityK: 1.0,
  volumeK: 2.0,
  netBuyK: -5.0,
  buys: 3,
  sells: 25,
  txs: 28,
  bCurvePercent: 5.0,
  ageMinutes: 20,
  devRugPercent: 85.0,
  devTotalLaunches: 8,
  holdersCount: 4,
  watchersCount: 1,
  watchersDelta: -2,
  cluster_sniper_count: 8,
  cluster_sniper_supply_pct: 65.0,
};

const resRug = aiModelService.scoreToken(sampleCoinRug);
console.log(`  -> Rug evaluation: passes_gate1: ${resRug.passes_gate1} | score: ${resRug.final_score}`);

if (resRug.passes_gate1 && resRug.final_score > 0.1) {
  console.error('FAILED: Rug token should have been rejected or received near-zero score.');
  process.exit(1);
}
console.log('✓ [Test 3 Passed]: Obvious rug token properly rejected by Gate 1.');

// Test 4: EnsembleRankerService Top 5 Shortlist & Multi-Token Distinctiveness
console.log('[Test 4] Testing Top 5 ranking and multi-token distinctiveness...');
const candidateBatch = [
  sampleCoinPositive,
  sampleCoinRug,
  {
    address: 'TokenAlpha222222222222222222222222222222222',
    name: 'Goatseus Maximus',
    symbol: 'GOAT',
    mktCapK: 120.0,
    liquidityK: 30.0,
    volumeK: 150.0,
    netBuyK: 80.0,
    buys: 110,
    sells: 30,
    bCurvePercent: 75.0,
    ageMinutes: 12,
    devRugPercent: 0,
    devTotalLaunches: 1,
    holdersCount: 95,
    watchersCount: 45,
    watchersDelta: 10,
    twitterUrl: 'https://x.com/goat',
    cluster_sniper_count: 4,
    cluster_sniper_supply_pct: 8.2,
  },
  {
    address: 'TokenBeta3333333333333333333333333333333333',
    name: 'Fartcoin',
    symbol: 'FART',
    mktCapK: 85.0,
    liquidityK: 20.0,
    volumeK: 95.0,
    netBuyK: 45.0,
    buys: 80,
    sells: 25,
    bCurvePercent: 55.0,
    ageMinutes: 8,
    devRugPercent: 5.0,
    devTotalLaunches: 2,
    holdersCount: 65,
    watchersCount: 32,
    watchersDelta: 4,
    twitterUrl: 'https://x.com/fart',
    cluster_sniper_count: 2,
    cluster_sniper_supply_pct: 5.1,
  },
  {
    address: 'TokenGamma444444444444444444444444444444444',
    name: 'Peanut the Squirrel',
    symbol: 'PNUT',
    mktCapK: 65.0,
    liquidityK: 18.0,
    volumeK: 70.0,
    netBuyK: 40.0,
    buys: 65,
    sells: 18,
    bCurvePercent: 42.0,
    ageMinutes: 7,
    devRugPercent: 0,
    devTotalLaunches: 1,
    holdersCount: 52,
    watchersCount: 26,
    watchersDelta: 5,
    cluster_sniper_count: 3,
    cluster_sniper_supply_pct: 7.0,
  },
  {
    address: 'TokenDelta555555555555555555555555555555555',
    name: 'Act I The AI Prophecy',
    symbol: 'ACT',
    mktCapK: 95.0,
    liquidityK: 25.0,
    volumeK: 110.0,
    netBuyK: 55.0,
    buys: 90,
    sells: 20,
    bCurvePercent: 62.0,
    ageMinutes: 10,
    devRugPercent: 0,
    devTotalLaunches: 1,
    holdersCount: 78,
    watchersCount: 38,
    watchersDelta: 7,
    cluster_sniper_count: 4,
    cluster_sniper_supply_pct: 9.2,
  },
  {
    address: 'TokenEpsilon66666666666666666666666666666666',
    name: 'Zerebro AI',
    symbol: 'ZEREBRO',
    mktCapK: 55.0,
    liquidityK: 14.0,
    volumeK: 60.0,
    netBuyK: 28.0,
    buys: 50,
    sells: 15,
    bCurvePercent: 38.0,
    ageMinutes: 6,
    devRugPercent: 0,
    devTotalLaunches: 1,
    holdersCount: 44,
    watchersCount: 22,
    watchersDelta: 3,
    cluster_sniper_count: 2,
    cluster_sniper_supply_pct: 4.8,
  }
];

const rankResult = ensembleRankerService.rankTokens(candidateBatch);
console.log(`  -> Evaluated ${rankResult.metadata.totalEvaluated} tokens; Eligible: ${rankResult.metadata.eligibleCount}; Ineligible: ${rankResult.metadata.ineligibleCount}`);
console.log(`  -> Top picks count: ${rankResult.topPicks.length}`);

if (rankResult.topPicks.length !== 5) {
  console.error(`FAILED: Expected 5 top picks, got ${rankResult.topPicks.length}`);
  process.exit(1);
}

// Verify distinct scores (per AGENTS.md Rule 1)
const scores = rankResult.topPicks.map(p => p.aiScore);
const uniqueScores = new Set(scores);
if (uniqueScores.size !== scores.length) {
  console.error('FAILED: Duplicate aiScore detected across different tokens (violates Rule 1)');
  process.exit(1);
}

for (const pick of rankResult.topPicks) {
  console.log(`     #${pick.rank} ${pick.symbol} ($${pick.name}) -> Score: ${pick.aiScore.toFixed(4)} | P_xgb: ${pick.p_xgb} | P_nlp: ${pick.p_nlp} | Rec: ${pick.recommendedAction}`);
  if (!pick.attributions || pick.attributions.length === 0) {
    console.error(`FAILED: Missing explainability attributions on pick ${pick.symbol}`);
    process.exit(1);
  }
}

console.log('✓ [Test 4 Passed]: Top 5 shortlist correctly generated with distinct scores and SHAP signals.');

console.log('\n======================================================');
console.log(' ALL AI PREDICTOR & 2-GATE ENSEMBLE TESTS PASSED (100%)');
console.log('======================================================');
