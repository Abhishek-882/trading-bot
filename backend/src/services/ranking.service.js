/**
 * RankingService — intelligent scoring & deduplication engine for Solana tokens.
 *
 * Evaluation Criteria:
 *   1. Liquidity Depth (25%)  — log-scaled against benchmark ($50k)
 *   2. Trading Activity (15%) — log-scaled volume ($20k benchmark)
 *   3. Buy Momentum (15%)     — buyer dominance ratio (buys vs sells)
 *   4. Bonding Curve (15%)    — progress towards graduation (pump.fun to Raydium)
 *   5. Dev Quality (25%)      — dev net worth + rug history + HEAVY serial-spammer penalty
 *   6. Community Traction (5%)— swap / tx count
 *
 * Anti-Spam / Deduplication:
 *   - Suppresses duplicate tokens from the same dev (keeps only the highest-scoring one)
 *   - Penalizes serial deployers (>10 launches heavily discounted, >30 launches treated as spam)
 */
export class RankingService {
  rank(coins) {
    if (!coins || !coins.length) return [];

    const scored = [];

    for (const coin of coins) {
      // 1. Liquidity Depth (0–25 points)
      // Logarithmic benchmark: $1k = ~10pts, $10k = ~20pts, $50k+ = 25pts
      const liqUsd = (coin.liquidityK || 0) * 1000;
      const liqRatio = liqUsd > 10 ? Math.min(1, Math.log10(liqUsd) / Math.log10(50000)) : 0;
      const liquidityScore = Math.max(0, liqRatio) * 25;

      // 2. Volume Activity (0–15 points)
      // Logarithmic benchmark: $500 = ~5pts, $5k = ~10pts, $20k+ = 15pts
      const volUsd = (coin.volumeK || 0) * 1000;
      const volRatio = volUsd > 10 ? Math.min(1, Math.log10(volUsd) / Math.log10(20000)) : 0;
      const volumeScore = Math.max(0, volRatio) * 15;

      // 3. Buy Momentum (0–15 points)
      // Measures buying pressure: ratio of buys vs total transactions
      const totalTrades = (coin.buys || 0) + (coin.sells || 0);
      const buyDominance = totalTrades > 0 ? (coin.buys || 0) / totalTrades : 0.5;
      const momentumScore = buyDominance * 15;

      // 4. Bonding Curve Progress (0–15 points)
      // Tokens near graduation (60%–95%) get top scores; 0-5% get low scores
      const bCurvePct = Math.min(100, Math.max(0, coin.bCurvePercent || 0));
      const bCurveScore = (bCurvePct / 100) * 15;

      // 5. Dev Quality & Anti-Spam Score (0–25 points)
      const rugRatio = Math.min(100, Math.max(0, coin.devRugPercent || 0));
      const rugFactor = Math.max(0, 1 - (rugRatio / 100)); // 0% rug = 1.0, 50% rug = 0.5

      // Net worth factor: reaches max at $1,000+ total wealth
      const devUsd = Math.max(0, coin.devTotalValueUsd || 0);
      const netWorthFactor = Math.min(1, devUsd / 1000);

      // SERIAL SPAMMER PENALTY:
      // Real legit devs launch 1–5 tokens.
      // Serial deployers with 50, 100, or 186 launches are pump-and-dump spammers!
      const launches = Math.max(1, coin.devTotalLaunches || 1);
      let spammerPenalty = 1.0;
      if (launches > 50) {
        // Severe penalty: 186 launches -> ~0.15 multiplier
        spammerPenalty = Math.max(0.1, 15 / launches);
      } else if (launches > 15) {
        spammerPenalty = Math.max(0.35, 15 / launches);
      } else if (launches > 6) {
        spammerPenalty = 0.75;
      }

      const devBase = (rugFactor * 0.6) + (netWorthFactor * 0.4);
      const devScore = devBase * spammerPenalty * 25;

      // 6. Community Traction / TXs (0–5 points)
      // 50+ swaps = full 5 points
      const txCount = coin.txs || totalTrades;
      const tractionScore = Math.min(1, txCount / 50) * 5;

      // Total Composite Score (0–100)
      const rawScore = liquidityScore + volumeScore + momentumScore + bCurveScore + devScore + tractionScore;
      const finalScore = Math.round(Math.max(1, Math.min(99.9, rawScore)) * 10) / 10;

      scored.push({
        ...coin,
        score: finalScore,
        _spammerPenalty: spammerPenalty,
      });
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // ── DEDUPLICATION & SPAM CLUSTER FILTERING ──────────────────────
    // Do not flood suggestions with multiple tokens from the same dev
    // or identical symbol spam.
    const seenDevs = new Set();
    const seenSymbols = new Set();
    const uniqueRanked = [];

    for (const c of scored) {
      const devKey = c.devAddress ? c.devAddress.toLowerCase() : null;
      const symKey = c.symbol ? c.symbol.toLowerCase() : null;

      // If this dev already has a higher-ranked token in the list, skip secondary tokens
      if (devKey && seenDevs.has(devKey)) {
        continue;
      }

      // If exact same symbol already exists, skip duplicates
      if (symKey && symKey.length > 1 && seenSymbols.has(symKey)) {
        continue;
      }

      if (devKey) seenDevs.add(devKey);
      if (symKey) seenSymbols.add(symKey);
      uniqueRanked.push(c);
    }

    // Assign final ranks
    uniqueRanked.forEach((c, idx) => {
      c.rank = idx + 1;
      delete c._spammerPenalty;
    });

    return uniqueRanked;
  }
}
