import { FilterService } from '../services/filter.service.js';
import { SessionWalletService } from '../services/sessionWallet.service.js';
import { getTrades, savePreset, getPresets, updateBotConfig } from '../db/database.js';

const filterService  = new FilterService();
const sessionService = new SessionWalletService();

export function setupRoutes(app, { getLatestCoins, setFilters, setDevFilters, getFilters, trader }) {

  // ── Coins ───────────────────────────────────────────────────────

  app.get('/api/coins/ranked', (req, res) => {
    res.json({ success: true, data: getLatestCoins() });
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
