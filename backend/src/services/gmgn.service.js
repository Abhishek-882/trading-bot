import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export class GMGNService {
  constructor() {
    this.chain = 'sol';
  }

  /**
   * Run gmgn-cli directly to get 100% real live market tokens.
   */
  async _runCli(cmd) {
    try {
      const { stdout } = await execPromise(cmd, {
        maxBuffer: 15 * 1024 * 1024,
        timeout: 20000,
      });
      return JSON.parse(stdout.trim());
    } catch (err) {
      console.warn(`[GMGN CLI] Error running "${cmd}":`, err.message);
      return null;
    }
  }

  /**
   * Fetch newly created tokens & active trending pairs from GMGN via CLI.
   * Returns 100% REAL Solana tokens.
   */
  async fetchNewTokens(limit = 60) {
    try {
      // 1. Fetch live launchpad tokens (new creations + near completion from pump.fun / raydium)
      const trenchesData = await this._runCli(
        `npx gmgn-cli market trenches --chain ${this.chain} --limit ${limit} --raw`
      );

      // 2. Fetch live trending/moving tokens
      const trendingData = await this._runCli(
        `npx gmgn-cli market trending --chain ${this.chain} --interval 5m --limit ${Math.min(limit, 40)} --raw`
      );

      const allRaw = [];

      if (trenchesData) {
        if (Array.isArray(trenchesData.new_creation)) allRaw.push(...trenchesData.new_creation);
        if (Array.isArray(trenchesData.near_completion)) allRaw.push(...trenchesData.near_completion);
        if (Array.isArray(trenchesData.pump)) allRaw.push(...trenchesData.pump);
        if (Array.isArray(trenchesData.completed)) allRaw.push(...trenchesData.completed);
      }

      if (trendingData) {
        const ranks = trendingData.data?.rank || trendingData.rank || [];
        if (Array.isArray(ranks)) allRaw.push(...ranks);
      }

      if (allRaw.length > 0) {
        // Deduplicate by token address
        const seen = new Set();
        const unique = [];
        for (const token of allRaw) {
          if (token && token.address && !seen.has(token.address)) {
            seen.add(token.address);
            unique.push(this._normalizeToken(token));
          }
        }
        return unique;
      }

      return [];
    } catch (err) {
      console.error('[GMGN] Failed to fetch real tokens:', err.message);
      return [];
    }
  }

  /**
   * Normalize token attributes from GMGN API format.
   */
  _normalizeToken(t) {
    const nowSec = Date.now() / 1000;
    const createdTs = t.created_timestamp || t.open_timestamp || 0;
    const liveTs = t.start_live_timestamp || t.launchpad_timestamp || createdTs;

    const ageMin = createdTs ? Math.max(0, Math.round((nowSec - createdTs) / 60)) : 0;
    const liveAgeMin = liveTs ? Math.max(0, Math.round((nowSec - liveTs) / 60)) : ageMin;

    // Progress may be 0-1 or 0-100
    let bCurve = parseFloat(t.progress || t.bonding_curve_progress || t.b_curve || 0);
    if (bCurve > 0 && bCurve <= 1) {
      bCurve = bCurve * 100;
    }

    // Rug ratio from GMGN is usually 0-1 (e.g. 0.08 = 8%)
    const rugRatioRaw = parseFloat(t.rug_ratio ?? 0);
    const rugPct = rugRatioRaw <= 1 ? rugRatioRaw * 100 : rugRatioRaw;

    return {
      address:          t.address,
      name:             t.name || 'Unknown',
      symbol:           t.symbol || '???',
      logo:             t.logo || '',
      price:            parseFloat(t.price || 0),
      mktCapK:          parseFloat(t.market_cap || t.usd_market_cap || 0) / 1000,
      liquidityK:       parseFloat(t.liquidity || 0) / 1000,
      volumeK:          parseFloat(t.volume_24h || t.volume_1h || t.volume || 0) / 1000,
      netBuyK:          parseFloat(t.net_buy_24h || t.net_buy || t.net_buy_volume || 0) / 1000,
      txs:              parseInt(t.swaps_24h || t.swaps_1h || t.swaps || t.txns || 0, 10),
      buys:             parseInt(t.buys_24h || t.buys || 0, 10),
      sells:            parseInt(t.sells_24h || t.sells || 0, 10),
      totalFeesSol:     parseFloat(t.total_fee || t.gas_fee || t.total_fees || 0),
      ageMinutes:       ageMin,
      pumpLiveAgeMin:   liveAgeMin,
      bCurvePercent:    Math.round(bCurve * 10) / 10,
      devAddress:       t.creator || t.creator_address || t.deployer || null,
      devBalanceSol:    null, // populated by devWallet.enrichBatch
      devTotalValueUsd: null, // populated by devWallet.enrichBatch
      devRugPercent:    Math.round(rugPct * 10) / 10,
      devTotalLaunches: parseInt(t.creator_created_count || t.creator_open_count || 1, 10),
      score:            0,
      rank:             0,
    };
  }

  /**
   * Fetch dev's token history via CLI
   */
  async fetchDevTokenHistory(devAddress) {
    try {
      const data = await this._runCli(`npx gmgn-cli wallet holdings --chain ${this.chain} --address ${devAddress} --raw`);
      return data?.holdings || data?.data?.holdings || [];
    } catch {
      return [];
    }
  }
}
