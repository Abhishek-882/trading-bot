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
import { solscanService } from './services/solscan.service.js';
import { websiteVerifier } from './services/websiteVerifier.service.js';

import path from 'path';
import fs from 'fs';

const PORT             = process.env.PORT || 3001;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000');

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
let globalDevFilters = { minDevTotalUsd: 0, maxRugPercent: 100 };

// ── Express App ─────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve frontend static assets if present (single-container deployment)
const publicDir = path.join(process.cwd(), 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ── Init DB ─────────────────────────────────────────────────────────
await initializeDB();


// ── Routes ──────────────────────────────────────────────────────────
setupRoutes(app, {
  getLatestCoins:   () => latestRankedCoins,
  setFilters:       (wallet, f)  => {
    if (wallet) userFilters[wallet] = { ...userFilters[wallet], filters: f };
    else globalFilters = f;
    pollAndAct().catch(err => console.error('[FILTER UPDATE] Error:', err.message));
  },
  setDevFilters:    (wallet, df) => {
    if (wallet) userFilters[wallet] = { ...userFilters[wallet], devFilters: df };
    else globalDevFilters = df;
    pollAndAct().catch(err => console.error('[DEV FILTER UPDATE] Error:', err.message));
  },
  getFilters:       (wallet)     => wallet
    ? { filters: userFilters[wallet]?.filters || globalFilters, devFilters: userFilters[wallet]?.devFilters || globalDevFilters }
    : { filters: globalFilters, devFilters: globalDevFilters },
  trader,
});

// Single-page application route fallback
if (fs.existsSync(publicDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

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
        pollAndAct().catch(err => console.error('[WS FILTER UPDATE] Error:', err.message));
      }
    } catch { /* ignore */ }
  });

  ws.on('close', () => { clients.delete(ws); console.log('[WS] Client disconnected'); });
});

// ── Main polling + auto-buy loop ─────────────────────────────────────
async function pollAndAct() {
  try {
    // 1. Fetch new Solana tokens (DexScreener live trending + GMGN launchpad trenches)
    const rawCoins = await gmgn.fetchNewTokens();
    if (!rawCoins.length) return;

    // 1.5 Real-Time Live Price Synchronization (DexScreener batch endpoint)
    // Synchronize price, market cap, liquidity, volume, and txs to the exact current second
    const liveFreshCoins = await gmgn.refreshLivePrices(rawCoins);

    // 2. Dev wallet enrichment
    const enriched = await devWallet.enrichBatch(liveFreshCoins);

    // 2.5 Deep Solscan Inflow Audit & Website Verification (Final Gatekeeper on candidate tokens)
    const candidates = enriched.slice(0, 40);
    await Promise.all(candidates.map(async (coin) => {
      try {
        const [audit, web] = await Promise.all([
          solscanService.auditDevFunding(coin.devAddress, coin.address),
          websiteVerifier.verifyCoinWebsite(coin),
        ]);
        coin.isPreFunded = audit.isPreFunded;
        coin.preFundAmountSol = audit.preFundAmountSol;
        coin.funderWallet = audit.funderWallet;
        coin.preFundDetails = audit.details;
        coin.hasGenuineWebsite = web.hasGenuineWebsite;
        coin.websiteUrl = web.websiteUrl;
        coin.websiteDomain = web.domain;
        coin.domainTier = web.domainTier || 'none';
      } catch {
        coin.isPreFunded = coin.isPreFunded ?? false;
        coin.hasGenuineWebsite = coin.hasGenuineWebsite ?? false;
        coin.domainTier = coin.domainTier || 'none';
      }
    }));

    // 3. Two-Tier Rank: Section 1 (Low Risk by Dev Net Money) & Section 2 (High Profit by Net Profit)
    latestRankedCoins = ranker.rank(enriched);


    // 4. Broadcast full ranked market to all connected UI clients
    broadcast({ type: 'ranked_coins', data: latestRankedCoins });

    // 5. AUTO-BUY for every active session using session-specific filters
    const sessions = await getAllActiveSessions();
    for (const session of sessions) {
      const config = session.bot_config || {};
      if (!config.autoBuy || !config.buyAmountSol) continue;

      const userF = userFilters[session.user_wallet]?.filters || globalFilters;
      const userDF = userFilters[session.user_wallet]?.devFilters || globalDevFilters;
      const candidateCoins = filter.apply(latestRankedCoins, userF);
      const minDevUsd = parseFloat(userDF.minDevTotalUsd || '0');
      const maxRug = parseFloat(userDF.maxRugPercent || '100');
      const sessionSafeCoins = candidateCoins.filter(c =>
        (c.devTotalValueUsd ?? 0) >= minDevUsd && (c.devRugPercent ?? 0) <= maxRug
      );

      // Get top N coins (within max positions)
      const maxPositions = config.maxPositions || 5;
      const topCoins = sessionSafeCoins.slice(0, maxPositions);

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

    console.log(`[POLL] ${rawCoins.length} raw → ${enriched.length} enriched → ${latestRankedCoins.length} ranked`);
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
