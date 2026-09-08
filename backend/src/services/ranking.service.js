/**
 * RankingService — scores and sorts coins that passed all filters.
 *
 * Score formula (0–100 scale):
 *   liquidity     25%  — more liquidity = safer exit
 *   netBuy        20%  — bullish buy pressure
 *   volume        15%  — trading activity
 *   devSafety     25%  — (1 - rug%) * dev balance factor
 *   bCurve        15%  — bonding curve progress signal
 */
export class RankingService {
  rank(coins) {
    if (!coins.length) return [];

    // Normalize each metric to 0–1 range across the set
    const metrics = ['liquidityK', 'netBuyK', 'volumeK', 'bCurvePercent'];
    const norms   = this._buildNorms(coins, metrics);

    const scored = coins.map(coin => {
      const liquidityScore = this._norm(coin.liquidityK,    norms.liquidityK);
      const netBuyScore    = this._norm(coin.netBuyK,       norms.netBuyK);
      const volumeScore    = this._norm(coin.volumeK,       norms.volumeK);
      const bCurveScore    = this._norm(coin.bCurvePercent, norms.bCurvePercent);

      // Dev safety: combines rug% and SOL balance
      const rugFactor    = 1 - (coin.devRugPercent || 0) / 100;
      const balFactor    = Math.min(1, (coin.devBalanceSol || 0) / 10); // cap at 10 SOL → 1.0
      const devScore     = rugFactor * 0.7 + balFactor * 0.3;

      const score =
        liquidityScore * 25 +
        netBuyScore    * 20 +
        volumeScore    * 15 +
        devScore       * 25 +
        bCurveScore    * 15;

      return { ...coin, score: Math.round(score * 10) / 10 };
    });

    // Sort descending by score, assign rank
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((c, i) => { c.rank = i + 1; });

    return scored;
  }

  /**
   * Build min/max normalization bounds for a set of coins.
   */
  _buildNorms(coins, fields) {
    const norms = {};
    for (const f of fields) {
      const vals = coins.map(c => c[f] || 0);
      norms[f] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return norms;
  }

  /**
   * Normalize a value to 0–1 using min/max scaling.
   */
  _norm(value, bounds) {
    const { min, max } = bounds;
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }
}
