/**
 * FilterService — applies user-defined min/max ranges to a list of coins.
 *
 * Filter shape:
 * {
 *   bCurve:       { min: number, max: number },  // %
 *   age:          { min: number, max: number },  // minutes
 *   liquidity:    { min: number, max: number },  // K
 *   mktCap:       { min: number, max: number },  // K
 *   volume:       { min: number, max: number },  // K
 *   netBuy:       { min: number, max: number },  // K
 *   txs:          { min: number, max: number },
 *   buys:         { min: number, max: number },
 *   sells:        { min: number, max: number },
 *   totalFees:    { min: number, max: number },  // SOL
 *   pumpLiveAge:  { min: number, max: number },  // minutes
 * }
 */
export class FilterService {
  /**
   * Apply filters to a list of normalized coins.
   * A missing or null min/max = no restriction on that bound.
   */
  apply(coins, filters = {}) {
    if (!coins || !coins.length) return [];
    const f = filters || {};
    const hasActiveFilters = Object.keys(f).some(k => k !== 'allowRugged' && f[k] !== undefined && f[k] !== null && f[k] !== '');
    if (!hasActiveFilters && f.allowRugged === true) return coins;

    return coins.filter(coin => {
      // Baseline safety eviction floor (GMGN Parity: MCap >= $10K, Liq >= $0.8K)
      if (filters.allowRugged !== true) {
        if (coin.mktCapK != null && coin.mktCapK < 10) return false;
        if (coin.liquidityK != null && coin.liquidityK < 0.8) return false;
        if (parseFloat(coin.devRugPercent ?? 0) >= 80 && (coin.mktCapK || 0) < 25) return false;
      }

      // 1. Metric ranges (11 baseline metrics)
      if (!this._inRange(coin.bCurvePercent,  filters.bCurve))     return false;
      if (!this._inRange(coin.ageMinutes,     filters.age))         return false;
      if (!this._inRange(coin.liquidityK,     filters.liquidity))   return false;
      if (!this._inRange(coin.mktCapK,        filters.mktCap))      return false;
      if (!this._inRange(coin.volumeK,        filters.volume))      return false;
      if (!this._inRange(coin.netBuyK,        filters.netBuy))      return false;
      if (!this._inRange(coin.txs,            filters.txs))         return false;
      if (!this._inRange(coin.buys,           filters.buys))        return false;
      if (!this._inRange(coin.sells,          filters.sells))       return false;
      if (!this._inRange(coin.totalFeesSol,   filters.totalFees))   return false;
      if (!this._inRange(coin.pumpLiveAgeMin, filters.pumpLiveAge)) return false;

      // 2. Solscan Pre-Funding Check (Must have received >= minPreFundSol prior to creation)
      if (filters.requirePreFunding) {
        if (!coin.isPreFunded) return false;
        const minSol = parseFloat(filters.minPreFundSol || 5);
        if (!isNaN(minSol) && (coin.preFundAmountSol || 0) < minSol && (coin.devBalanceSol || 0) < minSol) {
          return false;
        }
      }

      // 3. Genuine Independent Website Check & Domain Tier
      if (filters.requireGenuineWebsite && !coin.hasGenuineWebsite) {
        return false;
      }
      if (filters.domainTier && filters.domainTier !== 'none' && filters.domainTier !== 'all') {
        if (!coin.hasGenuineWebsite) return false;
        if (filters.domainTier === 'best' && coin.domainTier !== 'best') return false;
        if (filters.domainTier === 'small' && coin.domainTier !== 'small') return false;
      }

      // 4. Below Historical Avg ATH Check
      if (filters.requireBelowAvgAth && !coin.isBelowAvgAth) {
        return false;
      }

      // 5. Minimum ATH Reach Probability Score (0 - 100%)
      if (filters.minAthProbability !== null && filters.minAthProbability !== undefined && filters.minAthProbability !== '') {
        const minProb = parseFloat(filters.minAthProbability);
        if (!isNaN(minProb) && (coin.athReachProbability || 0) < minProb) {
          return false;
        }
      }

      // 6. Minimum Watchers Check (GMGN audience engagement filter)
      if (filters.minWatchers !== null && filters.minWatchers !== undefined && filters.minWatchers !== '') {
        const minW = parseInt(filters.minWatchers, 10);
        if (!isNaN(minW) && (coin.watchersCount || 0) < minW) {
          return false;
        }
      }
      if (!this._inRange(coin.watchersCount, filters.watchers)) return false;

      return true;
    });
  }

  _inRange(value, range) {
    if (!range) return true;
    const { min, max } = range;
    const hasMin = min !== null && min !== undefined && min !== '';
    const hasMax = max !== null && max !== undefined && max !== '';
    if (hasMin && value < parseFloat(min)) return false;
    if (hasMax && value > parseFloat(max)) return false;
    return true;
  }

  /**
   * Validate that a filter object has valid structure.
   */
  validate(filters) {
    const errors = [];
    const fields = ['bCurve','age','liquidity','mktCap','volume','netBuy','txs','buys','sells','totalFees','pumpLiveAge'];
    for (const f of fields) {
      const range = filters[f];
      if (!range) continue;
      if (range.min !== null && range.max !== null &&
          parseFloat(range.min) > parseFloat(range.max)) {
        errors.push(`${f}: min (${range.min}) cannot be greater than max (${range.max})`);
      }
    }
    return errors;
  }
}
