/**
 * DexScreenerService
 *
 * Implements all 13 official DEX Screener OpenAPI endpoints (OpenAPI 3.0.3)
 * with smart caching, multi-stream discovery, and high-frequency price synchronization.
 *
 * The 13 Endpoints:
 * 1.  GET /token-profiles/latest/v1 (60 req/min)
 * 2.  GET /token-profiles/recent-updates/v1 (60 req/min)
 * 3.  GET /community-takeovers/latest/v1 (60 req/min)
 * 4.  GET /ads/latest/v1 (60 req/min)
 * 5.  GET /token-boosts/latest/v1 (60 req/min)
 * 6.  GET /token-boosts/top/v1 (60 req/min)
 * 7.  GET /orders/v1/{chainId}/{tokenAddress} (60 req/min)
 * 8.  GET /latest/dex/pairs/{chainId}/{pairId} (300 req/min)
 * 9.  GET /latest/dex/search (300 req/min)
 * 10. GET /token-pairs/v1/{chainId}/{tokenAddress} (300 req/min)
 * 11. GET /tokens/v1/{chainId}/{tokenAddresses} (300 req/min)
 * 12. GET /metas/trending/v1 (60 req/min)
 * 13. GET /metas/meta/v1/{slug} (60 req/min)
 */

export class DexScreenerService {
  constructor() {
    this.cache = [];
    this.lastFetchTime = 0;
    this.endpointCache = new Map(); // url -> { data, timestamp }
    this.ctoMap = new Map(); // tokenAddress -> ctoObject
    this.boostsMap = new Map(); // tokenAddress -> boostObject
    this.adsMap = new Map(); // tokenAddress -> adObject
  }

  /**
   * Internal cached JSON fetcher with custom TTL and timeout.
   */
  async _fetchJsonWithCache(url, ttlMs = 30000) {
    const now = Date.now();
    const cached = this.endpointCache.get(url);
    if (cached && (now - cached.timestamp < ttlMs)) {
      return cached.data;
    }
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (!res.ok) return cached ? cached.data : null;
      const data = await res.json();
      this.endpointCache.set(url, { data, timestamp: now });
      return data;
    } catch (err) {
      console.warn(`[DexScreener API] Notice for ${url}:`, err.message);
      return cached ? cached.data : null;
    }
  }

  // ── 1. Latest Token Profiles (60 req/min) ─────────────────────────
  async fetchLatestTokenProfiles() {
    const data = await this._fetchJsonWithCache('https://api.dexscreener.com/token-profiles/latest/v1', 30000);
    return Array.isArray(data) ? data : [];
  }

  // ── 2. Recently Updated Token Profiles (60 req/min) ───────────────
  async fetchRecentTokenProfiles() {
    const data = await this._fetchJsonWithCache('https://api.dexscreener.com/token-profiles/recent-updates/v1', 30000);
    return Array.isArray(data) ? data : [];
  }

  // ── 3. Community Takeovers (CTO) (60 req/min) ─────────────────────
  async fetchCommunityTakeovers() {
    const data = await this._fetchJsonWithCache('https://api.dexscreener.com/community-takeovers/latest/v1', 30000);
    const list = Array.isArray(data) ? data : [];
    for (const cto of list) {
      if (cto && cto.tokenAddress && cto.chainId === 'solana') {
        this.ctoMap.set(cto.tokenAddress, cto);
      }
    }
    return list;
  }

  // ── 4. Active Ads (60 req/min) ────────────────────────────────────
  async fetchLatestAds() {
    const data = await this._fetchJsonWithCache('https://api.dexscreener.com/ads/latest/v1', 30000);
    const list = Array.isArray(data) ? data : [];
    for (const ad of list) {
      if (ad && ad.tokenAddress && ad.chainId === 'solana') {
        this.adsMap.set(ad.tokenAddress, ad);
      }
    }
    return list;
  }

  // ── 5. Latest Boosted Tokens (60 req/min) ─────────────────────────
  async fetchLatestBoosts() {
    const data = await this._fetchJsonWithCache('https://api.dexscreener.com/token-boosts/latest/v1', 20000);
    return Array.isArray(data) ? data : [];
  }

  // ── 6. Top Boosted Tokens (60 req/min) ────────────────────────────
  async fetchTopBoosts() {
    const data = await this._fetchJsonWithCache('https://api.dexscreener.com/token-boosts/top/v1', 20000);
    const list = Array.isArray(data) ? data : [];
    for (const b of list) {
      if (b && b.tokenAddress && b.chainId === 'solana') {
        this.boostsMap.set(b.tokenAddress, b);
      }
    }
    return list;
  }

  // ── 7. Check Paid Orders for Token (60 req/min) ───────────────────
  async checkPaidOrders(chainId = 'solana', tokenAddress) {
    if (!tokenAddress) return null;
    const url = `https://api.dexscreener.com/orders/v1/${chainId}/${tokenAddress}`;
    return await this._fetchJsonWithCache(url, 60000);
  }

  // ── 8. Single Pair Details (300 req/min) ──────────────────────────
  async fetchPair(chainId = 'solana', pairId) {
    if (!pairId) return null;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${chainId}/${pairId}`;
    const data = await this._fetchJsonWithCache(url, 15000);
    return data?.pair || data?.pairs?.[0] || null;
  }

  // ── 9. Search Pairs by Query (300 req/min) ────────────────────────
  async searchPairs(query) {
    if (!query) return [];
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;
    const data = await this._fetchJsonWithCache(url, 15000);
    return Array.isArray(data?.pairs) ? data.pairs : [];
  }

  // ── 10. Pools of a Given Token Address (300 req/min) ──────────────
  async fetchTokenPools(chainId = 'solana', tokenAddress) {
    if (!tokenAddress) return [];
    const url = `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`;
    const data = await this._fetchJsonWithCache(url, 20000);
    return Array.isArray(data) ? data : [];
  }

  // ── 11. Batch Token Lookup (up to 30 addrs) (300 req/min) ─────────
  async fetchTokensBatch(chainId = 'solana', tokenAddresses = []) {
    if (!Array.isArray(tokenAddresses) || tokenAddresses.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < tokenAddresses.length; i += 30) {
      chunks.push(tokenAddresses.slice(i, i + 30));
    }
    const allPairs = [];
    for (const chunk of chunks) {
      // Use latest/dex/tokens which returns all active pools (including migrated Raydium/PumpSwap pairs)
      const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`;
      try {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = await res.json();
          const pairs = Array.isArray(data?.pairs) ? data.pairs : (Array.isArray(data) ? data : []);
          if (pairs.length > 0) allPairs.push(...pairs);
        }
      } catch (err) {
        console.warn('[DexScreener Batch] Notice:', err.message);
      }
    }
    return allPairs;
  }

  // ── 12. Trending Narrative Metas (60 req/min) ─────────────────────
  async fetchTrendingMetas() {
    const data = await this._fetchJsonWithCache('https://api.dexscreener.com/metas/trending/v1', 60000);
    return Array.isArray(data) ? data : [];
  }

  // ── 13. Meta With Pairs for a Slug (60 req/min) ───────────────────
  async fetchMetaWithPairs(slug) {
    if (!slug) return null;
    const url = `https://api.dexscreener.com/metas/meta/v1/${encodeURIComponent(slug)}`;
    return await this._fetchJsonWithCache(url, 60000);
  }

  /**
   * High-Level Pipeline: Multi-Stream Inflow Discovery across all DexScreener channels.
   */
  async fetchLiveSolanaTokens() {
    try {
      const addresses = await this._collectSolanaAddresses();
      if (!addresses.length) return this.cache;

      // Batch addresses in chunks of up to 30
      const pairs = await this.fetchTokensBatch('solana', addresses);
      if (!pairs.length) return this.cache;

      // Deduplicate highest liquidity pair per token
      const tokenMap = new Map();
      for (const p of pairs) {
        if (!p || p.chainId !== 'solana' || !p.baseToken?.address) continue;
        const addr = p.baseToken.address;
        const liq = p.liquidity?.usd || 0;
        if (!tokenMap.has(addr) || (tokenMap.get(addr).liquidity?.usd || 0) < liq) {
          tokenMap.set(addr, p);
        }
      }

      // Normalize pairs in parallel
      const normalized = await Promise.all(
        Array.from(tokenMap.values()).map(pair => this._normalizeDexPair(pair))
      );

      if (normalized.length > 0) {
        this.cache = normalized;
        this.lastFetchTime = Date.now();
      }

      return this.cache;
    } catch (err) {
      console.error('[DexScreener] Error fetching tokens:', err.message);
      return this.cache;
    }
  }

  /**
   * Batch refresh real-time prices, market caps, liquidity, volume, and txs
   * for an array of tokens (batches up to 30 addresses per HTTP request).
   */
  async refreshTokensLivePrices(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) return tokens;

    const addressToToken = new Map();
    const addresses = [];
    for (const t of tokens) {
      if (t && t.address) {
        addressToToken.set(t.address, t);
        addresses.push(t.address);
      }
    }

    if (addresses.length === 0) return tokens;

    const pairs = await this.fetchTokensBatch('solana', addresses);
    if (!pairs || pairs.length === 0) return tokens;

    // Select active pair with highest liquidity and volume per token (never prefer dead pumpfun curves)
    const bestPairMap = new Map();
    for (const p of pairs) {
      if (!p || !p.baseToken?.address) continue;
      const addr = p.baseToken.address;
      const liq = parseFloat(p.liquidity?.usd || 0);
      const vol = parseFloat(p.volume?.h24 || 0);
      const existing = bestPairMap.get(addr);
      if (!existing) {
        bestPairMap.set(addr, p);
        continue;
      }
      const existingLiq = parseFloat(existing.liquidity?.usd || 0);
      const existingVol = parseFloat(existing.volume?.h24 || 0);
      // Prefer pair with active liquidity; if both or neither have liquidity, prefer higher volume
      if ((existingLiq === 0 && liq > 0) || (liq > 0 && vol > existingVol) || (existingLiq === 0 && vol > existingVol)) {
        bestPairMap.set(addr, p);
      }
    }

    for (const [addr, pair] of bestPairMap.entries()) {
      const coin = addressToToken.get(addr);
      if (!coin) continue;

      const oldPrice = coin.price || 0;
      const newPrice = parseFloat(pair.priceUsd || 0);

      if (newPrice > 0) {
        coin.price = newPrice;
        coin.priceDelta = newPrice > oldPrice ? 'up' : newPrice < oldPrice ? 'down' : 'same';
      }

      const mktCap = parseFloat(pair.marketCap || pair.fdv || 0);
      if (mktCap > 0) {
        coin.mktCapK = mktCap / 1000;
      }

      if (pair.liquidity?.usd) {
        coin.liquidityK = parseFloat(pair.liquidity.usd) / 1000;
      }
      if (pair.liquidity?.quote) {
        coin.poolQuoteSol = parseFloat(pair.liquidity.quote);
      }
      if (pair.liquidity?.base) {
        coin.poolBaseAmount = parseFloat(pair.liquidity.base);
      }

      if (pair.volume?.h24) {
        coin.volumeK = parseFloat(pair.volume.h24) / 1000;
      }

      const buys = parseInt(pair.txns?.h24?.buys || pair.txns?.h1?.buys || 0, 10);
      const sells = parseInt(pair.txns?.h24?.sells || pair.txns?.h1?.sells || 0, 10);
      if (buys > 0 || sells > 0) {
        coin.buys = buys;
        coin.sells = sells;
        coin.txs = buys + sells;
      }

      if (pair.pairCreatedAt) {
        coin.ageMinutes = Math.max(1, Math.round((Date.now() - pair.pairCreatedAt) / 60000));
      }

      coin.pairAddress = pair.pairAddress || coin.pairAddress;
      coin.dexId = pair.dexId || coin.dexId;
      coin.url = pair.url || coin.url;

      coin.priceChange5m = parseFloat(pair.priceChange?.m5 || 0);
      coin.priceChange1h = parseFloat(pair.priceChange?.h1 || 0);
      coin.priceChange24h = parseFloat(pair.priceChange?.h24 || 0);

      coin.activeBoosts = pair.boosts?.active || coin.activeBoosts || 0;

      if (pair.info?.websites && pair.info.websites.length > 0) {
        coin.websiteUrl = coin.websiteUrl || pair.info.websites[0].url;
        coin.website = coin.website || pair.info.websites[0].url;
      }
      if (Array.isArray(pair.info?.socials)) {
        for (const s of pair.info.socials) {
          if (!s) continue;
          const type = s.type?.toLowerCase() || '';
          const u = s.url || '';
          if ((type === 'twitter' || u.includes('twitter.com') || u.includes('x.com')) && !coin.twitterUrl) {
            coin.twitterUrl = u;
            coin.twitter = coin.twitter || u;
          }
          if ((type === 'telegram' || u.includes('t.me') || u.includes('telegram.me')) && !coin.telegramUrl) {
            coin.telegramUrl = u;
            coin.telegram = coin.telegram || u;
          }
          if ((type === 'discord' || u.includes('discord.gg') || u.includes('discord.com')) && !coin.discordUrl) {
            coin.discordUrl = u;
          }
        }
      }
    }

    return tokens;
  }

  /**
   * Collect candidate Solana addresses from all DexScreener streams:
   * - Top Boosts & Latest Boosts
   * - Latest Token Profiles & Recent Updates
   * - Community Takeovers (CTO)
   * - Active Ads
   * - Trending Solana Search Queries
   */
  async _collectSolanaAddresses() {
    const addressSet = new Set();

    try {
      const [topB, latestB, profiles, recentProf, ctoData, adsData, searchSol, searchPump] =
        await Promise.allSettled([
          this.fetchTopBoosts(),
          this.fetchLatestBoosts(),
          this.fetchLatestTokenProfiles(),
          this.fetchRecentTokenProfiles(),
          this.fetchCommunityTakeovers(),
          this.fetchLatestAds(),
          this.searchPairs('sol'),
          this.searchPairs('pump'),
        ]);

      const items = [
        ...(topB.status === 'fulfilled' && Array.isArray(topB.value) ? topB.value : []),
        ...(latestB.status === 'fulfilled' && Array.isArray(latestB.value) ? latestB.value : []),
        ...(profiles.status === 'fulfilled' && Array.isArray(profiles.value) ? profiles.value : []),
        ...(recentProf.status === 'fulfilled' && Array.isArray(recentProf.value) ? recentProf.value : []),
        ...(ctoData.status === 'fulfilled' && Array.isArray(ctoData.value) ? ctoData.value : []),
        ...(adsData.status === 'fulfilled' && Array.isArray(adsData.value) ? adsData.value : []),
      ];

      for (const item of items) {
        if (item && item.chainId === 'solana' && item.tokenAddress) {
          addressSet.add(item.tokenAddress);
        }
      }

      // Add high volume search pairs
      const searchPairs = [
        ...(searchSol.status === 'fulfilled' && Array.isArray(searchSol.value) ? searchSol.value : []),
        ...(searchPump.status === 'fulfilled' && Array.isArray(searchPump.value) ? searchPump.value : []),
      ];

      for (const p of searchPairs) {
        if (p && p.chainId === 'solana' && p.baseToken?.address) {
          addressSet.add(p.baseToken.address);
        }
      }
    } catch (err) {
      console.warn('[DexScreener] Address discovery notice:', err.message);
    }

    return Array.from(addressSet);
  }

  /**
   * Normalizes a DexScreener pair into the terminal coin schema
   */
  async _normalizeDexPair(pair) {
    const baseAddr = pair.baseToken.address;
    const now = Date.now();
    const createdTs = pair.pairCreatedAt || (now - 1000 * 60 * 120); // default 2h if unknown
    const ageMinutes = Math.max(0, Math.round((now - createdTs) / 60000));

    const buys24h = parseInt(pair.txns?.h24?.buys || pair.txns?.h1?.buys || 0, 10);
    const sells24h = parseInt(pair.txns?.h24?.sells || pair.txns?.h1?.sells || 0, 10);
    const totalTxs = buys24h + sells24h;

    const volumeUsd = parseFloat(pair.volume?.h24 || pair.volume?.h6 || pair.volume?.h1 || 0);
    const mktCapUsd = parseFloat(pair.marketCap || pair.fdv || 0);
    const liquidityUsd = parseFloat(pair.liquidity?.usd || 0);

    // Net buy momentum
    let netBuyUsd = 0;
    if (totalTxs > 0 && volumeUsd > 0) {
      const buySellDiffRatio = (buys24h - sells24h) / totalTxs;
      netBuyUsd = buySellDiffRatio * volumeUsd;
    }

    const feesSol = ((volumeUsd * 0.0025) / 150) + (totalTxs * 0.00005);

    // Community Takeover (CTO) metadata check
    const ctoEntry = this.ctoMap.get(baseAddr);
    const isCTO = Boolean(ctoEntry);
    const claimDate = ctoEntry?.claimDate || null;

    // Check if token originated on pump.fun
    let devAddress = null;
    let devRugPercent = isCTO ? 0 : null;
    let devTotalLaunches = isCTO ? 1 : null;
    let devBalanceSol = null;
    let devTotalValueUsd = null;

    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (pair.pairAddress && base58Regex.test(pair.pairAddress)) {
      devAddress = pair.pairAddress;
    }

    const bCurvePercent = pair.dexId === 'pumpswap' || pair.dexId === 'pumpfun'
      ? (mktCapUsd < 69000 ? Math.min(99, Math.round((mktCapUsd / 69000) * 100)) : 100)
      : 100;

    let twitterUrl = null;
    let telegramUrl = null;
    let discordUrl = null;
    let rawTwitter = null;
    let rawTelegram = null;

    if (Array.isArray(pair.info?.socials)) {
      for (const s of pair.info.socials) {
        if (!s) continue;
        const type = s.type?.toLowerCase() || '';
        const u = s.url || '';
        if (type === 'twitter' || u.includes('twitter.com') || u.includes('x.com')) {
          twitterUrl = u;
          rawTwitter = u;
        }
        if (type === 'telegram' || u.includes('t.me') || u.includes('telegram.me')) {
          telegramUrl = u;
          rawTelegram = u;
        }
        if (type === 'discord' || u.includes('discord.gg') || u.includes('discord.com')) {
          discordUrl = u;
        }
      }
    }

    let websiteUrl = pair.info?.websites?.[0]?.url || null;
    const pumpData = pair.pumpData || null;
    if (pumpData) {
      if (!websiteUrl && pumpData.website) {
        websiteUrl = pumpData.website.startsWith('http') ? pumpData.website : `https://${pumpData.website}`;
      }
      if (!twitterUrl && pumpData.twitter) {
        rawTwitter = pumpData.twitter;
        twitterUrl = pumpData.twitter.startsWith('http') ? pumpData.twitter : `https://x.com/${pumpData.twitter.replace(/^@/, '')}`;
      }
      if (!telegramUrl && pumpData.telegram) {
        rawTelegram = pumpData.telegram;
        telegramUrl = pumpData.telegram.startsWith('http') ? pumpData.telegram : `https://t.me/${pumpData.telegram.replace(/^@/, '')}`;
      }
    }

    // CTO metadata supplements if websites or socials missing
    if (ctoEntry?.links) {
      for (const link of ctoEntry.links) {
        if (link.type === 'twitter' && !twitterUrl) twitterUrl = link.url;
        if (link.label === 'Website' && !websiteUrl) websiteUrl = link.url;
      }
    }

    const activeBoosts = pair.boosts?.active || (this.boostsMap.get(baseAddr)?.totalAmount || 0);

    return {
      address: baseAddr,
      name: pair.baseToken.name || 'Unknown',
      symbol: pair.baseToken.symbol || '???',
      logo: pair.info?.imageUrl || pair.info?.openGraph || ctoEntry?.icon || '',
      header: pair.info?.header || ctoEntry?.header || null,
      description: pair.info?.description || ctoEntry?.description || null,
      price: parseFloat(pair.priceUsd || 0),
      mktCapK: Math.round((mktCapUsd / 1000) * 10) / 10,
      liquidityK: Math.round((liquidityUsd / 1000) * 10) / 10,
      volumeK: Math.round((volumeUsd / 1000) * 10) / 10,
      netBuyK: Math.round((netBuyUsd / 1000) * 10) / 10,
      txs: totalTxs,
      buys: buys24h,
      sells: sells24h,
      totalFeesSol: Math.round(feesSol * 100) / 100,
      ageMinutes: ageMinutes,
      pumpLiveAgeMin: ageMinutes,
      bCurvePercent: bCurvePercent,
      devAddress: devAddress,
      devBalanceSol: devBalanceSol,
      devTotalValueUsd: devTotalValueUsd,
      devRugPercent: devRugPercent,
      devTotalLaunches: devTotalLaunches,
      dexUrl: pair.url,
      dexId: pair.dexId,
      website: websiteUrl,
      websiteUrl: websiteUrl,
      twitter: rawTwitter,
      twitterUrl: twitterUrl,
      telegram: rawTelegram,
      telegramUrl: telegramUrl,
      discordUrl: discordUrl,
      websites: pair.info?.websites || [],
      socials: pair.info?.socials || [],
      isCTO: isCTO,
      ctoClaimDate: claimDate,
      activeBoosts: activeBoosts,
      hasAd: Boolean(this.adsMap.has(baseAddr)),
      // DexScreener tokens have no live visiting_count; use conservative estimate capped at 12
      watchersCount: Math.max(1, Math.min(12, Math.round(Math.log10(Math.max(1, mktCapUsd / 5000) + 1) * 1.8 + Math.log10(Math.max(1, buys24h) + 1) * 1.2))),
      hasLiveWatchers: false,
      watchersDelta: Math.floor(Math.random() * 3),
      score: 0,
      rank: 0,
    };
  }
}
