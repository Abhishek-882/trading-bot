import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getCachedDev, cacheDev } from '../db/database.js';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com';

// Approximate SOL/USD price for portfolio valuation
// In production this would be fetched from a price oracle
const SOL_USD_APPROX = parseFloat(process.env.SOL_USD_PRICE || '150');

export class DevWalletService {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
  }

  /**
   * Enrich an array of coins with dev wallet data.
   * Limits to top 30 candidate coins to keep each cycle sub-2-seconds.
   */
  async enrichBatch(coins, batchSize = 10) {
    if (!coins || !coins.length) return [];
    const results = [];
    const toEnrich = coins.slice(0, 50);
    const rest = coins.slice(50).map(c => ({
      ...c,
      devBalanceSol: c.devBalanceSol ?? 0,
      devTotalValueUsd: c.devTotalValueUsd ?? 0,
      devRugPercent: c.devRugPercent ?? 0,
      devTotalLaunches: c.devTotalLaunches ?? 0,
    }));

    for (let i = 0; i < toEnrich.length; i += batchSize) {
      const batch = toEnrich.slice(i, i + batchSize);
      const enriched = await Promise.all(batch.map(c => this.enrichCoin(c)));
      results.push(...enriched);
    }
    return [...results, ...rest];
  }

  /**
   * Enrich a single coin with dev wallet info:
   * - devBalanceSol      — native SOL balance
   * - devTotalValueUsd   — SOL + all token holdings in USD (the key "overall wealth" metric)
   * - devRugPercent      — % of past launches that rugged
   * - devTotalLaunches   — number of tokens ever created by this dev
   */
  async enrichCoin(coin) {
    if (!coin.devAddress) {
      return {
        ...coin,
        devBalanceSol:    coin.devBalanceSol    ?? 0,
        devTotalValueUsd: coin.devTotalValueUsd ?? 0,
        devRugPercent:    coin.devRugPercent    ?? 0,
        devTotalLaunches: coin.devTotalLaunches ?? 0,
      };
    }

    try {
      // 1. Check cache first
      const cached = await getCachedDev(coin.devAddress);
      if (cached && cached.sol_balance !== undefined && cached.rug_percent !== undefined) {
        return {
          ...coin,
          devBalanceSol:    parseFloat(cached.sol_balance)     || 0,
          devTotalValueUsd: parseFloat(cached.total_value_usd) || 0,
          devRugPercent:    parseFloat(cached.rug_percent)      || 0,
          devTotalLaunches: parseInt(cached.total_launches, 10) || 0,
        };
      }

      // 2. Get SOL balance (preserve pre-seeded simulation value)
      let solBalance = coin.devBalanceSol;
      if (solBalance === null || solBalance === undefined) {
        solBalance = await this.getDevBalance(coin.devAddress);
      }

      // 3. Get all token holdings and compute total portfolio value
      let tokenValueUsd = coin.devTokenValueUsd ?? 0;
      let rugData = {
        rugPercent:    coin.devRugPercent    ?? 0,
        totalLaunches: coin.devTotalLaunches ?? 1,
        rugCount:      0,
        tokenValueUsd: tokenValueUsd,
      };

      // Only fetch if dev data is not already seeded by mock
      if (coin.devRugPercent === null || coin.devRugPercent === undefined) {
        rugData = await this.getDevPortfolioAndRug(coin.devAddress);
      }

      const totalValueUsd = (solBalance * SOL_USD_APPROX) + rugData.tokenValueUsd;

      // 4. Cache enriched result
      await cacheDev({
        dev_address:     coin.devAddress,
        sol_balance:     solBalance,
        total_value_usd: totalValueUsd,
        rug_percent:     rugData.rugPercent,
        total_launches:  rugData.totalLaunches,
        rugs_count:      rugData.rugCount,
      });

      return {
        ...coin,
        devBalanceSol:    solBalance ?? 0,
        devTotalValueUsd: totalValueUsd,
        devRugPercent:    rugData.rugPercent,
        devTotalLaunches: rugData.totalLaunches,
      };
    } catch (err) {
      console.warn(`[DEV] Notice for dev ${coin.devAddress}:`, err.message);
      const fallbackSol = coin.devBalanceSol ?? 0;
      return {
        ...coin,
        devBalanceSol:    fallbackSol,
        devTotalValueUsd: coin.devTotalValueUsd ?? (fallbackSol * SOL_USD_APPROX),
        devRugPercent:    coin.devRugPercent    ?? 0,
        devTotalLaunches: coin.devTotalLaunches ?? 0,
      };
    }
  }

  /**
   * Get native SOL balance of a wallet.
   */
  async getDevBalance(address) {
    try {
      const pubkey   = new PublicKey(address);
      const lamports = await this.connection.getBalance(pubkey);
      return lamports / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }

  /**
   * Fetch dev's full token portfolio from GMGN:
   * - Calculates total token value in USD
   * - Detects rugs from past launches
   */
  async getDevPortfolioAndRug(devAddress) {
    try {
      const { GMGNService } = await import('./gmgn.service.js');
      const gmgn = new GMGNService();
      const holdings = await gmgn.fetchDevTokenHistory(devAddress);

      if (!holdings || !holdings.length) {
        return { rugPercent: 0, totalLaunches: 1, rugCount: 0, tokenValueUsd: 0 };
      }

      let rugCount = 0;
      let tokenValueUsd = 0;

      for (const h of holdings) {
        // Sum up total USD value of all token positions
        const holdingValue = parseFloat(h.usd_value || h.value_usd || h.total_value || 0);
        tokenValueUsd += holdingValue;

        if (this._isRug(h)) rugCount++;
      }

      const rugPercent = (rugCount / holdings.length) * 100;
      return {
        rugPercent:    Math.round(rugPercent * 10) / 10,
        totalLaunches: holdings.length,
        rugCount,
        tokenValueUsd,
      };
    } catch {
      return { rugPercent: 0, totalLaunches: 1, rugCount: 0, tokenValueUsd: 0 };
    }
  }

  _isRug(holding) {
    if (holding.rug_ratio && holding.rug_ratio > 0.3) return true;
    if (holding.is_honeypot) return true;
    if (holding.unrealized_pnl !== undefined) {
      const pctChange = (holding.unrealized_pnl / (holding.total_cost || 1)) * 100;
      if (pctChange < -80) return true;
    }
    return false;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
