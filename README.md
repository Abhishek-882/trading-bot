# GMGN Solana Automated Trading Bot Platform

A full-stack, cloud-ready automated trading platform integrating the **GMGN API** and **Jupiter DEX Aggregator** on Solana. Features real-time token discovery, multi-metric filtering (11 parameters matching GMGN trenches), dev wallet rug & safety scoring, automated delegated-session auto-buying, and partial take-profit executions.

---

## Features

- ⚡ **Real-Time Token Discovery:** Polls GMGN API (`/defi/quotation/v1/tokens/new_pairs/sol`) every 10s and streams live updates via WebSocket.
- 🎯 **11-Field Filter Engine:**
  - Bonding Curve (`B. Curve` %)
  - Token Age (`Age` min)
  - Liquidity (`Liquidity` K)
  - Market Cap (`MKT Cap` K)
  - Volume (`Volume` K)
  - Net Buy Volume (`Net Buy` K)
  - Total Transactions (`TXs`)
  - Buys & Sells count
  - Total Fees (`SOL`)
  - Pump Live Age (`min`)
- 🛡️ **Dev Safety & Rug Score Engine:**
  - Extracts token creator / dev wallet address
  - Inspects on-chain dev SOL balance via Solana RPC
  - Evaluates dev launch history & computes historical rug percentage
  - Filters out high-risk devs before ranking
- 🏆 **Weighted Ranking Engine:**
  - Ranks tokens on a 0–100 scale based on liquidity, net buy pressure, volume, bonding curve progress, and dev safety.
- 🤖 **Autonomous Bot Auto-Buying (Delegated Session Authority):**
  - Generates a dedicated session keypair per user (encrypted with AES-256-CBC).
  - Trades are executed autonomously without recurring wallet popups.
  - Users can top up with SOL and withdraw 100% of remaining funds anytime back to their main Phantom wallet.
- 🔒 **Permanent Anti-Duplicate Lock:**
  - Every buy is recorded in PostgreSQL / SQLite; guarantees the bot will never buy the same token twice.
- 📈 **Parts of Close (Take-Profit Ladder):**
  - Configurable multi-stage partial closes (e.g., close 50% at +100%, 30% at +200%, 20% at +500%).
  - Configurable Stop Loss threshold.

---

## Directory Structure

```
gmgn-trading-bot/
├── backend/
│   ├── .env                      # API keys, RPC URLs & secrets
│   ├── Dockerfile                # Production container deployment
│   ├── package.json
│   └── src/
│       ├── index.js              # Express server + WebSocket + Auto-buy loop
│       ├── api/
│       │   └── routes.js         # REST endpoints
│       ├── db/
│       │   └── database.js       # PostgreSQL pool, tables & queries
│       └── services/
│           ├── gmgn.service.js       # GMGN API client & normalization
│           ├── filter.service.js     # 11-field min/max filter engine
│           ├── devWallet.service.js  # Dev balance & rug history checker
│           ├── ranking.service.js    # Scoring & ranking algorithm
│           ├── trading.service.js    # Jupiter swap quotes & transactions
│           └── sessionWallet.service.js # AES-encrypted session keypairs
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── App.jsx               # Main UI layout & state orchestration
        ├── main.jsx              # Solana wallet adapter provider setup
        ├── index.css             # Tailwind dark-mode styles
        ├── stores/
        │   └── botStore.js       # Zustand persistent store
        ├── hooks/
        │   ├── useBot.js         # WS event listener & actions
        │   └── useWallet.js      # Solana wallet connection & balance
        └── components/
            ├── FilterPanel/      # 11-field filter UI matching GMGN
            ├── RankingsTab/      # Current suggestions table/cards
            ├── BotControls/      # Bot config, session wallet & TP ladder
            ├── TradesTab/        # Executed trades & transaction links
            ├── WalletConnector/  # Phantom wallet connector
            ├── CoinCard/         # Individual token metric card
            └── Notifications/    # Live toast notifications
```

---

## Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend
npm install
```

Ensure your `.env` file contains your credentials:

```ini
GMGN_API_KEY=gmgn_247cf925e27ea6215995245b47f3d534
DATABASE_URL=postgresql://user:password@localhost:5432/gmgn_bot
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PORT=3001
FRONTEND_URL=http://localhost:5173
POLL_INTERVAL_MS=10000
SESSION_ENCRYPTION_SECRET=your_32_character_random_encryption_key
```

Run the backend:
```bash
npm run dev
```

### 2. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Cloud Deployment Guide

### Deploy Backend to Railway

1. Push your repository to GitHub.
2. Log in to [Railway](https://railway.app) and create a **New Project** from your GitHub repo.
3. Set the **Root Directory** to `backend`.
4. In Railway, click **Add a Service** -> **Database** -> **PostgreSQL**. Railway will automatically populate the `DATABASE_URL` environment variable.
5. In your Railway service settings, add the environment variables:
   - `GMGN_API_KEY`: Your GMGN API Key.
   - `SOLANA_RPC_URL`: Dedicated Solana RPC (e.g. Helius, QuickNode, Triton).
   - `SESSION_ENCRYPTION_SECRET`: A secure 32+ character random string.
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g. `https://your-bot.vercel.app`).
   - `NODE_ENV`: `production`

### Deploy Frontend to Vercel

1. Log in to [Vercel](https://vercel.com) and import the repository.
2. Set the **Root Directory** to `frontend`.
3. Set the Framework Preset to **Vite**.
4. Add the Environment Variable:
   - `VITE_API_URL`: Your deployed Railway backend URL (e.g. `https://backend-production.up.railway.app`).
5. Click **Deploy**.

---

## Operational Guide

1. **Connect Wallet:** Click "Connect Wallet" at top right and select **Phantom**.
2. **Configure Filters:**
   - Adjust the 11 filter parameters (Liquidity, Market Cap, Age, Net Buy, B. Curve, etc.) to your strategy.
   - Set Dev Safety (e.g., minimum 0.5 SOL dev balance, maximum 15% dev rug history).
   - Click **Apply**.
3. **Inspect Current Suggestions:** The "Current Suggestions" tab updates live every 10 seconds with tokens that pass all filters.
4. **Activate Autonomous Bot:**
   - Switch to the **Bot Controls** tab.
   - Click **Create Session Wallet**.
   - Copy the generated session deposit address.
   - Send the desired trading capital (e.g. 0.5 SOL) from your Phantom wallet to this address.
   - Configure your buy amount per coin (e.g. 0.1 SOL), max concurrent positions, and take-profit target levels.
   - Toggle **Auto-Buy Enabled** and click **Save Bot Settings**.
5. **Withdraw Anytime:** You can withdraw 100% of your remaining session wallet SOL back to your main wallet with a single click.
