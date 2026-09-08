import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { initializeDB, getAllActiveSessions } from './db/database.js';
import { setupRoutes } from './api/routes.js';
import { GMGNService } from './services/gmgn.service.js';
import { FilterService } from './services/filter.service.js';
import { DevWalletService } from './services/devWallet.service.js';
import { RankingService } from './services/ranking.service.js';
import { TradingService } from './services/trading.service.js';

const PORT             = process.env.PORT || 3001;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '10000');

// ── Services ────────────────────────────────────────────────────────
const gmgn     = new GMGNService();
const filter   = new FilterService();
const devWallet= new DevWalletService();
const ranker   = new RankingService();
const trader   = new TradingService();

// ── Shared state ────────────────────────────────────────────────────
let latestRankedCoins = [];
// Per-user filters stored in memory (keyed by wallet address)
// For a logged-out state, we use a global default filter
const userFilters = {};   // { [wallet]: { filters, devFilters, botConfig } }
let globalFilters  = {};
let globalDevFilters = { minDevBalanceSol: 0, maxRugPercent: 100 };

// ── Express App ─────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

// ── Init DB ─────────────────────────────────────────────────────────
await initializeDB();

// ── Routes ──────────────────────────────────────────────────────────
setupRoutes(app, {
  getLatestCoins:   () => latestRankedCoins,
  setFilters:       (wallet, f)  => { if (wallet) userFilters[wallet] = { ...userFilters[wallet], filters: f }; else globalFilters = f; },
  setDevFilters:    (wallet, df) => { if (wallet) userFilters[wallet] = { ...userFilters[wallet], devFilters: df }; else globalDevFilters = df; },
  getFilters:       (wallet)     => wallet
    ? { filters: userFilters[wallet]?.filters || globalFilters, devFilters: userFilters[wallet]?.devFilters || globalDevFilters }
    : { filters: globalFilters, devFilters: globalDevFilters },
  trader,
});

// ── HTTP + WebSocket ─────────────────────────────────────────────────
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Track connected clients with their wallet
const clients = new Map(); // ws → { wallet }

const broadcast = (data) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
};

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  ws.send(JSON.stringify({ type: 'ranked_coins', data: latestRankedCoins }));
  clients.set(ws, {});

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'identify')     clients.set(ws, { wallet: msg.wallet });
      if (msg.type === 'set_filters')  {
        const meta = clients.get(ws) || {};
        if (meta.wallet) userFilters[meta.wallet] = { filters: msg.filters, devFilters: msg.devFilters };
        else { globalFilters = msg.filters; globalDevFilters = msg.devFilters; }
      }
    } catch { /* ignore */ }
  });

  ws.on('close', () => { clients.delete(ws); console.log('[WS] Client disconnected'); });
});

// ── Main polling + auto-buy loop ─────────────────────────────────────
async function pollAndAct() {
  try {
    // 1. Fetch new Solana tokens
    const rawCoins = await gmgn.fetchNewTokens();
    if (!rawCoins.length) return;

    // 2. Apply global filters
    const filtered = filter.apply(rawCoins, globalFilters);

    // 3. Dev wallet enrichment
    const enriched = await devWallet.enrichBatch(filtered);

    // 4. Dev safety filter
    const minBal = globalDevFilters.minDevBalanceSol !== '' && globalDevFilters.minDevBalanceSol !== undefined
      ? parseFloat(globalDevFilters.minDevBalanceSol)
      : 0;
    const maxRug = globalDevFilters.maxRugPercent !== '' && globalDevFilters.maxRugPercent !== undefined
      ? parseFloat(globalDevFilters.maxRugPercent)
      : 100;

    const devSafe = enriched.filter(c =>
      (c.devBalanceSol ?? 0) >= minBal &&
      (c.devRugPercent ?? 0) <= maxRug
    );

    // 5. Rank
    latestRankedCoins = ranker.rank(devSafe);

    // 6. Broadcast updated list
    broadcast({ type: 'ranked_coins', data: latestRankedCoins });

    // 7. AUTO-BUY for every active session
    const sessions = await getAllActiveSessions();
    for (const session of sessions) {
      const config = session.bot_config || {};
      if (!config.autoBuy || !config.buyAmountSol) continue;

      // Get top N coins (within max positions)
      const maxPositions = config.maxPositions || 5;
      const topCoins = latestRankedCoins.slice(0, maxPositions);

      for (const coin of topCoins) {
        trader.autoBuy({
          userWallet:   session.user_wallet,
          tokenAddress: coin.address,
          coinName:     coin.name,
          coinSymbol:   coin.symbol,
          amountSol:    config.buyAmountSol,
          slippageBps:  config.slippageBps || 500,
        }).then(result => {
          broadcast({ type: 'auto_buy', wallet: session.user_wallet, coin: coin.symbol, txSignature: result.txSignature });
        }).catch(err => {
          if (!err.message.startsWith('SKIP')) {
            console.error(`[AUTO-BUY] ${coin.symbol}:`, err.message);
          }
        });
      }
    }

    console.log(`[POLL] ${rawCoins.length} raw → ${filtered.length} filtered → ${devSafe.length} dev-safe → ${latestRankedCoins.length} ranked`);
  } catch (err) {
    console.error('[POLL] Error:', err.message);
  }
}

setInterval(pollAndAct, POLL_INTERVAL_MS);
pollAndAct();

httpServer.listen(PORT, () => {
  console.log(`\n🚀 GMGN Bot Backend  http://localhost:${PORT}`);
  console.log(`📡 WebSocket         ws://localhost:${PORT}`);
  console.log(`🤖 Auto-buy polling  every ${POLL_INTERVAL_MS / 1000}s\n`);
});
