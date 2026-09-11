import { FilterService } from '../services/filter.service.js';
import { SessionWalletService } from '../services/sessionWallet.service.js';
import { GMGNService } from '../services/gmgn.service.js';
import { getTrades, savePreset, getPresets, updateBotConfig } from '../db/database.js';

const filterService  = new FilterService();
const sessionService = new SessionWalletService();

export function setupRoutes(app, { getLatestCoins, setFilters, setDevFilters, getFilters, trader, gmgn }) {
  const gmgnService = gmgn || new GMGNService();

  // ── Coins ───────────────────────────────────────────────────────

  app.get('/api/coins/ranked', (req, res) => {
    res.json({ success: true, data: getLatestCoins() });
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
      const isPaid = Boolean(securityDetails?.dexPaid || coin.dexPaid);
      const paidAmount = securityDetails?.dexPaidAmount || (isPaid ? 548 : 0);
      const paidDisplay = isPaid ? (securityDetails?.dexPaidDisplay && securityDetails.dexPaidDisplay !== 'Unpaid' ? securityDetails.dexPaidDisplay : `$${paidAmount}`) : 'Unpaid';

      // Merge market data with live GMGN security metrics, never letting undefined wipe out valid coin figures
      const merged = {
        ...coin,
        ...(securityDetails || {}),
        name: (securityDetails?.name && securityDetails.name !== 'Unknown Token') ? securityDetails.name : (coin.name || 'Unknown Token'),
        symbol: (securityDetails?.symbol && securityDetails.symbol !== '???') ? securityDetails.symbol : (coin.symbol || '???'),
        logo: securityDetails?.logo || coin.logo || '',
        price: (securityDetails?.price != null && !isNaN(securityDetails.price) && securityDetails.price > 0) ? securityDetails.price : (coin.price || 0),
        mktCapK: (securityDetails?.mktCapK != null && !isNaN(securityDetails.mktCapK) && securityDetails.mktCapK > 0) ? securityDetails.mktCapK : (coin.mktCapK || 0),
        liquidityK: (securityDetails?.liquidityK != null && !isNaN(securityDetails.liquidityK) && securityDetails.liquidityK > 0) ? securityDetails.liquidityK : (coin.liquidityK || 0),
        volumeK: (securityDetails?.volumeK != null && !isNaN(securityDetails.volumeK) && securityDetails.volumeK > 0) ? securityDetails.volumeK : (coin.volumeK || 0),
        top10Percent: (securityDetails?.top10Percent && securityDetails.top10Percent !== '0%') ? securityDetails.top10Percent : (coin.top10Percent || '0%'),
        top10Rate: securityDetails?.top10Rate ?? coin.top10Rate ?? 0,
        devHoldPercent: (securityDetails?.devHoldPercent && !securityDetails?.fromFallback) ? securityDetails.devHoldPercent : (coin.devHoldPercent || securityDetails?.devHoldPercent || '0%'),
        devHoldRate: (securityDetails?.devHoldRate != null && !securityDetails?.fromFallback) ? securityDetails.devHoldRate : (coin.devHoldRate || 0),
        holdersCount: (securityDetails?.holdersCount && securityDetails.holdersCount > 0) ? securityDetails.holdersCount : (coin.holdersCount || 0),
        snipersPercent: (securityDetails?.snipersPercent && securityDetails.snipersPercent !== '0%') ? securityDetails.snipersPercent : (coin.snipersPercent || '0%'),
        snipersRate: securityDetails?.snipersRate ?? coin.snipersRate ?? 0,
        insidersPercent: securityDetails?.insidersPercent ?? '0%',
        insidersRate: securityDetails?.insidersRate ?? 0,
        phishingPercent: securityDetails?.phishingPercent ?? '0%',
        phishingRate: securityDetails?.phishingRate ?? 0,
        bundlerPercent: securityDetails?.bundlerPercent ?? '0%',
        bundlerRate: securityDetails?.bundlerRate ?? 0,
        dexPaid: isPaid,
        dexPaidAmount: paidAmount,
        dexPaidDisplay: paidDisplay,
        noMint: securityDetails?.noMint ?? true,
        noBlacklist: securityDetails?.noBlacklist ?? true,
        burntPercent: securityDetails?.burntPercent ?? '100%',
        burntRatio: securityDetails?.burntRatio ?? 1,
        rugPercent: securityDetails?.rugPercent ?? `${coin.devRugPercent ?? 0}%`,
        rugPercentNum: securityDetails?.rugPercentNum ?? (coin.devRugPercent ?? 0),
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
      };

      res.json({ success: true, data: merged });
    } catch (err) {
      console.error(`[API /api/token/:address/details error]:`, err);
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

  // ── Health ──────────────────────────────────────────────────────

  app.get('/api/health', (req, res) => {
    res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
  });
}
