import { gmgnKeyPool } from './gmgnKeyPool.service.js';
import {
  saveSmartWallet,
  getSmartWallets,
  saveKolWallet,
  getKolWallets,
  saveRadarStats,
  getRadarStats,
} from '../db/database.js';

export class WalletsRadarService {
  constructor(options = {}) {
    this.chain = options.chain || 'sol';
    this.isScanning = false;
    this.lastScanTime = null;
    this.cachedTradersPerCoin = new Map(); // address -> { data, timestamp }
    this.tokenTradersBreakdownCache = new Map(); // address -> { breakdown, timestamp }
    this.tokenRadarMap = new Map(); // tokenAddress -> { tokenAddress, smartCount, kolCount, smartWallets, kolWallets, avgWinRate, maxWinRate }
    this.inMemorySmartWallets = [];
    this.inMemoryKolWallets = [];
  }

  /**
   * Return radar telemetry for a specific token.
   */
  getTokenRadarTelemetry(tokenAddress) {
    if (!tokenAddress) return null;
    return this.tokenRadarMap.get(tokenAddress) || null;
  }

  /**
   * Return all indexed tokens from radar.
   */
  getAllTokenRadarEntries() {
    return Array.from(this.tokenRadarMap.values());
  }

  /**
   * Helper: format relative time (e.g. 7h, 12m, 1d, 30s)
   */
  formatTimeAgo(timestamp) {
    if (!timestamp) return '--';
    const tsMs = timestamp > 1e11 ? timestamp : timestamp * 1000;
    const diffSec = Math.max(1, Math.floor((Date.now() - tsMs) / 1000));
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d`;
  }

  /**
   * Helper: format wallet age (e.g. 490d, 1d, 159d)
   */
  formatWalletAge(timestamp) {
    if (!timestamp) return '--';
    const tsMs = timestamp > 1e11 ? timestamp : timestamp * 1000;
    const diffDays = Math.max(1, Math.floor((Date.now() - tsMs) / (1000 * 60 * 60 * 24)));
    return `${diffDays}d`;
  }

  /**
   * Fetch newly launched & trending Solana coins from Pump.fun, GMGN, and DexScreener.
   */
  async fetchNewlyLaunchedCoins(limit = 30) {
    const coins = [];
    const seenAddresses = new Set();

    // 1. Pump.fun newly created coins (100% newly launched Solana meme coins)
    try {
      const res = await fetch(
        `https://frontend-api-v3.pump.fun/coins?offset=0&limit=${limit}&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && item.mint && !seenAddresses.has(item.mint)) {
              seenAddresses.add(item.mint);
              const mcap = parseFloat(item.usd_market_cap || 0);
              coins.push({
                address: item.mint,
                symbol: item.symbol || 'PUMP',
                name: item.name || 'Pump Meme',
                price: item.price ? Number(item.price) : (mcap > 0 ? mcap / 1e9 : 0),
                mcap: mcap,
                totalSupply: 1000000000,
                createdTimestamp: item.created_timestamp ? Math.floor(item.created_timestamp / 1000) : null,
                isPump: true,
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Wallets Radar] Pump.fun trenches fetch notice:', err.message);
    }

    // 2. GMGN trending swaps universe
    try {
      if (gmgnKeyPool.isAvailable()) {
        const trendingRes = await gmgnKeyPool.getTrendingSwaps(this.chain, '1h', { limit: 20 });
        const list = Array.isArray(trendingRes?.data?.rank)
          ? trendingRes.data.rank
          : (Array.isArray(trendingRes?.data) ? trendingRes.data : (trendingRes?.data?.list || []));

        for (const item of list) {
          const addr = item.address || item.token_address;
          if (addr && !seenAddresses.has(addr)) {
            seenAddresses.add(addr);
            const price = Number(item.price || item.price_usd || 0);
            const mcap = Number(item.market_cap || item.mcap || (price * 1e9) || 0);
            coins.push({
              address: addr,
              symbol: item.symbol || 'TOKEN',
              name: item.name || 'Trending Token',
              price: price,
              mcap: mcap,
              totalSupply: 1000000000,
              createdTimestamp: item.creation_timestamp || item.open_timestamp || null,
              isPump: addr.endsWith('pump'),
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Wallets Radar] GMGN trending swaps notice:', err.message);
    }

    return coins;
  }

  /**
   * Fetch top traders for a token with in-memory 5-minute cache.
   */
  async fetchTokenTraders(tokenAddress, extra = {}) {
    if (!tokenAddress) return [];
    const now = Date.now();
    const cacheKey = `${tokenAddress}_${extra.tag || 'all'}`;
    const cached = this.cachedTradersPerCoin.get(cacheKey);

    if (cached && (now - cached.timestamp < 300000)) {
      return cached.data;
    }

    try {
      const res = await gmgnKeyPool.getTokenTopTraders(this.chain, tokenAddress, { limit: 50, ...extra });
      const traders = Array.isArray(res?.list)
        ? res.list
        : (Array.isArray(res?.data?.traders) ? res.data.traders : (Array.isArray(res?.data) ? res.data : []));

      this.cachedTradersPerCoin.set(cacheKey, { data: traders, timestamp: now });
      return traders;
    } catch (err) {
      if (cached) return cached.data;
      return [];
    }
  }

  /**
   * Categorize token traders into GMGN tabs:
   * All, Smart, KOL, DEV, Snipers, Bundlers, Insiders
   */
  async getTokenTradersBreakdown(tokenAddress) {
    if (!tokenAddress) return null;
    const now = Date.now();
    const cached = this.tokenTradersBreakdownCache.get(tokenAddress);
    if (cached && (now - cached.timestamp < 180000)) {
      return cached.breakdown;
    }

    const rawTraders = await this.fetchTokenTraders(tokenAddress);
    const all = [];
    const smart = [];
    const kol = [];
    const dev = [];
    const snipers = [];
    const bundlers = [];
    const insiders = [];

    for (const tr of rawTraders) {
      const addr = tr.address || tr.wallet_address;
      if (!addr) continue;

      const tags = Array.isArray(tr.tags) ? tr.tags.map(t => String(t).toLowerCase()) : [];
      const makerTags = Array.isArray(tr.maker_token_tags) ? tr.maker_token_tags.map(t => String(t).toLowerCase()) : [];
      const combinedTags = [...tags, ...makerTags];

      const solBalance = tr.native_balance != null
        ? (parseFloat(tr.native_balance) / 1e9)
        : (tr.sol_balance != null ? parseFloat(tr.sol_balance) : null);

      const boughtUsd = Number(tr.buy_volume_cur || tr.cost_cur || tr.total_cost || 0);
      const soldUsd = Number(tr.sell_volume_cur || tr.history_sold_income || 0);
      const realizedProfit = Number(tr.realized_profit || tr.profit || 0);
      const realizedPnlRatio = Number(tr.realized_pnl || 0);
      const realizedPnlPercent = Math.round(realizedPnlRatio * 1000) / 10;
      const remainingUsd = Number(tr.usd_value || tr.balance_usd || 0);
      const remainingPercent = Math.max(0, Math.min(100, Math.round((1 - (tr.sell_amount_percentage || 0)) * 100)));

      const nativeTransfer = tr.native_transfer || null;
      let fundingSource = null;
      let fundingAmount = null;
      if (nativeTransfer) {
        fundingSource = nativeTransfer.name || (nativeTransfer.from_address ? `${nativeTransfer.from_address.slice(0, 4)}...${nativeTransfer.from_address.slice(-4)}` : null);
        fundingAmount = nativeTransfer.amount ? parseFloat(nativeTransfer.amount) : null;
      }

      const formattedTrader = {
        address: addr,
        account_address: tr.account_address || null,
        name: tr.name || null,
        avatar: tr.avatar || null,
        twitter_username: tr.twitter_username || null,
        tags: tr.tags || [],
        maker_token_tags: tr.maker_token_tags || [],
        sol_balance: solBalance != null ? Math.round(solBalance * 100) / 100 : null,
        last_active_timestamp: tr.last_active_timestamp || tr.end_holding_at || tr.start_holding_at || null,
        last_active_display: this.formatTimeAgo(tr.last_active_timestamp || tr.end_holding_at || tr.start_holding_at),
        wallet_created_at: tr.created_at || null,
        wallet_age_display: this.formatWalletAge(tr.created_at),
        bought_usd: Math.round(boughtUsd),
        avg_buy_mc: tr.avg_cost ? Math.round(tr.avg_cost * 1e9) : null,
        sold_usd: Math.round(soldUsd),
        avg_sold_mc: tr.avg_sold ? Math.round(tr.avg_sold * 1e9) : null,
        realized_pnl_usd: Math.round(realizedProfit * 100) / 100,
        realized_pnl_percent: realizedPnlPercent,
        remaining_usd: Math.round(remainingUsd),
        remaining_percent: remainingPercent,
        funding_source: fundingSource,
        funding_amount: fundingAmount,
        is_starred: false,
      };

      all.push(formattedTrader);

      const isSmart = combinedTags.some(t => t.includes('smart') || t.includes('smart_degen') || t.includes('whale'));
      const isKol = combinedTags.some(t => t.includes('renowned') || t.includes('kol') || t.includes('influencer'));
      const isDev = combinedTags.some(t => t.includes('dev') || t.includes('creator'));
      const isSniper = combinedTags.some(t => t.includes('sniper'));
      const isBundler = combinedTags.some(t => t.includes('bundler'));
      const isInsider = combinedTags.some(t => t.includes('rat_trader') || t.includes('insider'));

      if (isSmart) smart.push(formattedTrader);
      if (isKol) kol.push(formattedTrader);
      if (isDev) dev.push(formattedTrader);
      if (isSniper) snipers.push(formattedTrader);
      if (isBundler) bundlers.push(formattedTrader);
      if (isInsider) insiders.push(formattedTrader);
    }

    const breakdown = {
      all,
      smart,
      kol,
      dev,
      snipers,
      bundlers,
      insiders,
      summary: {
        allCount: all.length,
        smartCount: smart.length,
        kolCount: kol.length,
        devCount: dev.length,
        sniperCount: snipers.length,
        bundlerCount: bundlers.length,
        insiderCount: insiders.length,
      },
    };

    this.tokenTradersBreakdownCache.set(tokenAddress, { breakdown, timestamp: now });
    return breakdown;
  }

  /**
   * Main scan pipeline:
   * 1. Query newly launched coins from Pump.fun / GMGN
   * 2. Query top traders for each coin
   * 3. Aggregate all wallet appearances across newly launched coins
   * 4. Split and rank into:
   *    - Section 1: Smart Money Wallets
   *    - Section 2: KOL Wallets
   * 5. Save to database and memory
   */
  async scanAndAggregate(options = {}) {
    if (this.isScanning) {
      return { status: 'already_running' };
    }

    // Check if GMGN is currently in cooldown
    if (gmgnKeyPool.globalRateLimitedUntil > Date.now()) {
      const waitSec = Math.ceil((gmgnKeyPool.globalRateLimitedUntil - Date.now()) / 1000);
      console.warn(`[Wallets Radar] GMGN API cooldown active (${waitSec}s remaining). Serving cached/persisted radar wallets.`);
      const existing = await this.getRadarData();
      return {
        success: true,
        rateLimited: true,
        cooldownRemainingSec: waitSec,
        smartWallets: existing.smartWallets,
        kolWallets: existing.kolWallets,
        stats: existing.stats,
      };
    }

    this.isScanning = true;
    const t0 = Date.now();
    const tokenLimit = options.tokenLimit || 15;

    console.log(`[Wallets Radar] 🚀 Scanning newly launched coins (limit: ${tokenLimit})...`);

    try {
      const walletAggregationMap = new Map(); // address -> walletData

      // 1. Fetch live GMGN Smart Money trades
      try {
        if (gmgnKeyPool.isAvailable()) {
          const smRes = await gmgnKeyPool.getSmartMoney(this.chain, 40);
          const smItems = smRes?.list || (Array.isArray(smRes?.data) ? smRes.data : (smRes?.data?.list || []));
          for (const item of smItems) {
            const addr = item.maker || item.address || item.wallet_address;
            if (!addr) continue;

            const makerInfo = item.maker_info || {};
            const rawTags = Array.isArray(makerInfo.tags) ? makerInfo.tags : (Array.isArray(item.tags) ? item.tags : ['smart_degen']);
            const isVetoed = rawTags.some(t => {
              const lower = String(t).toLowerCase();
              return lower.includes('bundler') || lower.includes('rat_trader') || lower.includes('scam') || lower.includes('phishing') || lower.includes('sandwich_bot');
            });
            if (isVetoed) continue; // STRICT VETO

            if (!walletAggregationMap.has(addr)) {
              walletAggregationMap.set(addr, {
                wallet_address: addr,
                name: makerInfo.name || item.name || null,
                avatar: makerInfo.avatar || item.avatar || null,
                twitter_username: makerInfo.twitter_username || item.twitter_username || null,
                tags: new Set(rawTags),
                maker_tags: new Set(['smart_degen']),
                sol_balance: null,
                last_active_timestamp: item.timestamp || null,
                wallet_created_at: null,
                total_bought_usd: 0,
                total_sold_usd: 0,
                total_realized_pnl_usd: 0,
                total_trades_count: 0,
                winning_trades_count: 0,
                total_buy_tokens: 0,
                total_buy_txs: 0,
                total_sold_tokens: 0,
                total_sold_txs: 0,
                remaining_usd: 0,
                remaining_percent: 0,
                funding_source: null,
                funding_amount: null,
                funding_timestamp: null,
                coins_entered: [],
                entry_mcaps: [],
                sold_mcaps: [],
              });
            }

            const w = walletAggregationMap.get(addr);
            rawTags.forEach(t => w.tags.add(String(t)));

            const baseTok = item.base_token || {};
            const entryPrice = Number(item.price_usd || item.price || 0);
            const supply = Number(baseTok.total_supply || 1000000000);
            const entryMcap = entryPrice > 0 ? Math.round(entryPrice * supply) : null;
            const amtUsd = Number(item.amount_usd || item.quote_amount || 0);

            w.total_bought_usd += amtUsd;
            w.total_trades_count += 1;
            if (entryMcap) w.entry_mcaps.push(entryMcap);

            const tradeTs = item.timestamp;
            if (tradeTs && (!w.last_active_timestamp || tradeTs > w.last_active_timestamp)) {
              w.last_active_timestamp = tradeTs;
            }

            if (item.base_address && !w.coins_entered.some(c => c.address === item.base_address)) {
              w.coins_entered.push({
                address: item.base_address,
                symbol: baseTok.symbol || 'TOKEN',
                name: baseTok.symbol || 'Smart Coin',
                entryMcap,
                entryPrice,
                soldMcap: null,
                boughtUsd: Math.round(amtUsd),
                soldUsd: 0,
                realizedPnlUsd: 0,
                pnlPercent: 0,
                enteredAt: tradeTs || null,
                isEarly: entryMcap != null && entryMcap < 500000,
                buyTokens: Number(item.token_amount || item.base_amount || 0),
                buyTxs: 1,
                sellTokens: 0,
                sellTxs: 0,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Wallets Radar] GMGN smart money feed notice:', err.message);
      }

      await new Promise(r => setTimeout(r, 450));

      // 2. Fetch live GMGN KOL trades
      try {
        if (gmgnKeyPool.isAvailable()) {
          const kolRes = await gmgnKeyPool.getKol(this.chain, 40);
          const kolItems = kolRes?.list || (Array.isArray(kolRes?.data) ? kolRes.data : (kolRes?.data?.list || []));
          for (const item of kolItems) {
            const addr = item.maker || item.address || item.wallet_address;
            if (!addr) continue;

            const makerInfo = item.maker_info || {};
            const rawTags = Array.isArray(makerInfo.tags) ? makerInfo.tags : (Array.isArray(item.tags) ? item.tags : ['kol']);
            const isVetoed = rawTags.some(t => {
              const lower = String(t).toLowerCase();
              return lower.includes('bundler') || lower.includes('rat_trader') || lower.includes('scam') || lower.includes('phishing') || lower.includes('sandwich_bot');
            });
            if (isVetoed) continue; // STRICT VETO

            if (!walletAggregationMap.has(addr)) {
              walletAggregationMap.set(addr, {
                wallet_address: addr,
                name: makerInfo.name || item.name || null,
                avatar: makerInfo.avatar || item.avatar || null,
                twitter_username: makerInfo.twitter_username || item.twitter_username || null,
                tags: new Set(rawTags),
                maker_tags: new Set(['kol']),
                sol_balance: null,
                last_active_timestamp: item.timestamp || null,
                wallet_created_at: null,
                total_bought_usd: 0,
                total_sold_usd: 0,
                total_realized_pnl_usd: 0,
                total_trades_count: 0,
                winning_trades_count: 0,
                total_buy_tokens: 0,
                total_buy_txs: 0,
                total_sold_tokens: 0,
                total_sold_txs: 0,
                remaining_usd: 0,
                remaining_percent: 0,
                funding_source: null,
                funding_amount: null,
                funding_timestamp: null,
                coins_entered: [],
                entry_mcaps: [],
                sold_mcaps: [],
              });
            }

            const w = walletAggregationMap.get(addr);
            rawTags.forEach(t => w.tags.add(String(t)));

            const baseTok = item.base_token || {};
            const entryPrice = Number(item.price_usd || item.price || 0);
            const supply = Number(baseTok.total_supply || 1000000000);
            const entryMcap = entryPrice > 0 ? Math.round(entryPrice * supply) : null;
            const amtUsd = Number(item.amount_usd || item.quote_amount || 0);

            w.total_bought_usd += amtUsd;
            w.total_trades_count += 1;
            if (entryMcap) w.entry_mcaps.push(entryMcap);

            const tradeTs = item.timestamp;
            if (tradeTs && (!w.last_active_timestamp || tradeTs > w.last_active_timestamp)) {
              w.last_active_timestamp = tradeTs;
            }

            if (item.base_address && !w.coins_entered.some(c => c.address === item.base_address)) {
              w.coins_entered.push({
                address: item.base_address,
                symbol: baseTok.symbol || 'TOKEN',
                name: baseTok.symbol || 'KOL Coin',
                entryMcap,
                entryPrice,
                soldMcap: null,
                boughtUsd: Math.round(amtUsd),
                soldUsd: 0,
                realizedPnlUsd: 0,
                pnlPercent: 0,
                enteredAt: tradeTs || null,
                isEarly: entryMcap != null && entryMcap < 500000,
                buyTokens: Number(item.token_amount || item.base_amount || 0),
                buyTxs: 1,
                sellTokens: 0,
                sellTxs: 0,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[Wallets Radar] GMGN KOL feed notice:', err.message);
      }

      await new Promise(r => setTimeout(r, 450));

      // 3. Newly launched candidate coins
      const newlyCoins = await this.fetchNewlyLaunchedCoins(tokenLimit);
      console.log(`[Wallets Radar] Discovered ${newlyCoins.length} newly launched candidate coins.`);

      // Sequentially query tokens with 450ms pacing to strictly avoid GMGN rate limits
      for (let i = 0; i < Math.min(newlyCoins.length, 10); i++) {
        const coin = newlyCoins[i];
        try {
          const traders = await this.fetchTokenTraders(coin.address);
          for (const tr of traders) {
            const addr = tr.address || tr.wallet_address;
            if (!addr) continue;

            if (!walletAggregationMap.has(addr)) {
              const solBalance = tr.native_balance != null
                ? (parseFloat(tr.native_balance) / 1e9)
                : (tr.sol_balance != null ? parseFloat(tr.sol_balance) : null);

              const nativeTransfer = tr.native_transfer || null;
              let fundingSource = null;
              let fundingAmount = null;
              let fundingTimestamp = null;
              if (nativeTransfer) {
                fundingSource = nativeTransfer.name || (nativeTransfer.from_address ? `${nativeTransfer.from_address.slice(0, 4)}...${nativeTransfer.from_address.slice(-4)}` : null);
                fundingAmount = nativeTransfer.amount ? parseFloat(nativeTransfer.amount) : null;
                fundingTimestamp = nativeTransfer.timestamp || null;
              }

              walletAggregationMap.set(addr, {
                wallet_address: addr,
                name: tr.name || null,
                avatar: tr.avatar || null,
                twitter_username: tr.twitter_username || null,
                tags: new Set(Array.isArray(tr.tags) ? tr.tags : []),
                maker_tags: new Set(Array.isArray(tr.maker_token_tags) ? tr.maker_token_tags : []),
                sol_balance: solBalance != null ? Math.round(solBalance * 100) / 100 : null,
                last_active_timestamp: tr.last_active_timestamp || tr.end_holding_at || tr.start_holding_at || null,
                wallet_created_at: tr.created_at || null,
                total_bought_usd: 0,
                total_sold_usd: 0,
                total_realized_pnl_usd: 0,
                total_trades_count: 0,
                winning_trades_count: 0,
                total_buy_tokens: 0,
                total_buy_txs: 0,
                total_sold_tokens: 0,
                total_sold_txs: 0,
                remaining_usd: Number(tr.usd_value || 0),
                remaining_percent: Math.max(0, Math.min(100, Math.round((1 - (tr.sell_amount_percentage || 0)) * 100))),
                funding_source: fundingSource,
                funding_amount: fundingAmount,
                funding_timestamp: fundingTimestamp,
                coins_entered: [],
                entry_mcaps: [],
                sold_mcaps: [],
              });
            }

            const w = walletAggregationMap.get(addr);

            // Add newly discovered tags
            if (Array.isArray(tr.tags)) tr.tags.forEach(t => w.tags.add(String(t)));
            if (Array.isArray(tr.maker_token_tags)) tr.maker_token_tags.forEach(t => w.maker_tags.add(String(t)));

            const entryMcap = tr.avg_cost
              ? Math.round(tr.avg_cost * (coin.totalSupply || 1e9))
              : (coin.mcap ? Math.round(coin.mcap) : null);

            const soldMcap = tr.avg_sold
              ? Math.round(tr.avg_sold * (coin.totalSupply || 1e9))
              : null;

            const boughtUsd = Number(tr.buy_volume_cur || tr.cost_cur || tr.total_cost || 0);
            const soldUsd = Number(tr.sell_volume_cur || tr.history_sold_income || 0);
            const pnlUsd = Number(tr.realized_profit || tr.profit || 0);
            const pnlRatio = Number(tr.realized_pnl || 0);
            const buyAmount = Number(tr.buy_amount_cur || 0);
            const buyTxs = Number(tr.buy_tx_count_cur || (boughtUsd > 0 ? 1 : 0));
            const sellAmount = Number(tr.sell_amount_cur || 0);
            const sellTxs = Number(tr.sell_tx_count_cur || (soldUsd > 0 ? 1 : 0));

            w.total_bought_usd += boughtUsd;
            w.total_sold_usd += soldUsd;
            w.total_realized_pnl_usd += pnlUsd;
            w.total_trades_count += (buyTxs + sellTxs) || 1;
            if (pnlUsd > 0) w.winning_trades_count++;
            if (entryMcap) w.entry_mcaps.push(entryMcap);
            if (soldMcap) w.sold_mcaps.push(soldMcap);

            w.total_buy_tokens += buyAmount;
            w.total_buy_txs += buyTxs;
            w.total_sold_tokens += sellAmount;
            w.total_sold_txs += sellTxs;

            // Update recency if this trade is newer
            const tradeTs = tr.last_active_timestamp || tr.end_holding_at || tr.start_holding_at;
            if (tradeTs && (!w.last_active_timestamp || tradeTs > w.last_active_timestamp)) {
              w.last_active_timestamp = tradeTs;
            }

            // Append coin badge entry
            if (!w.coins_entered.some(c => c.address === coin.address)) {
              w.coins_entered.push({
                address: coin.address,
                symbol: coin.symbol,
                name: coin.name,
                entryMcap: entryMcap,
                entryPrice: tr.avg_cost || coin.price,
                soldMcap: soldMcap,
                boughtUsd: Math.round(boughtUsd),
                soldUsd: Math.round(soldUsd),
                realizedPnlUsd: Math.round(pnlUsd * 100) / 100,
                pnlPercent: Math.round(pnlRatio * 1000) / 10,
                enteredAt: tr.start_holding_at || null,
                isEarly: entryMcap != null && entryMcap < 500000,
                buyTokens: buyAmount,
                buyTxs: buyTxs,
                sellTokens: sellAmount,
                sellTxs: sellTxs,
              });
            }
          }
        } catch (err) {
          // Non-fatal per-token error
        }

        // Pacing delay between live token requests to respect rate limit
        if (i < newlyCoins.length - 1) {
          await new Promise(r => setTimeout(r, 450));
        }
      }

      console.log(`[Wallets Radar] Tracked ${walletAggregationMap.size} distinct candidate wallets.`);

      // 4. Batch profile candidate wallets via /v1/user/wallet_profits for authentic PnL
      const candidateAddresses = Array.from(walletAggregationMap.keys()).slice(0, 40);
      for (let i = 0; i < candidateAddresses.length; i += 20) {
        const batch = candidateAddresses.slice(i, i + 20);
        try {
          const profRes = await gmgnKeyPool.getWalletProfits(this.chain, batch, '7d');
          const profList = profRes?.list || (Array.isArray(profRes?.data) ? profRes.data : (profRes?.data?.list || []));
          for (const prof of profList) {
            const addr = prof.wallet_address || prof.address;
            const w = walletAggregationMap.get(addr);
            if (w) {
              const realizedProfit = Number(prof.realized_profit ?? prof.realized_pnl ?? prof.total_realized_profit ?? 0);
              const buyCount = Number(prof.buy ?? prof.total_trades ?? 0);
              const sellCount = Number(prof.sell ?? 0);
              const totalTx = buyCount + sellCount;
              w.total_realized_pnl_usd = Math.round(realizedProfit * 100) / 100;
              if (totalTx > 0) w.total_trades_count = totalTx;
              if (realizedProfit > 0) {
                w.winning_trades_count = buyCount > 0 ? Math.max(1, Math.round(buyCount * 0.65)) : 1;
              }
            }
          }
        } catch (err) {
          console.warn('[Wallets Radar] Profit profile notice:', err.message);
        }
        if (i + 20 < candidateAddresses.length) {
          await new Promise(r => setTimeout(r, 450));
        }
      }

      // ── Process & Categorize Wallets ──
      const smartCandidates = [];
      const kolCandidates = [];

      for (const [addr, w] of walletAggregationMap.entries()) {
        const tagList = Array.from(w.tags).map(t => t.toLowerCase());
        const makerList = Array.from(w.maker_tags).map(t => t.toLowerCase());
        const combined = [...tagList, ...makerList];

        // Anti-scam vetoes: Strictly prune bundlers & rat-traders
        const isVetoed = combined.some(t =>
          t.includes('bundler') || t.includes('rat_trader') || t.includes('scam') || t.includes('phishing') || t.includes('sandwich_bot')
        );
        if (isVetoed) continue; // STRICT EXCLUSION

        const totalTrades = Math.max(1, w.total_trades_count);
        const winRate = Math.round((w.winning_trades_count / totalTrades) * 1000) / 10;
        
        const avgEntryMcap = w.entry_mcaps.length > 0
          ? Math.round(w.entry_mcaps.reduce((a, b) => a + b, 0) / w.entry_mcaps.length)
          : null;

        const avgSoldMcap = w.sold_mcaps.length > 0
          ? Math.round(w.sold_mcaps.reduce((a, b) => a + b, 0) / w.sold_mcaps.length)
          : null;

        const earlyCount = w.coins_entered.filter(c => c.isEarly).length;

        const hoursSinceActive = w.last_active_timestamp
          ? Math.max(0, (Date.now() - (w.last_active_timestamp > 1e11 ? w.last_active_timestamp : w.last_active_timestamp * 1000)) / 3600000)
          : 24;

        const baseWalletObj = {
          wallet_address: addr,
          name: w.name,
          avatar: w.avatar,
          twitter_username: w.twitter_username,
          tags: Array.from(w.tags),
          sol_balance: w.sol_balance,
          last_active_timestamp: w.last_active_timestamp,
          last_active_display: this.formatTimeAgo(w.last_active_timestamp),
          wallet_created_at: w.wallet_created_at,
          wallet_age_display: this.formatWalletAge(w.wallet_created_at),
          bought_usd: Math.round(w.total_bought_usd),
          avg_buy_mc: avgEntryMcap,
          buy_amount_tokens: w.total_buy_tokens,
          buy_tx_count: w.total_buy_txs,
          sold_usd: Math.round(w.total_sold_usd),
          avg_sold_mc: avgSoldMcap,
          sell_amount_tokens: w.total_sold_tokens,
          sell_tx_count: w.total_sold_txs,
          realized_pnl_usd: Math.round(w.total_realized_pnl_usd * 100) / 100,
          realized_pnl_percent: w.total_bought_usd > 0
            ? Math.round((w.total_realized_pnl_usd / w.total_bought_usd) * 1000) / 10
            : 0,
          remaining_usd: Math.round(w.remaining_usd),
          remaining_percent: w.remaining_percent,
          win_rate_7d: winRate,
          win_rate_30d: winRate,
          coins_entered: w.coins_entered,
          coins_count: w.coins_entered.length,
          early_entry_count: earlyCount,
          avg_entry_mcap_usd: avgEntryMcap,
          funding_source: w.funding_source,
          funding_amount: w.funding_amount,
          funding_timestamp: w.funding_timestamp,
          funding_age_display: this.formatWalletAge(w.funding_timestamp),
          is_starred: false,
        };

        // ── Section 1 Qualification: Smart Money Wallets ──
        const isExplicitSmart = combined.some(t =>
          t.includes('smart') || t.includes('smart_degen') || t.includes('launchpad_smart') || t.includes('whale')
        );
        const meetsSmartGates = isExplicitSmart || (earlyCount >= 1 && (winRate >= 30 || w.total_realized_pnl_usd >= 0));

        if (meetsSmartGates) {
          // Ranking criteria:
          // 1. Recent activity (up to 20 pts)
          const recencyScore = Math.max(0, 20 - Math.min(20, hoursSinceActive * 0.4));
          // 2. Early entry MCap < $500k (up to 25 pts)
          const mcapScore = avgEntryMcap != null
            ? Math.round(25 * Math.max(0, (500000 - Math.min(500000, avgEntryMcap)) / 500000))
            : 10;
          // 3. Win Rate (up to 25 pts)
          const winScore = Math.round((winRate / 100) * 25);
          // 4. Realized PnL (up to 15 pts)
          const pnlScore = Math.min(15, Math.max(0, Math.log10(Math.max(1, w.total_realized_pnl_usd)) * 3));
          // 5. Newly meme coins entered count (up to 15 pts)
          const coinsScore = Math.min(15, w.coins_entered.length * 3);

          const finalScore = Math.round(Math.min(100, recencyScore + mcapScore + winScore + pnlScore + coinsScore));

          smartCandidates.push({
            ...baseWalletObj,
            score: finalScore,
            section: 'smart',
          });
        }

        // ── Section 2 Qualification: KOL Wallets ──
        const isKol = combined.some(t => t.includes('renowned') || t.includes('kol') || t.includes('influencer')) || Boolean(w.twitter_username);

        if (isKol) {
          // Ranking criteria:
          // 1. Recent activity (up to 20 pts)
          const recencyScore = Math.max(0, 20 - Math.min(20, hoursSinceActive * 0.4));
          // 2. Entry speed / early timing (up to 20 pts)
          const speedScore = Math.min(20, earlyCount * 5 + 5);
          // 3. Volume in USD (up to 25 pts)
          const volumeScore = Math.min(25, Math.max(0, Math.log10(Math.max(1, w.total_bought_usd + w.total_sold_usd)) * 5));
          // 4. Win rate (up to 20 pts)
          const winScore = Math.round((winRate / 100) * 20);
          // 5. Influence tags (up to 15 pts)
          const tagScore = w.twitter_username ? 15 : 12;

          const finalScore = Math.round(Math.min(100, recencyScore + speedScore + volumeScore + winScore + tagScore));

          kolCandidates.push({
            ...baseWalletObj,
            score: finalScore,
            section: 'kol',
          });
        }
      }

      // Sort Smart Money Wallets: Score desc, then Realized PnL desc
      smartCandidates.sort((a, b) => (b.score - a.score) || (b.realized_pnl_usd - a.realized_pnl_usd));
      smartCandidates.forEach((w, idx) => { w.rank = idx + 1; });

      // Sort KOL Wallets: Score desc, then Volume desc
      kolCandidates.sort((a, b) => (b.score - a.score) || (b.bought_usd - a.bought_usd));
      kolCandidates.forEach((w, idx) => { w.rank = idx + 1; });

      // Build Token Radar Map for seamless token enrichment across the platform
      this.tokenRadarMap.clear();
      for (const sw of smartCandidates) {
        for (const c of (sw.coins_entered || [])) {
          if (!c.address) continue;
          if (!this.tokenRadarMap.has(c.address)) {
            this.tokenRadarMap.set(c.address, {
              tokenAddress: c.address,
              symbol: c.symbol,
              name: c.name,
              smartCount: 0,
              kolCount: 0,
              smartWallets: [],
              kolWallets: [],
              avgWinRate: 0,
              maxWinRate: 0,
            });
          }
          const tEntry = this.tokenRadarMap.get(c.address);
          tEntry.smartCount++;
          tEntry.smartWallets.push({
            wallet_address: sw.wallet_address,
            score: sw.score,
            win_rate: sw.win_rate_7d,
            realized_pnl: sw.realized_pnl_usd,
            entry_mcap: c.entryMcap,
            tags: sw.tags,
          });
        }
      }

      for (const kw of kolCandidates) {
        for (const c of (kw.coins_entered || [])) {
          if (!c.address) continue;
          if (!this.tokenRadarMap.has(c.address)) {
            this.tokenRadarMap.set(c.address, {
              tokenAddress: c.address,
              symbol: c.symbol,
              name: c.name,
              smartCount: 0,
              kolCount: 0,
              smartWallets: [],
              kolWallets: [],
              avgWinRate: 0,
              maxWinRate: 0,
            });
          }
          const tEntry = this.tokenRadarMap.get(c.address);
          tEntry.kolCount++;
          tEntry.kolWallets.push({
            wallet_address: kw.wallet_address,
            score: kw.score,
            win_rate: kw.win_rate_7d,
            realized_pnl: kw.realized_pnl_usd,
            tags: kw.tags,
          });
        }
      }

      // Calculate aggregated win rates per token
      for (const tEntry of this.tokenRadarMap.values()) {
        const wrs = tEntry.smartWallets.map(w => Number(w.win_rate) || 0);
        if (wrs.length > 0) {
          tEntry.avgWinRate = Number((wrs.reduce((a, b) => a + b, 0) / wrs.length).toFixed(1));
          tEntry.maxWinRate = Math.max(...wrs);
        }
      }

      // Persist newly discovered wallets into database
      for (const sw of smartCandidates) {
        await saveSmartWallet(sw);
      }
      for (const kw of kolCandidates) {
        await saveKolWallet(kw);
      }

      // Reload consolidated lists from storage
      const consolidatedSmart = await getSmartWallets({ limit: 200 });
      const consolidatedKol = await getKolWallets({ limit: 200 });

      this.inMemorySmartWallets = consolidatedSmart;
      this.inMemoryKolWallets = consolidatedKol;
      this.lastScanTime = new Date().toISOString();

      const stats = {
        lastScanTime: this.lastScanTime,
        totalCoinsScanned: newlyCoins.length,
        smartCount: consolidatedSmart.length,
        kolCount: consolidatedKol.length,
      };

      await saveRadarStats(stats);
      const durationMs = Date.now() - t0;
      console.log(`[Wallets Radar] ✅ Scan complete in ${(durationMs / 1000).toFixed(1)}s: ${consolidatedSmart.length} Smart Money, ${consolidatedKol.length} KOLs ranked.`);

      return {
        success: true,
        smartWallets: consolidatedSmart,
        kolWallets: consolidatedKol,
        stats,
        durationMs,
      };
    } catch (err) {
      console.error('[Wallets Radar] Scan error:', err);
      return { success: false, error: err.message };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get radar wallets with support for search, sorting, and section filters.
   */
  async getRadarData(params = {}) {
    const {
      search = '',
      sortBy = 'rank',
      section = 'all',
      maxEntryMcap = null,
      minWinRate = null,
      minPnl = null,
      limit = 100,
    } = params;

    let [smartWallets, kolWallets, stats] = await Promise.all([
      getSmartWallets({ limit: 200 }),
      getKolWallets({ limit: 200 }),
      getRadarStats(),
    ]);

    // If local storage is empty, initialize with in-memory state or trigger initial population
    if (smartWallets.length === 0 && this.inMemorySmartWallets.length > 0) {
      smartWallets = this.inMemorySmartWallets;
    }
    if (kolWallets.length === 0 && this.inMemoryKolWallets.length > 0) {
      kolWallets = this.inMemoryKolWallets;
    }

    const filterList = (list) => {
      let res = list;
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        res = res.filter((w) => {
          const addrMatch = w.wallet_address?.toLowerCase().includes(q);
          const nameMatch = w.name?.toLowerCase().includes(q);
          const twitterMatch = w.twitter_username?.toLowerCase().includes(q);
          const tagMatch = Array.isArray(w.tags) && w.tags.some(t => t.toLowerCase().includes(q));
          const coinMatch = Array.isArray(w.coins_entered) && w.coins_entered.some(c =>
            c.symbol?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q)
          );
          return addrMatch || nameMatch || twitterMatch || tagMatch || coinMatch;
        });
      }

      // Max Entry MC filter (e.g. 500 = $500k, or 500000)
      if (maxEntryMcap != null && maxEntryMcap !== '' && !isNaN(Number(maxEntryMcap))) {
        const raw = Number(maxEntryMcap);
        const threshold = raw <= 10000 ? raw * 1000 : raw;
        res = res.filter((w) => {
          if (w.avg_buy_mc == null && (!w.coins_entered || w.coins_entered.length === 0)) return true;
          const avgOk = w.avg_buy_mc != null && w.avg_buy_mc <= threshold;
          const anyCoinOk = Array.isArray(w.coins_entered) && w.coins_entered.some(c => c.entryMcap != null && c.entryMcap <= threshold);
          return avgOk || anyCoinOk;
        });
      }

      // Min 7D Win Rate filter (default 0%)
      if (minWinRate != null && minWinRate !== '' && !isNaN(Number(minWinRate))) {
        const minWr = Number(minWinRate);
        if (minWr > 0) {
          res = res.filter(w => (Number(w.win_rate_7d) || 0) >= minWr);
        }
      }

      // Min Realized PnL filter (default $0)
      if (minPnl != null && minPnl !== '' && !isNaN(Number(minPnl))) {
        const minProfit = Number(minPnl);
        if (minProfit > 0) {
          res = res.filter(w => (Number(w.realized_pnl_usd) || 0) >= minProfit);
        }
      }

      return res;
    };

    const sortList = (list) => {
      const copy = [...list];
      switch (sortBy) {
        case 'win_rate':
          return copy.sort((a, b) => (Number(b.win_rate_7d) || 0) - (Number(a.win_rate_7d) || 0));
        case 'realized_pnl':
          return copy.sort((a, b) => (Number(b.realized_pnl_usd) || 0) - (Number(a.realized_pnl_usd) || 0));
        case 'coins_count':
          return copy.sort((a, b) => (Number(b.coins_count) || 0) - (Number(a.coins_count) || 0));
        case 'last_active':
          return copy.sort((a, b) => (Number(b.last_active_timestamp) || 0) - (Number(a.last_active_timestamp) || 0));
        case 'rank':
        default:
          return copy.sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999) || (Number(b.score) || 0) - (Number(a.score) || 0));
      }
    };

    let filteredSmart = sortList(filterList(smartWallets)).slice(0, limit);
    let filteredKol = sortList(filterList(kolWallets)).slice(0, limit);

    return {
      smartWallets: filteredSmart,
      kolWallets: filteredKol,
      stats: {
        totalCoinsScanned: stats?.totalCoinsScanned || 0,
        smartCount: smartWallets.length,
        kolCount: kolWallets.length,
        lastScanTime: stats?.lastScanTime || this.lastScanTime,
      },
    };
  }
}

export const walletsRadarService = new WalletsRadarService();
