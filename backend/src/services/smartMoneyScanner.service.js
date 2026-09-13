import { gmgnKeyPool } from './gmgnKeyPool.service.js';
import {
  saveSmartWallet,
  getSmartWallets,
  toggleStarSmartWallet,
  saveSmartSignal,
  saveClusterEvent,
  getClusterEvents,
} from '../db/database.js';

export class SmartMoneyScannerService {
  constructor(options = {}) {
    this.chain = options.chain || 'sol';
    this.isScanning = false;
    this.lastScanTime = null;
    this.scanIntervalMs = options.scanIntervalMs || 3 * 60 * 1000; // 3 minutes
    this.timer = null;
    this.broadcastFn = null; // WebSocket callback
    this.autoBuyFn = null;   // Auto-buy hook
    this.cachedClusters = [];
    this.tokenSmartMoneyMap = new Map(); // tokenAddress -> { count, avgWinRate, maxWinRate, wallets, isCabalDivergence }
  }

  setBroadcaster(fn) {
    this.broadcastFn = fn;
  }

  setAutoBuyHook(fn) {
    this.autoBuyFn = fn;
  }

  start() {
    if (this.timer) return;
    console.log('[Smart Money Scanner] Background scanner started (interval: 3m).');
    // Run initial scan after a short initial delay to let server settle
    setTimeout(() => {
      this.runScan().catch(err => console.warn('[Smart Money Scanner] Initial scan error:', err.message));
    }, 5000);

    this.timer = setInterval(() => {
      this.runScan().catch(err => console.warn('[Smart Money Scanner] Interval scan error:', err.message));
    }, this.scanIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Smart Money Scanner] Background scanner stopped.');
    }
  }

  /**
   * Main scan pipeline implementing the 5-Stage CircleIntelligence & Bouargane model:
   * Stage 1: Wallet / Data Tracking (Top 30 Trending Tokens)
   * Stage 2: Smart Wallet Cross-Matching (Top 50 traders per token, aggregate appearances >= minTokens)
   * Stage 3: Batch Profiling (POST /v1/user/wallet_profits for up to 100 wallets per call)
   * Stage 4: Qualification Gates (<$500k entry, 60%+ winrate, tag vetoes, cabal divergence)
   * Stage 5: Early Opportunity Cluster Output & WebSocket Alert
   */
  async runScan(params = {}) {
    if (this.isScanning) {
      console.log('[Smart Money Scanner] Scan already in progress, skipping trigger.');
      return { status: 'already_running' };
    }

    this.isScanning = true;
    const t0 = Date.now();
    const tokenLimit = params.tokenLimit || 30;
    const traderLimit = params.traderLimit || 50;
    const minTokens = params.minTokens || 3;
    const earlyMcapThreshold = params.earlyMcapThreshold || 500000; // $500k
    const minWinRate = params.minWinRate !== undefined ? params.minWinRate : 0.60;

    console.log(`[Smart Money Scanner] 🚀 Launching scan: tokens=${tokenLimit}, traders=${traderLimit}, minTokens=${minTokens}, minWinRate=${minWinRate * 100}%`);

    try {
      // ── Stage 1: Get Trending Tokens Universe ───────────────────────────
      let trendingTokens = [];
      try {
        const res = await gmgnKeyPool.getTrendingSwaps(this.chain, '1h', { limit: tokenLimit });
        const list = Array.isArray(res?.data?.rank) ? res.data.rank : (Array.isArray(res?.data) ? res.data : []);
        trendingTokens = list.map(item => ({
          address: item.address || item.token_address,
          symbol: item.symbol || 'TOKEN',
          name: item.name || '',
          price: Number(item.price || item.price_usd || 0),
          mcap: Number(item.market_cap || item.mcap || (item.price * 1000000000) || 0),
        })).filter(t => Boolean(t.address));
      } catch (err) {
        console.warn('[Smart Money Scanner] Trending swaps fetch failed, falling back to local tokens:', err.message);
      }

      if (trendingTokens.length === 0) {
        console.warn('[Smart Money Scanner] No trending tokens available to scan.');
        this.isScanning = false;
        return { success: false, reason: 'No tokens found' };
      }

      // ── Stage 2: Fetch Top Traders & Cross-Match ────────────────────────
      const walletStatsMap = new Map(); // address -> { address, tokensSeen: Set(), tokenDetails: [], rawTags: Set() }

      // Fetch in chunks of 5 tokens with rate-limit friendly spacing
      for (let i = 0; i < trendingTokens.length; i += 5) {
        const batch = trendingTokens.slice(i, i + 5);
        await Promise.all(batch.map(async (tok) => {
          try {
            const tradersRes = await gmgnKeyPool.getTokenTopTraders(this.chain, tok.address, { limit: traderLimit });
            const traders = Array.isArray(tradersRes?.data) ? tradersRes.data : (Array.isArray(tradersRes?.data?.traders) ? tradersRes.data.traders : []);

            for (const tr of traders) {
              const addr = tr.address || tr.wallet_address;
              if (!addr) continue;

              if (!walletStatsMap.has(addr)) {
                walletStatsMap.set(addr, {
                  address: addr,
                  tokensSeen: new Set(),
                  tokenDetails: [],
                  rawTags: new Set(),
                });
              }

              const entry = walletStatsMap.get(addr);
              entry.tokensSeen.add(tok.address);

              // Capture entry details for MCap and trade telemetry
              const costSol = Number(tr.total_cost || tr.buy_cost || 0);
              const profitUsd = Number(tr.realized_profit || tr.profit || 0);
              const entryPrice = Number(tr.avg_cost || tr.buy_price || tok.price || 0);
              const calculatedEntryMcap = entryPrice > 0 ? (entryPrice * 1000000000) : tok.mcap;

              entry.tokenDetails.push({
                tokenAddress: tok.address,
                tokenSymbol: tok.symbol,
                entryPrice,
                entryMcap: calculatedEntryMcap,
                profitUsd,
                costSol,
                tags: Array.isArray(tr.tags) ? tr.tags : [],
                isOpenOrClose: tr.is_open_or_close, // 0 = open/add, 1 = close/reduce
              });

              if (Array.isArray(tr.tags)) {
                tr.tags.forEach(tg => entry.rawTags.add(tg.toLowerCase()));
              }
            }
          } catch (err) {
            // Non-fatal per-token trader error
          }
        }));
        // Small breathing delay between batches
        if (i + 5 < trendingTokens.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      // Filter candidates that appeared in >= minTokens
      let candidateAddresses = [];
      for (const [addr, data] of walletStatsMap.entries()) {
        if (data.tokensSeen.size >= minTokens) {
          candidateAddresses.push(addr);
        }
      }

      // If strict filter yielded few results, relax to >= 2 tokens to avoid starvation
      if (candidateAddresses.length < 10) {
        for (const [addr, data] of walletStatsMap.entries()) {
          if (data.tokensSeen.size >= 2 && !candidateAddresses.includes(addr)) {
            candidateAddresses.push(addr);
          }
        }
      }

      console.log(`[Smart Money Scanner] Identified ${candidateAddresses.length} multi-token trader candidates.`);

      // ── Stage 3: Batch Profiling via POST /v1/user/wallet_profits ───────
      const qualifiedWallets = [];
      const BATCH_SIZE = 50; // up to 100 supported by GMGN

      for (let i = 0; i < candidateAddresses.length; i += BATCH_SIZE) {
        const batchAddrs = candidateAddresses.slice(i, i + BATCH_SIZE);
        try {
          const profitRes = await gmgnKeyPool.getWalletProfits(this.chain, batchAddrs, '7d');
          const profitList = Array.isArray(profitRes?.data) ? profitRes.data : (profitRes?.data?.list || []);

          for (const prof of profitList) {
            const addr = prof.address || prof.wallet_address;
            const traderContext = walletStatsMap.get(addr);
            if (!traderContext) continue;

            // Merge tags from profile and raw token trades
            const allTags = new Set([...traderContext.rawTags]);
            if (Array.isArray(prof.tags)) {
              prof.tags.forEach(t => allTags.add(String(t).toLowerCase()));
            }
            const tagArray = Array.from(allTags);

            // ── Stage 4: Qualification Gates & Anti-Scam Vetoes ───────────
            const hasVetoTag = tagArray.some(t =>
              t.includes('bundler') ||
              t.includes('rat_trader') ||
              t.includes('sandwich') ||
              t.includes('honeypot') ||
              t.includes('scam')
            );
            if (hasVetoTag) continue; // STRICT VETO

            // Parse metrics accurately
            const winRate = Number(prof.winrate ?? prof.win_rate ?? 0);
            const winRate30d = Number(prof.winrate_30d ?? prof.winrate_30 ?? winRate);
            const realizedPnlUsd = Number(prof.realized_profit ?? prof.realized_pnl ?? prof.pnl ?? 0);
            const unrealizedPnlUsd = Number(prof.unrealized_profit ?? prof.unrealized_pnl ?? 0);
            const totalTrades = Number(prof.txs ?? prof.total_trades ?? prof.trades ?? traderContext.tokensSeen.size);
            const tokensTradedCount = traderContext.tokensSeen.size;

            // Check Early Entry Invariant (< $500k MCap)
            let earlyEntryCount = 0;
            let totalEntryMcap = 0;
            for (const td of traderContext.tokenDetails) {
              if (td.entryMcap <= earlyMcapThreshold) {
                earlyEntryCount++;
              }
              totalEntryMcap += td.entryMcap;
            }
            const avgEntryMcap = traderContext.tokenDetails.length > 0
              ? Math.round(totalEntryMcap / traderContext.tokenDetails.length)
              : 0;

            // Enforce qualification rules
            const passesWinRate = winRate >= minWinRate;
            const passesPnL = realizedPnlUsd > 0;
            const passesEarlyEntry = earlyEntryCount >= 1 || avgEntryMcap <= earlyMcapThreshold;

            if (!passesWinRate || !passesPnL) continue;

            // Compute 0-100 Institutional Score
            // Formula: WinRate(35%) + PnL(25%) + Consistency/MultiToken(25%) + EarlyEntry(15%)
            const winScore = Math.min(35, Math.max(0, (winRate - 0.5) * 70));
            const pnlScore = Math.min(25, Math.max(0, Math.log10(Math.max(1, realizedPnlUsd)) * 5));
            const breadthScore = Math.min(25, (tokensTradedCount * 5) + (totalTrades >= 15 ? 10 : 5));
            const earlyScore = Math.min(15, earlyEntryCount * 5);
            const finalScore = Math.round(Math.min(100, winScore + pnlScore + breadthScore + earlyScore));

            const walletRecord = {
              wallet_address: addr,
              score: finalScore,
              win_rate_7d: Number((winRate * 100).toFixed(1)),
              win_rate_30d: Number((winRate30d * 100).toFixed(1)),
              realized_pnl_usd: Math.round(realizedPnlUsd),
              unrealized_pnl_usd: Math.round(unrealizedPnlUsd),
              total_trades: totalTrades,
              tokens_traded_count: tokensTradedCount,
              early_entry_count: earlyEntryCount,
              avg_entry_mcap_usd: avgEntryMcap,
              tags: tagArray,
              raw_profile: prof,
            };

            await saveSmartWallet(walletRecord);
            qualifiedWallets.push({ ...walletRecord, tokenDetails: traderContext.tokenDetails });
          }
        } catch (err) {
          console.warn('[Smart Money Scanner] Batch profit profiling failed for subset:', err.message);
        }
      }

      console.log(`[Smart Money Scanner] ✅ Successfully qualified & persisted ${qualifiedWallets.length} smart wallets.`);

      // ── Stage 5: Cluster Convergence Detection ──────────────────────────
      const clusters = this.detectTokenClusters(qualifiedWallets, trendingTokens);
      this.cachedClusters = clusters;

      for (const cluster of clusters) {
        await saveClusterEvent(cluster);

        // Broadcast to live WebSocket clients
        if (typeof this.broadcastFn === 'function') {
          this.broadcastFn({
            type: 'smart_cluster_signal',
            data: cluster,
          });
        }

        // Auto-Buy Hook if enabled and confidence is high
        if (typeof this.autoBuyFn === 'function' && cluster.confidence_score >= 80 && !cluster.is_cabal_divergence) {
          this.autoBuyFn(cluster);
        }
      }

      this.lastScanTime = new Date().toISOString();
      const durationMs = Date.now() - t0;
      console.log(`[Smart Money Scanner] Scan completed in ${(durationMs / 1000).toFixed(1)}s. ${clusters.length} active clusters detected.`);

      return {
        success: true,
        walletsCount: qualifiedWallets.length,
        clustersCount: clusters.length,
        durationMs,
        lastScanTime: this.lastScanTime,
      };
    } catch (err) {
      console.error('[Smart Money Scanner] Scan pipeline error:', err);
      return { success: false, error: err.message };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Detects cluster convergence: When 2 or more qualified smart wallets enter the same token.
   * Also checks for Toxic Cabal Divergence (KOL buy + Smart Money sell = EXIT DUMP).
   */
  detectTokenClusters(qualifiedWallets, trendingTokens) {
    const tokenMap = new Map(); // tokenAddress -> list of { wallet, detail }

    for (const w of qualifiedWallets) {
      for (const td of (w.tokenDetails || [])) {
        if (!tokenMap.has(td.tokenAddress)) {
          tokenMap.set(td.tokenAddress, []);
        }
        tokenMap.get(td.tokenAddress).push({
          wallet_address: w.wallet_address,
          score: w.score,
          win_rate: w.win_rate_7d,
          realized_pnl: w.realized_pnl_usd,
          tags: w.tags,
          detail: td,
        });
      }
    }

    const clusters = [];

    for (const [tokenAddr, participants] of tokenMap.entries()) {
      const validParticipants = participants.filter(p => p && p.wallet_address);
      const totalWinRate = validParticipants.reduce((acc, p) => acc + (p.win_rate || 0), 0);
      const avgWinRate = validParticipants.length > 0 ? Number((totalWinRate / validParticipants.length).toFixed(1)) : 0;
      const maxWinRate = validParticipants.length > 0 ? Math.max(...validParticipants.map(p => p.win_rate || 0)) : 0;

      const isKolBuying = validParticipants.some(p => p.tags.includes('kol') && p.detail?.isOpenOrClose === 0);
      const isSmartMoneySelling = validParticipants.some(p => !p.tags.includes('kol') && p.detail?.isOpenOrClose === 1);
      const isCabalDivergence = isKolBuying && isSmartMoneySelling;

      const kolParticipants = validParticipants.filter(p => Array.isArray(p.tags) && p.tags.some(t => {
        const lower = String(t).toLowerCase();
        return lower.includes('kol') || lower.includes('influencer');
      }));
      const kolCount = kolParticipants.length;

      // Index per-token smart money telemetry for EVERY token seen (even 1 smart wallet)
      this.tokenSmartMoneyMap.set(tokenAddr, {
        tokenAddress: tokenAddr,
        count: validParticipants.length,
        avgWinRate,
        maxWinRate,
        kolCount,
        kolWallets: kolParticipants.map(p => ({
          wallet_address: p.wallet_address,
          score: p.score,
          win_rate: p.win_rate,
          realized_pnl: p.realized_pnl,
          tags: p.tags,
        })),
        wallets: validParticipants.map(p => ({
          wallet_address: p.wallet_address,
          score: p.score,
          win_rate: p.win_rate,
          realized_pnl: p.realized_pnl,
          entry_mcap: p.detail?.entryMcap || 0,
          cost_sol: p.detail?.costSol || 0,
          tags: p.tags,
          isOpenOrClose: p.detail?.isOpenOrClose,
        })),
        isCabalDivergence,
      });

      if (participants.length >= 2) {
        const tokenMeta = trendingTokens.find(t => t.address === tokenAddr) || {};
        const avgEntry = Math.round(
          participants.reduce((acc, p) => acc + (p.detail?.entryMcap || tokenMeta.mcap || 0), 0) / participants.length
        );

        // Calculate confidence score (0-100)
        let conf = Math.min(95, 50 + (participants.length * 10));
        if (avgEntry < 200000) conf += 10;
        if (isCabalDivergence) conf = Math.max(10, conf - 40); // heavily penalize exit dump

        clusters.push({
          token_address: tokenAddr,
          token_name: tokenMeta.name || 'Trending Token',
          token_symbol: tokenMeta.symbol || 'TOKEN',
          cluster_count: participants.length,
          kol_count: kolCount,
          smart_wallets: participants.map(p => ({
            wallet_address: p.wallet_address,
            score: p.score,
            win_rate: p.win_rate,
            entry_mcap: p.detail?.entryMcap || 0,
            tags: p.tags,
          })),
          kol_wallets: kolParticipants.map(p => ({
            wallet_address: p.wallet_address,
            score: p.score,
            win_rate: p.win_rate,
            tags: p.tags,
          })),
          average_entry_mcap: avgEntry,
          confidence_score: Math.min(100, conf),
          is_cabal_divergence: isCabalDivergence,
        });
      }
    }

    // Sort by confidence score descending
    clusters.sort((a, b) => b.confidence_score - a.confidence_score);
    return clusters;
  }

  /**
   * Return verified smart money telemetry for a specific token address.
   */
  getSmartMoneyForToken(tokenAddress) {
    if (!tokenAddress) return null;
    return this.tokenSmartMoneyMap.get(tokenAddress) || null;
  }

  /**
   * Non-destructively enrich a token object with authentic smart money and KOL counts and win rates.
   */
  enrichTokenWithSmartMoney(token) {
    if (!token || !token.address) return token;
    const sm = this.getSmartMoneyForToken(token.address);

    const kolMap = new Map();
    // 1. If smart money scan identified KOLs for this token
    if (sm && Array.isArray(sm.kolWallets)) {
      for (const kw of sm.kolWallets) {
        if (kw && kw.wallet_address) {
          kolMap.set(kw.wallet_address, kw);
        }
      }
    }

    // 2. Also check token.topTraders for any KOL or Influencer tags
    if (Array.isArray(token.topTraders)) {
      for (const tr of token.topTraders) {
        const tagStr = (tr.tag || (Array.isArray(tr.tags) ? tr.tags.join(' ') : '')) || '';
        const lower = String(tagStr).toLowerCase();
        if (lower.includes('kol') || lower.includes('influencer')) {
          const addr = tr.trader || tr.wallet_address || tr.address;
          if (addr && !kolMap.has(addr)) {
            kolMap.set(addr, {
              wallet_address: addr,
              tag: tr.tag || 'KOL',
              vol: tr.vol || null,
              profit: tr.profit || null,
              win_rate: tr.win_rate || tr.winRate || null,
            });
          }
        }
      }
    }

    // 3. Also check token.topHolders for any KOL or Influencer tags
    if (Array.isArray(token.topHolders)) {
      for (const h of token.topHolders) {
        const tagStr = (h.tag || (Array.isArray(h.tags) ? h.tags.join(' ') : '')) || '';
        const lower = String(tagStr).toLowerCase();
        if (lower.includes('kol') || lower.includes('influencer')) {
          const addr = h.address || h.wallet_address;
          if (addr && !kolMap.has(addr)) {
            kolMap.set(addr, {
              wallet_address: addr,
              tag: h.tag || 'KOL',
              amount: h.amount || null,
              share: h.share || null,
            });
          }
        }
      }
    }

    const kolWallets = Array.from(kolMap.values());
    token.kolWallets = kolWallets;
    token.kolCount = kolWallets.length;
    token.hasKol = kolWallets.length > 0;

    if (sm) {
      token.smartMoneyCount = sm.count || 0;
      token.smartMoneyWinRate = sm.avgWinRate || sm.maxWinRate || 0;
      token.smartMoneyMaxWinRate = sm.maxWinRate || 0;
      token.smartWallets = sm.wallets || [];
      token.hasSmartMoney = (sm.count || 0) > 0;
      token.isCabalDivergence = Boolean(sm.isCabalDivergence);
    } else {
      token.smartMoneyCount = token.smartMoneyCount ?? 0;
      token.smartMoneyWinRate = token.smartMoneyWinRate ?? null;
      token.smartMoneyMaxWinRate = token.smartMoneyMaxWinRate ?? null;
      token.smartWallets = token.smartWallets || [];
      token.hasSmartMoney = (token.smartMoneyCount || 0) > 0;
    }
    return token;
  }

  /**
   * 1-Click GMGN 7D Institutional Preset:
   * Time = 7D, WinRate >= 70%, Realized PnL >= $50k+, Top 20 wallets starred.
   */
  async runPreset7D(options = {}) {
    const minWinRate = options.minWinRate !== undefined ? options.minWinRate : 0.70;
    const minPnlUsd = options.minPnlUsd !== undefined ? options.minPnlUsd : 50000;
    const starCount = options.starCount || 20;

    console.log(`[Smart Money Scanner] ⚡ Running 1-Click 7D Preset (WinRate >= ${(minWinRate * 100)}%, PnL >= $${minPnlUsd.toLocaleString()})`);

    try {
      const res = await gmgnKeyPool.getSmartMoney(this.chain, 100);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.list) ? res.data.list : []);

      if (list.length === 0) {
        throw new Error('No smart money data returned from GMGN endpoint');
      }

      const matching = [];

      for (const item of list) {
        const addr = item.address || item.wallet_address;
        if (!addr) continue;

        const winRate = Number(item.winrate ?? item.win_rate ?? 0);
        const realizedPnl = Number(item.realized_profit ?? item.realized_pnl ?? item.pnl ?? 0);
        const totalTrades = Number(item.txs ?? item.total_trades ?? item.trades ?? 0);
        const tags = Array.isArray(item.tags) ? item.tags.map(t => String(t).toLowerCase()) : [];

        // Anti-scam vetoes
        if (tags.some(t => t.includes('bundler') || t.includes('rat_trader') || t.includes('scam'))) {
          continue;
        }

        if (winRate >= minWinRate && realizedPnl >= minPnlUsd) {
          // Compute score
          const score = Math.round(Math.min(100, (winRate * 45) + (Math.log10(realizedPnl) * 10) + (totalTrades > 20 ? 15 : 5)));
          matching.push({
            wallet_address: addr,
            score,
            win_rate_7d: Number((winRate * 100).toFixed(1)),
            win_rate_30d: Number((Number(item.winrate_30d || winRate) * 100).toFixed(1)),
            realized_pnl_usd: Math.round(realizedPnl),
            unrealized_pnl_usd: Math.round(Number(item.unrealized_profit || 0)),
            total_trades: totalTrades,
            tokens_traded_count: Number(item.tokens_count || 5),
            early_entry_count: Number(item.early_entry_count || 3),
            avg_entry_mcap_usd: Number(item.avg_entry_mcap || 250000),
            tags,
            raw_profile: item,
          });
        }
      }

      // Sort by realized profit descending
      matching.sort((a, b) => b.realized_pnl_usd - a.realized_pnl_usd);

      // Star the top N wallets
      const savedList = [];
      for (let i = 0; i < matching.length; i++) {
        const w = matching[i];
        const isStarred = i < starCount;
        const saved = await saveSmartWallet({ ...w, is_starred: isStarred });
        savedList.push(saved);
      }

      console.log(`[Smart Money Scanner] 7D Preset completed: ${savedList.length} wallets qualified, top ${Math.min(starCount, savedList.length)} starred.`);
      return {
        success: true,
        count: savedList.length,
        starredCount: Math.min(starCount, savedList.length),
        wallets: savedList,
      };
    } catch (err) {
      console.error('[Smart Money Scanner] 7D Preset error:', err.message);
      throw err;
    }
  }

  getClusters() {
    return this.cachedClusters;
  }
}

export const smartMoneyScanner = new SmartMoneyScannerService();
