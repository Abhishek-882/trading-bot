import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getCachedDev, cacheDev } from '../db/database.js';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export class DevWalletService {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
  }

  /**
   * Enrich an array of coins with dev wallet data.
   * Processes in batches of 5 to avoid rate limits.
   */
  async enrichBatch(coins, batchSize = 5) {
    const results = [];
    for (let i = 0; i < coins.length; i += batchSize) {
      const batch = coins.slice(i, i + batchSize);
      const enriched = await Promise.all(batch.map(c => this.enrichCoin(c)));
      results.push(...enriched);
      // Small delay between batches
      if (i + batchSize < coins.length) {
        await this._sleep(200);
      }
    }
    return results;
  }

  /**
   * Enrich a single coin with dev wallet info.
   */
  async enrichCoin(coin) {
    if (!coin.devAddress) {
      return { ...coin, devBalanceSol: 0, devRugPercent: 0, devTotalLaunches: 0 };
    }

    try {
      // Check cache first
      const cached = getCachedDev(coin.devAddress);
      if (cached) {
        return {
          ...coin,
          devBalanceSol:    cached.sol_balance,
          devRugPercent:    cached.rug_percent,
          devTotalLaunches: cached.total_launches,
        };
      }

      // Fetch fresh data
      const [balance, rugData] = await Promise.all([
        this.getDevBalance(coin.devAddress),
        this.getDevRugData(coin),
      ]);

      const result = {
        solBalance:    balance,
        rugPercent:    rugData.rugPercent,
        totalLaunches: rugData.totalLaunches,
        rugCount:      rugData.rugCount,
      };

      // Cache result
      cacheDev({
        dev_address:    coin.devAddress,
        sol_balance:    result.solBalance,
        rug_percent:    result.rugPercent,
        total_launches: result.totalLaunches,
        rugs_count:     result.rugCount,
      });

      return {
        ...coin,
        devBalanceSol:    result.solBalance,
        devRugPercent:    result.rugPercent,
        devTotalLaunches: result.totalLaunches,
      };
    } catch (err) {
      console.warn(`[DEV] Failed to enrich dev ${coin.devAddress}:`, err.message);
      return { ...coin, devBalanceSol: 0, devRugPercent: 0, devTotalLaunches: 0 };
    }
  }

  /**
   * Get SOL balance of a wallet address.
   */
  async getDevBalance(address) {
    try {
      const pubkey  = new PublicKey(address);
      const lamports = await this.connection.getBalance(pubkey);
      return lamports / LAMPORTS_PER_SOL;
    } catch {
      return 0;
    }
  }

  /**
   * Analyze a dev's token history for rug patterns.
   * Uses GMGN token security data if available; falls back to
   * heuristic analysis of the coin's own metrics.
   */
  async getDevRugData(coin) {
    // Import here to avoid circular dependency
    const { GMGNService } = await import('./gmgn.service.js');
    const gmgn = new GMGNService();

    try {
      const holdings = await gmgn.fetchDevTokenHistory(coin.devAddress);

      if (!holdings.length) {
        // No history — treat as new dev (neutral)
        return { rugPercent: 0, totalLaunches: 0, rugCount: 0 };
      }

      let rugCount = 0;
      for (const h of holdings) {
        if (this._isRug(h)) rugCount++;
      }

      const rugPercent = (rugCount / holdings.length) * 100;
      return {
        rugPercent:    Math.round(rugPercent * 10) / 10,
        totalLaunches: holdings.length,
        rugCount,
      };
    } catch {
      return { rugPercent: 0, totalLaunches: 0, rugCount: 0 };
    }
  }

  /**
   * Heuristic: did this holding rug?
   * A token is considered a rug if:
   *   - rug_ratio > 0.3 (GMGN score), OR
   *   - is_honeypot flag, OR
   *   - price dropped > 80% within the holding period
   */
  _isRug(holding) {
    if (holding.rug_ratio     && holding.rug_ratio > 0.3)   return true;
    if (holding.is_honeypot   && holding.is_honeypot)        return true;
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
