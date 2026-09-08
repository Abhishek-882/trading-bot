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
    if (!filters || Object.keys(filters).length === 0) return coins;

    return coins.filter(coin => {
      return (
        this._inRange(coin.bCurvePercent,  filters.bCurve)     &&
        this._inRange(coin.ageMinutes,     filters.age)         &&
        this._inRange(coin.liquidityK,     filters.liquidity)   &&
        this._inRange(coin.mktCapK,        filters.mktCap)      &&
        this._inRange(coin.volumeK,        filters.volume)      &&
        this._inRange(coin.netBuyK,        filters.netBuy)      &&
        this._inRange(coin.txs,            filters.txs)         &&
        this._inRange(coin.buys,           filters.buys)        &&
        this._inRange(coin.sells,          filters.sells)       &&
        this._inRange(coin.totalFeesSol,   filters.totalFees)   &&
        this._inRange(coin.pumpLiveAgeMin, filters.pumpLiveAge)
      );
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
