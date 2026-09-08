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
      if (i + batchSize < coins.length) {
        await this._sleep(100);
      }
    }
    return results;
  }

  /**
   * Enrich a single coin with dev wallet info.
   */
  async enrichCoin(coin) {
    if (!coin.devAddress) {
      return {
        ...coin,
        devBalanceSol:    coin.devBalanceSol ?? 0,
        devRugPercent:    coin.devRugPercent ?? 0,
        devTotalLaunches: coin.devTotalLaunches ?? 0,
      };
    }

    try {
      // 1. Check cache first (properly awaited)
      const cached = await getCachedDev(coin.devAddress);
      if (cached && cached.sol_balance !== undefined && cached.rug_percent !== undefined) {
        return {
          ...coin,
          devBalanceSol:    parseFloat(cached.sol_balance) || 0,
          devRugPercent:    parseFloat(cached.rug_percent) || 0,
          devTotalLaunches: parseInt(cached.total_launches, 10) || 0,
        };
      }

      // 2. If coin already has pre-filled simulation dev balance, preserve it
      let balance = coin.devBalanceSol;
      if (balance === null || balance === undefined) {
        balance = await this.getDevBalance(coin.devAddress);
      }

      // 3. Fetch rug data
      let rugData = {
        rugPercent: coin.devRugPercent ?? 0,
        totalLaunches: coin.devTotalLaunches ?? 1,
        rugCount: 0,
      };

      if (coin.devRugPercent === null || coin.devRugPercent === undefined) {
        rugData = await this.getDevRugData(coin);
      }

      const result = {
        solBalance:    balance ?? 0,
        rugPercent:    rugData.rugPercent ?? 0,
        totalLaunches: rugData.totalLaunches ?? 1,
        rugCount:      rugData.rugCount ?? 0,
      };

      // 4. Cache result (properly awaited)
      await cacheDev({
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
      console.warn(`[DEV] Notice for dev ${coin.devAddress}:`, err.message);
      return {
        ...coin,
        devBalanceSol:    coin.devBalanceSol ?? 0,
        devRugPercent:    coin.devRugPercent ?? 0,
        devTotalLaunches: coin.devTotalLaunches ?? 0,
      };
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
   */
  async getDevRugData(coin) {
    try {
      const { GMGNService } = await import('./gmgn.service.js');
      const gmgn = new GMGNService();
      const holdings = await gmgn.fetchDevTokenHistory(coin.devAddress);

      if (!holdings || !holdings.length) {
        return { rugPercent: 0, totalLaunches: 1, rugCount: 0 };
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
      return { rugPercent: 0, totalLaunches: 1, rugCount: 0 };
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
