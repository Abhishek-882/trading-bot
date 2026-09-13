import { FilterService } from '../services/filter.service.js';
import { SessionWalletService } from '../services/sessionWallet.service.js';
import { GMGNService } from '../services/gmgn.service.js';
import { mlDataCollector } from '../services/mlDataCollector.service.js';
import { modelMonitor } from '../services/modelMonitor.service.js';
import { ensembleRankerService } from '../services/ensembleRanker.service.js';
import { smartMoneyScanner } from '../services/smartMoneyScanner.service.js';
import { walletsRadarService } from '../services/walletsRadar.service.js';
import { excelExporter } from '../services/excelExporter.service.js';
import {
  getTrades,
  savePreset,
  getPresets,
  updateBotConfig,
  getSmartWallets,
  toggleStarSmartWallet,
  getClusterEvents,
} from '../db/database.js';

const filterService  = new FilterService();
const sessionService = new SessionWalletService();

export function setupRoutes(app, { getLatestCoins, setFilters, setDevFilters, getFilters, trader, gmgn }) {
  const gmgnService = gmgn || new GMGNService();

  // ── Keys & System Telemetry ───────────────────────────────────────
  app.get('/api/keys/status', (req, res) => {
    res.json({ success: true, data: gmgnService.keyPool?.getPoolStats() || null });
  });

  // ── Machine Learning Telemetry & Drift Monitoring ────────────────
  app.get('/api/ml-stats', (req, res) => {
    const stats = mlDataCollector.getStats();
    const health = modelMonitor.getHealthReport();
    res.json({ success: true, data: { ...stats, health } });
  });

  app.get('/api/ml-health', (req, res) => {
    const health = modelMonitor.getHealthReport();
    res.json({ success: true, data: health });
  });

  // ── Coins ───────────────────────────────────────────────────────

  app.get('/api/ai-picks', (req, res) => {
    const coins = getLatestCoins() || [];
    const rankingResult = ensembleRankerService.rankTokens(coins);
    res.json({
      success: true,
      data: rankingResult.topPicks,
      metadata: rankingResult.metadata,
    });
  });

  app.get('/api/coins/ranked', (req, res) => {
    const coins = getLatestCoins() || [];
    for (const c of coins) {
      if (c && c.address) {
        smartMoneyScanner.enrichTokenWithSmartMoney(c);
      }
    }
    res.json({ success: true, data: coins });
  });

  app.get('/api/token/:address/details', async (req, res) => {
    try {
      const { address } = req.params;
      const coins = getLatestCoins();
      let coin = coins.find(c => c.address === address) || null;

      // Query live GMGN security metrics (with 60s memory cache & RugCheck fallback)
      const securityDetails = await gmgnService.fetchTokenSecurityDetails(address);

      if (!coin) {
        // Construct basic coin representation if not currently in top ranked list
        coin = {
          address,
          name: securityDetails?.name || 'Unknown Token',
          symbol: securityDetails?.symbol || '???',
          logo: securityDetails?.logo || '',
          price: securityDetails?.price || 0,
          mktCapK: securityDetails?.mktCapK || 0,
          liquidityK: securityDetails?.liquidityK || 0,
          volumeK: securityDetails?.volumeK || 0,
          netBuyK: securityDetails?.netBuyK || 0,
          txs: securityDetails?.txs || 0,
          buys: securityDetails?.buys || 0,
          sells: securityDetails?.sells || 0,
          totalFeesSol: securityDetails?.totalFeesSol || 0,
          ageMinutes: 0,
          pumpLiveAgeMin: 0,
          bCurvePercent: 100,
          devAddress: securityDetails?.devAddress || null,
          devBalanceSol: null,
          devTotalValueUsd: null,
          devRugPercent: securityDetails?.rugPercentNum || 0,
          devTotalLaunches: 1,
          score: 0,
          rank: 0,
        };
      }

      // Merge market data with live GMGN security metrics
      const isPaid = Boolean(securityDetails?.dexPaid ?? coin.dexPaid);
      // Never hardcode $299 — dexPaidAmount must come from real DexScreener order data
      const paidAmount = securityDetails?.dexPaidAmount || coin.dexPaidAmount || null;
      const paidDisplay = isPaid
        ? (securityDetails?.dexPaidDisplay && securityDetails.dexPaidDisplay !== 'Unpaid'
            ? securityDetails.dexPaidDisplay
            : (coin.dexPaidDisplay && coin.dexPaidDisplay !== 'Unpaid'
                ? coin.dexPaidDisplay
                : (paidAmount ? `$${paidAmount}` : 'Paid')))
        : 'Unpaid';

      // Real dynamic fees
      const effectiveFeesSol = (coin.totalFeesSol && coin.totalFeesSol !== 0.05)
        ? coin.totalFeesSol
        : (securityDetails?.totalFeesSol && securityDetails.totalFeesSol !== 0.05
          ? securityDetails.totalFeesSol
          : Math.max(0.15, Math.round((((coin.volumeK || 5) * 1000 * 0.0025 / 150) + ((coin.txs || 20) * 0.0005)) * 100) / 100));

      const merged = {
        ...coin,
        ...(securityDetails || {}),
        name: (securityDetails?.name && securityDetails.name !== 'Unknown Token') ? securityDetails.name : (coin.name || 'Unknown Token'),
        symbol: (securityDetails?.symbol && securityDetails.symbol !== '???') ? securityDetails.symbol : (coin.symbol || '???'),
        logo: securityDetails?.logo || coin.logo || '',
        price: (securityDetails?.price != null && !isNaN(securityDetails.price) && securityDetails.price > 0)
          ? securityDetails.price
          : (coin.price || 0),
        mktCapK: (securityDetails?.mktCapK != null && !isNaN(securityDetails.mktCapK) && securityDetails.mktCapK > 0)
          ? securityDetails.mktCapK
          : (coin.mktCapK || 0),
        liquidityK: (securityDetails?.liquidityK != null && !isNaN(securityDetails.liquidityK) && securityDetails.liquidityK > 0)
          ? securityDetails.liquidityK
          : (coin.liquidityK || 0),
        volumeK: (securityDetails?.volumeK != null && !isNaN(securityDetails.volumeK) && securityDetails.volumeK > 0)
          ? securityDetails.volumeK
          : (coin.volumeK || 0),
        totalFeesSol: effectiveFeesSol,
        totalSupply: securityDetails?.totalSupply || coin.totalSupply || (coin.price > 0 && coin.mktCapK > 0 ? Math.round((coin.mktCapK * 1000) / coin.price) : 1000000000),
        bCurvePercent: (coin.bCurvePercent != null) ? coin.bCurvePercent : (securityDetails?.bCurvePercent || 100),
        bondingCurveDisplay: coin.bondingCurveDisplay || (coin.bCurvePercent >= 100 ? '100% (Raydium)' : `${coin.bCurvePercent || 100}%`),
        taxes: securityDetails?.taxes || coin.taxes || '0% / 0% (0.25% LP)',
        top10Percent: securityDetails?.top10Percent ?? coin.top10Percent ?? null,
        top10Rate: securityDetails?.top10Rate ?? coin.top10Rate ?? null,
        devHoldPercent: securityDetails?.devHoldPercent ?? coin.devHoldPercent ?? null,
        devHoldRate: securityDetails?.devHoldRate ?? coin.devHoldRate ?? null,
        holdersCount: (securityDetails?.holdersCount && securityDetails.holdersCount > 0) ? securityDetails.holdersCount : (coin.holdersCount > 0 ? coin.holdersCount : null),
        snipersPercent: securityDetails?.snipersPercent ?? coin.snipersPercent ?? null,
        snipersRate: securityDetails?.snipersRate ?? coin.snipersRate ?? null,
        insidersPercent: securityDetails?.insidersPercent ?? coin.insidersPercent ?? null,
        insidersRate: securityDetails?.insidersRate ?? coin.insidersRate ?? null,
        phishingPercent: securityDetails?.phishingPercent ?? coin.phishingPercent ?? null,
        phishingRate: securityDetails?.phishingRate ?? coin.phishingRate ?? null,
        bundlerPercent: securityDetails?.bundlerPercent ?? coin.bundlerPercent ?? null,
        bundlerRate: securityDetails?.bundlerRate ?? coin.bundlerRate ?? null,
        dexPaid: isPaid,
        dexPaidAmount: isPaid ? paidAmount : 0,
        dexPaidDisplay: paidDisplay,
        watchersCount: (securityDetails?.watchersCount != null && !isNaN(securityDetails.watchersCount) && securityDetails.watchersCount >= 0)
          ? securityDetails.watchersCount
          : (coin.watchersCount != null && !isNaN(coin.watchersCount) && coin.watchersCount >= 0
            ? coin.watchersCount
            : 6),
        watchersDelta: securityDetails?.watchersDelta ?? coin.watchersDelta ?? 0,
        noMint: securityDetails?.noMint ?? coin.noMint ?? null,
        noBlacklist: securityDetails?.noBlacklist ?? coin.noBlacklist ?? null,
        burntPercent: securityDetails?.burntPercent ?? coin.burntPercent ?? null,
        burntRatio: securityDetails?.burntRatio ?? coin.burntRatio ?? null,
        rugPercent: securityDetails?.rugPercent ?? coin.rugPercent ?? null,
        rugPercentNum: securityDetails?.rugPercentNum ?? coin.rugPercentNum ?? null,
        isDevVerified: securityDetails?.isDevVerified ?? true,
        topHolders: (securityDetails?.topHolders && securityDetails.topHolders.length > 0) ? securityDetails.topHolders : (coin.topHolders || []),
        topTraders: (securityDetails?.topTraders && securityDetails.topTraders.length > 0) ? securityDetails.topTraders : (coin.topTraders || []),
        devTotalLaunches: securityDetails?.devTotalLaunches ?? coin.devTotalLaunches ?? 1,
        devAvgAthK: securityDetails?.devAvgAthK ?? coin.devAvgAthK ?? null,
        devAthToken: securityDetails?.devAthToken ?? coin.devAthToken ?? null,
        funderWallet: securityDetails?.funderWallet ?? coin.funderWallet ?? null,
        preFundAmountSol: securityDetails?.preFundAmountSol ?? coin.preFundAmountSol ?? null,
        devBalanceSol: securityDetails?.devBalanceSol ?? coin.devBalanceSol ?? null,
        poolBaseReserve: securityDetails?.poolBaseReserve ?? coin.poolBaseReserve ?? 0,
        poolQuoteSol: securityDetails?.poolQuoteSol ?? coin.poolQuoteSol ?? 0,
        poolInitialQuoteReserve: securityDetails?.poolInitialQuoteReserve ?? coin.poolInitialQuoteReserve ?? 0,
        poolExchange: securityDetails?.poolExchange ?? coin.poolExchange ?? coin.dexId ?? 'Raydium',
        totalSupply: securityDetails?.totalSupply ?? coin.totalSupply ?? 1000000000,
        buys: (securityDetails?.buys != null) ? securityDetails.buys : (coin.buys || 0),
        sells: (securityDetails?.sells != null) ? securityDetails.sells : (coin.sells || 0),
        txs: (securityDetails?.txs != null) ? securityDetails.txs : (coin.txs || ((coin.buys || 0) + (coin.sells || 0))),
        netBuyK: (securityDetails?.netBuyK != null) ? securityDetails.netBuyK : (coin.netBuyK || 0),
        timeframes: (securityDetails?.timeframes && securityDetails.timeframes.length > 0) ? securityDetails.timeframes : (coin.timeframes || []),
        isCTO: Boolean(securityDetails?.isCTO ?? coin.isCTO),
        ctoClaimDate: securityDetails?.ctoClaimDate || coin.ctoClaimDate || null,
        activeBoosts: securityDetails?.activeBoosts || coin.activeBoosts || 0,
        hasDexAd: Boolean(securityDetails?.hasDexAd || coin.hasAd),
        dexOrders: securityDetails?.dexOrders || [],
        approvedOrders: securityDetails?.approvedOrders || [],
      };

      smartMoneyScanner.enrichTokenWithSmartMoney(merged);

      res.json({ success: true, data: merged });
    } catch (err) {
      console.error(`[API /api/token/:address/details error]:`, err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── DexScreener Synergy & Discovery Endpoints ──────────────────────

  // 1. Community Takeovers (CTO)
  app.get('/api/tokens/cto', async (req, res) => {
    try {
      const coins = getLatestCoins();
      const liveCto = await gmgnService.dexscreener.fetchCommunityTakeovers();
      const ctoMap = gmgnService.dexscreener.ctoMap;

      const ctoCoins = coins.filter(c => c.isCTO || ctoMap.has(c.address));
      res.json({
        success: true,
        count: ctoCoins.length,
        data: ctoCoins,
        rawCTOs: liveCto.filter(item => item.chainId === 'solana'),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Top Boosted Tokens
  app.get('/api/tokens/boosted', async (req, res) => {
    try {
      const coins = getLatestCoins();
      const topBoosts = await gmgnService.dexscreener.fetchTopBoosts();
      const sorted = [...coins]
        .filter(c => (c.activeBoosts || 0) > 0 || gmgnService.dexscreener.boostsMap.has(c.address))
        .sort((a, b) => (b.activeBoosts || 0) - (a.activeBoosts || 0));

      res.json({
        success: true,
        count: sorted.length,
        data: sorted.length > 0 ? sorted : coins.slice(0, 10),
        rawBoosts: topBoosts.filter(b => b.chainId === 'solana'),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Trending Narrative Metas
  app.get('/api/metas/trending', async (req, res) => {
    try {
      const metas = await gmgnService.dexscreener.fetchTrendingMetas();
      res.json({ success: true, count: metas.length, data: metas });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Meta with Pairs by Slug
  app.get('/api/metas/:slug', async (req, res) => {
    try {
      const meta = await gmgnService.dexscreener.fetchMetaWithPairs(req.params.slug);
      res.json({ success: true, data: meta });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Raw DexScreener Orders Verification for a Token
  app.get('/api/token/:address/orders', async (req, res) => {
    try {
      const orders = await gmgnService.dexscreener.checkPaidOrders('solana', req.params.address);
      res.json({ success: true, data: orders || [] });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Filters ─────────────────────────────────────────────────────

  app.post('/api/filters', (req, res) => {
    const { wallet, filters, devFilters } = req.body;
    const errors = filterService.validate(filters || {});
    if (errors.length) return res.status(400).json({ success: false, errors });
    if (filters)    setFilters(wallet || null, filters);
    if (devFilters) setDevFilters(wallet || null, devFilters);
    res.json({ success: true });
  });

  app.get('/api/filters', (req, res) => {
    res.json({ success: true, data: getFilters(req.query.wallet || null) });
  });

  app.post('/api/filters/preset', async (req, res) => {
    const { wallet, name, filters, devFilters } = req.body;
    if (!name || !wallet) return res.status(400).json({ success: false, error: 'name and wallet required' });
    await savePreset(wallet, name, filters || {}, devFilters || {});
    res.json({ success: true });
  });

  app.get('/api/filters/presets', async (req, res) => {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ success: false, error: 'wallet required' });
    const presets = await getPresets(wallet);
    res.json({ success: true, data: presets });
  });

  // ── Session Wallet (Delegated Authority) ────────────────────────

  /**
   * POST /api/session/create
   * Creates a new bot session keypair for a user.
   * Body: { userWallet, botConfig }
   * Returns: { sessionPubkey } — user must fund this address with SOL.
   */
  app.post('/api/session/create', async (req, res) => {
    try {
      const { userWallet, botConfig } = req.body;
      if (!userWallet) return res.status(400).json({ success: false, error: 'userWallet required' });
      const result = await sessionService.createSession(userWallet, botConfig || {});
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/session/balance?wallet=<address>
   * Returns current SOL balance of the session wallet.
   */
  app.get('/api/session/balance', async (req, res) => {
    try {
      const balance = await sessionService.getSessionBalance(req.query.wallet);
      res.json({ success: true, data: { balanceSol: balance } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/session/withdraw
   * Withdraws all SOL from session wallet back to user's main wallet.
   * Body: { userWallet }
   */
  app.post('/api/session/withdraw', async (req, res) => {
    try {
      const result = await sessionService.withdrawAll(req.body.userWallet);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/session/deactivate
   * Stops the bot for a user (keeps session wallet, just stops auto-buy).
   */
  app.post('/api/session/deactivate', async (req, res) => {
    try {
      await sessionService.deactivate(req.body.userWallet);
      res.json({ success: true, message: 'Bot deactivated' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * PUT /api/session/config
   * Update bot config (buy amount, TP levels, etc.) without recreating the session.
   * Body: { userWallet, botConfig }
   */
  app.put('/api/session/config', async (req, res) => {
    try {
      const { userWallet, botConfig } = req.body;
      await updateBotConfig(userWallet, botConfig);
      res.json({ success: true, message: 'Bot config updated' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Trades ──────────────────────────────────────────────────────

  app.get('/api/trades', async (req, res) => {
    const { wallet } = req.query;
    if (!wallet) return res.status(400).json({ success: false, error: 'wallet required' });
    const trades = await getTrades(wallet);
    res.json({ success: true, data: trades });
  });

  // ── Smart Money & Cluster Radar ────────────────────────────────
  app.get('/api/smart-money/wallets', async (req, res) => {
    try {
      const minScore = req.query.minScore ? Number(req.query.minScore) : 0;
      const isStarred = req.query.isStarred === 'true' ? true : (req.query.isStarred === 'false' ? false : null);
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const wallets = await getSmartWallets({ minScore, isStarred, limit });
      res.json({ success: true, data: wallets, count: wallets.length });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/smart-money/scan', async (req, res) => {
    try {
      const result = await smartMoneyScanner.runScan(req.body || {});
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/smart-money/preset-7d', async (req, res) => {
    try {
      const result = await smartMoneyScanner.runPreset7D(req.body || {});
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/smart-money/star/:address', async (req, res) => {
    try {
      const updated = await toggleStarSmartWallet(req.params.address);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Wallet not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/smart-money/clusters', async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 30;
      const clusters = await getClusterEvents({ limit });
      res.json({ success: true, data: clusters });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/smart-money/export', async (req, res) => {
    try {
      const buffer = await excelExporter.generateWorkbookBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=smart_money_radar_${Date.now()}.xlsx`
      );
      res.send(Buffer.from(buffer));
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Wallets Radar: 2-Section Ranking (Smart Money & KOL Wallets) ──
  app.get('/api/wallets/radar', async (req, res) => {
    try {
      const data = await walletsRadarService.getRadarData(req.query || {});
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/wallets/radar/scan', async (req, res) => {
    try {
      const result = await walletsRadarService.scanAndAggregate(req.body || {});
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/token/:address/traders', async (req, res) => {
    try {
      const breakdown = await walletsRadarService.getTokenTradersBreakdown(req.params.address);
      res.json({ success: true, data: breakdown });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/wallets/star/:address', async (req, res) => {
    try {
      const { toggleStarSmartWallet, toggleStarKolWallet } = await import('../db/database.js');
      const updatedSmart = await toggleStarSmartWallet(req.params.address);
      const updatedKol = await toggleStarKolWallet(req.params.address);
      const updated = updatedSmart || updatedKol;
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Wallet not found' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/wallets/radar/export', async (req, res) => {
    try {
      const buffer = await excelExporter.generateRadarWorkbookBuffer();
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=wallets_radar_smart_kol_${Date.now()}.xlsx`
      );
      res.send(Buffer.from(buffer));
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ── Health ──────────────────────────────────────────────────────

  app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });
}
