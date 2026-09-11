# GMGN Solana Automated Trading Bot & 3D WebGL Experience Platform

A next-generation, institutional-grade automated trading terminal for Solana meme coins. Combines real-time multi-source market intelligence (**DexScreener API** + **GMGN API** + **Pump.fun**), a strict **Two-Tier Risk Ranking Engine**, **Jupiter v6 DEX Aggregator** auto-swaps via AES-encrypted delegated session wallets, and a world-class **5-Phase Motion & 3D WebGL Experience** inspired by *Getty Museum's Persepolis Reimagined* and *ALCHE Studio*.

---

## Architecture Overview

```
                                 ┌──────────────────────────────────────────────────────────┐
                                 │                   MARKET INGESTION                       │
                                 │  DexScreener Boosts/Profiles/Pairs  +  GMGN  +  Pump.fun  │
                                 └────────────────────────────┬─────────────────────────────┘
                                                              │ (Every 30s Polling Loop)
                                                              ▼
                                 ┌──────────────────────────────────────────────────────────┐
                                 │             DEV WALLET & ON-CHAIN ENRICHMENT             │
                                 │  Dev SOL Balance  ·  Creator Address  ·  Rug History %   │
                                 └────────────────────────────┬─────────────────────────────┘
                                                              │
                                                              ▼
                                 ┌──────────────────────────────────────────────────────────┐
                                 │               TWO-TIER RISK RANKING ENGINE               │
                                 │  Section 1: Low Risk (<20% Rug)  ──▶ Ranked by Net Money │
                                 │  Section 2: High Profit (≥20% ) ──▶ Ranked by Net Profit │
                                 └──────────────┬────────────────────────────┬──────────────┘
                                                │                            │
                                                ▼ (REST / WebSocket)         ▼ (Auto-Buy Evaluation)
 ┌─────────────────────────────────────────────────────────────────┐   ┌──────────────────────────────┐
 │                     FRONTEND 3D WEBGL CLIENT                    │   │    AUTONOMOUS BOT ENGINE     │
 │  • Phase 1: Hardware Interrupts & Passive Input Capture         │   │  • AES-256 Session Keypairs  │
 │  • Phase 2: Kinetic Velocity & Delta-Time LERP Physics          │   │  • Jupiter v6 Swap Execution │
 │  • Phase 3: Single rAF Heartbeat & Coordinate Caching           │   │  • Permanent Anti-Dupe Lock  │
 │  • Phase 4: CSSOM Variable Invalidation & Subtree Containment   │   │  • Take-Profit Ladder & SL   │
 │  • Phase 5: GPU Compositor Promotion & Hardware V-Sync Lock     │   │  • 1-Click Capital Withdraw  │
 │  ─────────────────────────────────────────────────────────────  │   └──────────────────────────────┘
 │  • Sacred Geometry Prismatic Core (ALCHE Studio Merkaba)        │
 │  • Cyber-Editorial Telemetry Gimbal HUD (Compass, Pitch, Yaw)   │
 │  • 360° Museum Artifact Turntable (Getty Persepolis Studio)     │
 │  • Kinetic Breakout Gems Reel (Momentum Carousel)               │
 │  • Native Web Audio Procedural Synthesizer (Zero Assets)        │
 └─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Multi-Source Real-Time Market Intelligence
- **DexScreener Live Ingestion**: Integrates `/token-boosts/top/v1`, `/token-boosts/latest/v1`, `/token-profiles/latest/v1`, `/tokens/v1/solana/{addresses}`, and `/latest/dex/search?q=sol` to overcome GMGN rate limits and stream 1,400+ active Solana tokens.
- **Pump.fun Creator Resolution**: Resolves creator wallets directly from `frontend-api-v2.pump.fun` to extract accurate dev balances and prior launch track records.
- **WebSocket Streaming**: Broadcasts full market snapshots to all connected UI clients every 30 seconds (`ws://localhost:3001`).

### 2. Strict Two-Tier Risk Ranking Engine
Solves the fundamental dilemma of meme coin trading by separating tokens into two distinct categories:
- **Section 1: Low Risk (< 20% Rug Risk)**
  - Ranked strictly by **Dev Net Money / Net Worth** (`devTotalValueUsd` = dev SOL holdings × price + on-chain portfolio).
  - Surfaces tokens launched by wealthy, reputable creators with skin in the game.
- **Section 2: High Profit (≥ 20% Rug Risk)**
  - Ranked strictly by **Net Profit / Net Buy Pressure** (`netBuyK` = 24h buy volume − sell volume).
  - Surfaces fast-moving degen breakouts with intense buying volume and momentum.
- Dedicated UI section toggles (`All`, `🛡️ Low Risk (<20%)`, `⚡ High Profit (≥20%)`) with real-time counts.

### 3. 11-Field GMGN Filter Matrix
Supports real-time instant client-side filtering and server-side evaluation:
1. **Bonding Curve Progress** (`min` / `max` %)
2. **Token Age** (`min` / `max` minutes)
3. **Liquidity** (`min` / `max` $K)
4. **Market Cap** (`min` / `max` $K)
5. **24h Volume** (`min` / `max` $K)
6. **Net Buy Volume** (`min` / `max` $K)
7. **Total Transactions** (`min` / `max` TXs)
8. **Buys Count** (`min` / `max`)
9. **Sells Count** (`min` / `max`)
10. **Total Gas Fees** (`min` / `max` SOL)
11. **Pump Live Age** (`min` / `max` minutes)
- **Dev Safety Filters**: Minimum Dev Net Worth ($) & Maximum Historical Rug Percentage (%).
- **Preset Management**: 1-click preset saving and loading linked to the user's wallet.

### 4. 5-Phase Performance Engineering & Motion Architecture
Built from ground-up high-performance engineering blueprints:
- **Phase 1: Event Interception & Input Capture**: Hardware interrupt loop using `{ passive: true }` listeners for pointer, touch, and wheel inputs. Normalizes pointer coordinates to $[-1.0, 1.0]$.
- **Phase 2: Mathematical Normalization & Physics**: Cross-OS delta normalization matrix (balancing Windows notch ticks and macOS smooth wheel deltas), kinetic velocity profiling, and frame-rate independent delta-time LERP (`x += (target - x) * (1 - exp(-speed * dt))`).
- **Phase 3: Pipeline Scheduling & Orchestration**: Single unified `requestAnimationFrame` loop coordinating timeline floats ($0.000$ to $1.000$) and viewport coordinate verification caching.
- **Phase 4: CSSOM Mutation & Sub-tree Isolation**: Overwrites root CSS variables (`--pointer-x`, `--pointer-y`, `--pitch-deg`, `--yaw-deg`) and enforces CSS containment (`contain: layout paint style`) on cards to eliminate browser layout reflows.
- **Phase 5: GPU Layer Promotion & V-Sync Lock**: Elevates dynamic nodes into isolated GPU compositor planes (`transform: translate3d(0, 0, 0); will-change: transform`) locked to the display refresh rate (60/120/144 Hz). Includes an Eco Mode throttle for low-power devices.

### 5. ALCHE Studio Sacred Geometry Prismatic Core
- High-performance Three.js background canvas rendering a **Star Tetrahedron (Merkaba)** emblem.
- Dual interpenetrating tetrahedra rendered in Solana Cyan (`#00d4aa`) and Solana Purple (`#9945ff`) physical materials with chromatic transmission and metallic specular highlights.
- Concentric rotating compass rings and hairline coordinate crosshairs.
- Mouse inertia spring physics creating an organic, responsive depth tilt.

### 6. Cyber-Editorial Telemetry Gimbal HUD
- Fixed top-right cybernetic cockpit HUD.
- Rotating SVG compass reticle displaying continuous pitch and yaw degrees.
- Real-time measured rendering FPS gauge and simulated network TPS.
- Solana Mainnet synchronization indicator.
- Audio toggle (🔊/🔇) and Low-Power ECO mode toggle.
- Collapsible panel with smooth state transitions.

### 7. Getty Persepolis 3D Museum Artifact Studio Turntable
- Clicking any token card or carousel gem launches a dedicated 3D inspection studio modal.
- **Metallic Medallion**: Ribbed cylinder coin with gold beveled rim (`#f5c542`) and embossed token symbol generated via dynamic HTML5 canvas textures.
- **Three-Point Museum Lighting**:
  - Warm Key Light (3200K, 3.2 intensity)
  - Cool Fill Light (6500K, 1.2 intensity)
  - Cyan Specular Rim Light (10000K, 3.8 intensity)
- **Kinematic Turntable Control**: 360° interactive mouse/touch drag rotation with inertial friction decay (`0.94`) and automatic idle spin resumption.
- **Curatorial Editorial Plaque**: On-chain developer dossier (Net Worth, Creator Address, SOL holdings, Rug Risk %, Total Launches), bonding curve progress bar, external links (DexScreener, GMGN, Solscan), and a **Quick Buy 0.1 SOL** CTA.

### 8. Kinetic Breakout Gems Carousel Reel
- Horizontal drag-and-swipe track positioned at the top of the interface.
- Filters and displays top breakout meme coins (Score $\ge 70$, high net buy, or high volume).
- Translates vertical scroll deltas into horizontal carousel momentum.
- Click any gem to trigger holographic audio and immediately launch the 3D museum turntable.

### 9. Native Web Audio Procedural Synthesizer
- Zero external MP3/WAV file dependencies; 100% native Web Audio API oscillators and gain envelopes.
- `playClick(freq, duration)`: Tactile micro-click for buttons, tabs, and filter adjustments.
- `playHoloPing()` / `playChime()`: Triple-harmonic triangle chime (880Hz, 1320Hz, 1760Hz) on Quick Buy and gem discovery.
- `playTurntableHum()`: Resonant 140Hz sine wave acoustic hum on opening the 3D inspection modal.
- Global mute toggle with persistent storage in `localStorage`.

### 10. Autonomous Delegated Session Wallet
- Solves the UX hurdle of repeated Phantom wallet popup approvals for high-frequency trading.
- Generates a dedicated ephemeral session keypair encrypted with AES-256-CBC.
- User deposits trading capital (e.g., 0.5 SOL) to the session public key.
- Bot autonomously executes Jupiter v6 swaps when filtered tokens match strategy rules.
- **Permanent Anti-Duplicate Lock**: Every token buy is recorded in the database; the bot will never buy the same token twice.
- **Parts of Close (Take-Profit Ladder)**: Configurable multi-stage partial closes (e.g., sell 50% at +100%, 30% at +200%, 20% at +500%) plus Stop Loss.
- **1-Click Capital Withdrawal**: User can withdraw 100% of remaining session SOL back to their main wallet at any time.

### 11. Dual Database Architecture
- **Production Mode**: PostgreSQL connection pool via `DATABASE_URL`.
- **Local Fallback Mode**: If no PostgreSQL URL is configured, automatically initializes a persistent local JSON store (`backend/data/local_db.json`). Zero database installation required for local development.

---

## Project Structure

```
gmgn-trading-bot/
├── backend/
│   ├── .env                           # Environment variables (RPC, secrets, ports)
│   ├── Dockerfile                     # Container deployment image
│   ├── package.json                   # Backend dependencies & scripts
│   ├── data/
│   │   └── local_db.json              # Local fallback JSON database
│   └── src/
│       ├── index.js                   # Main server: Express + WebSocket + 30s Polling Loop
│       ├── api/
│       │   └── routes.js              # REST endpoints (Coins, Filters, Sessions, Trades)
│       ├── db/
│       │   ├── database.js            # Dual DB adapter (PostgreSQL & local JSON store)
│       │   └── migrate.js             # PostgreSQL schema migrations
│       └── services/
│           ├── dexscreener.service.js # DexScreener public API ingestion & multi-token batching
│           ├── gmgn.service.js        # GMGN API client & normalization
│           ├── filter.service.js      # 11-field metric filter & validation engine
│           ├── devWallet.service.js   # Dev balance check & pump.fun rug risk calculation
│           ├── ranking.service.js     # Two-Tier Ranking (Low Risk Net Money & High Profit Net Profit)
│           ├── trading.service.js     # Jupiter v6 swap quoting, building, & execution
│           └── sessionWallet.service.js # AES-256 encrypted session keypair manager
├── frontend/
│   ├── index.html                     # HTML5 entry point
│   ├── vite.config.js                 # Vite config with alias resolutions
│   ├── tailwind.config.js             # Theme tokens & custom color palette
│   ├── package.json                   # Frontend dependencies (React 18, Three.js, Solana adapters)
│   └── src/
│       ├── App.jsx                    # Root UI orchestration, modals & motion pipeline init
│       ├── main.jsx                   # React root & Solana Wallet Provider mounting
│       ├── index.css                  # Custom styling, glow effects, scrollbar resets
│       ├── api/
│       │   └── client.js              # Fetch client for REST endpoints
│       ├── stores/
│       │   └── botStore.js            # Zustand store for state management
│       ├── hooks/
│       │   ├── useBot.js              # WebSocket listener, auto-reconnect & state sync
│       │   └── useWallet.js           # Solana wallet balance & connection helpers
│       ├── engine/
│       │   ├── motionPipeline.js      # 5-Phase hardware interrupt, LERP, & CSSOM engine
│       │   └── soundFX.js             # Procedural Web Audio API sound synthesizer
│       ├── stubs/
│       │   └── solana-kit.js          # ESM encoding stub for Solana Mobile SDK
│       └── components/
│           ├── 3D/
│           │   └── ThreeCore.jsx      # ALCHE Studio Sacred Geometry Prismatic WebGL canvas
│           ├── HUD/
│           │   └── TelemetryHUD.jsx   # Cyber-Editorial Gimbal Telemetry HUD
│           ├── BreakoutGems/
│           │   └── BreakoutGemsReel.jsx # Kinetic horizontal breakout gems carousel
│           ├── TokenInspection/
│           │   └── TokenInspectionModal.jsx # Getty Persepolis 360° 3D Museum Turntable Studio
│           ├── FilterPanel/
│           │   └── FilterPanel.jsx    # 11-metric filter controls & preset management
│           ├── RankingsTab/
│           │   └── RankingsTab.jsx    # Dual-tier token rankings with instant filtering
│           ├── CoinCard/
│           │   └── CoinCard.jsx       # Token card with GPU layer promotion & inspection trigger
│           ├── BotControls/
│           │   └── BotControls.jsx    # Autonomous bot settings, session wallet, & TP ladder
│           ├── TradesTab/
│           │   └── TradesTab.jsx      # Live trade history & Solscan transaction links
│           ├── WalletConnector/
│           │   └── WalletConnector.jsx # Phantom wallet connector & SOL balance
│           └── Notifications/
│               └── Notifications.jsx  # Toast notification stack
├── research/                          # Architectural reference blueprints & videos
├── render.yaml                        # Render.com multi-service deployment blueprint
└── README.md                          # Comprehensive project documentation
```

---

## Installation & Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Phantom Wallet** (browser extension) for Solana wallet connectivity

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-repo/gmgn-trading-bot.git
cd gmgn-trading-bot
```

---

### Step 2: Backend Setup & Launch

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Configure your environment variables. Create a `.env` file in `backend/`:
   ```ini
   # Server Configuration
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   POLL_INTERVAL_MS=30000

   # Solana RPC
   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

   # Session Encryption (Required: 32-character secret)
   SESSION_ENCRYPTION_SECRET=12345678901234567890123456789012

   # Database (Optional - defaults to local JSON storage if omitted)
   # DATABASE_URL=postgresql://postgres:password@localhost:5432/gmgn_bot

   # GMGN API Key (Optional fallback)
   # GMGN_API_KEY=your_gmgn_api_key
   ```

3. Launch the backend server:
   ```bash
   npm run dev
   ```
   *The backend will automatically start Express, WebSocket on port 3001, and begin polling DexScreener & GMGN every 30 seconds.*

---

### Step 3: Frontend Setup & Launch

1. Open a new terminal, navigate to the frontend directory, and install dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

## API Reference

### REST Endpoints (`http://localhost:3001`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/coins/ranked` | Returns the current list of ranked tokens across both sections. |
| `GET` | `/api/filters` | Gets active filters for a connected wallet (or global defaults). |
| `POST` | `/api/filters` | Updates active 11-field metric filters and dev safety thresholds. |
| `POST` | `/api/filters/preset` | Saves a named filter preset for a wallet. |
| `GET` | `/api/filters/presets` | Retrieves all saved presets for a wallet (`?wallet=...`). |
| `POST` | `/api/session/create` | Creates or resets an AES-encrypted session keypair for a user wallet. |
| `GET` | `/api/session/status` | Returns session wallet public key, SOL balance, and bot config. |
| `POST` | `/api/session/withdraw` | Withdraws 100% of remaining session wallet SOL to the user's wallet. |
| `POST` | `/api/session/config` | Updates auto-buy settings (amount, slippage, max positions, TP ladder). |
| `POST` | `/api/trade/buy` | Manually triggers a Jupiter swap buy for a token. |
| `POST` | `/api/trade/sell` | Manually triggers a Jupiter swap sell for a token position. |
| `GET` | `/api/trades` | Retrieves trade history for a wallet (`?wallet=...`). |

### WebSocket Messages (`ws://localhost:3001`)

| Type | Direction | Payload Description |
|---|---|---|
| `ranked_coins` | Server ➔ Client | Array of all ranked, enriched tokens emitted every 30 seconds. |
| `auto_buy` | Server ➔ Client | Emitted when the bot executes an autonomous trade for a session wallet. |
| `trade_update` | Server ➔ Client | Emitted when a position's take-profit or stop-loss trigger fires. |
| `identify` | Client ➔ Server | Client sends `{ type: 'identify', wallet: '...' }` to bind socket to a wallet. |

---

## Operational Guide

### 1. Connecting Your Wallet
Click **Connect Wallet** in the top-right header and choose **Phantom**. Your public key and current SOL balance will appear.

### 2. Exploring Market Suggestions
- The **Current Suggestions** tab displays tokens that pass your active filters.
- Use the section selector to switch between:
  - **All Sections**: Complete qualified market list.
  - **🛡️ Low Risk (<20% Risk)**: Tokens with low rug risk, ranked by developer net worth.
  - **⚡ High Profit (≥20% Risk)**: High-momentum tokens ranked by net buy volume.
- Search instantly by token symbol, name, or contract address using the top search bar.

### 3. 3D Artifact Turntable Inspection
- Click any token card or item in the top **Breakout Gems Reel**.
- An interactive 3D modal opens featuring a metallic embossed coin medallion.
- **Interact**: Click and drag to rotate the medallion 360° under 3-point museum lighting.
- **Inspect**: Review the developer's on-chain dossier, bonding curve percentage, and key metrics.
- **Quick Buy**: Click **⚡ Quick Buy 0.1 SOL** to immediately initiate a swap.

### 4. Setting Up the Autopilot Bot
1. Navigate to the **Bot Controls** tab.
2. Click **Create Session Wallet** to generate your encrypted session keypair.
3. Copy the displayed session deposit address.
4. Send your allocated trading SOL (e.g., 0.5 SOL) from Phantom to this address.
5. Configure your trading parameters:
   - **Buy Amount**: e.g., `0.05 SOL` per trade
   - **Slippage**: e.g., `500 bps` (5%)
   - **Max Positions**: e.g., `5` concurrent tokens
   - **Take-Profit Ladder**: e.g., Close 50% at +100%, 30% at +200%, 20% at +500%
   - **Stop Loss**: e.g., -25%
6. Toggle **Auto-Buy Enabled** and click **Save Bot Settings**.
7. The bot will automatically inspect ranked tokens every 30 seconds and execute trades without requiring manual approvals.
8. Click **Withdraw All Funds** at any time to return 100% of your remaining SOL to your main wallet.

---

## Production Build & Deployment

### Building for Production
Verify that both backend and frontend compile with zero errors:
```bash
# Build frontend bundle
cd frontend
npm run build
```
*The bundle will be generated in `frontend/dist`.*

### Deploying with Docker
A Dockerfile is provided in `backend/Dockerfile` for containerized hosting on AWS ECS, GCP Cloud Run, or DigitalOcean:
```bash
cd backend
docker build -t gmgn-trading-bot-backend .
docker run -p 3001:3001 --env-file .env gmgn-trading-bot-backend
```

### Deploying to Render / Railway / Vercel
- **Backend on Render / Railway**: Point the service root to `backend/`, set build command to `npm install`, and start command to `node src/index.js`. Add environment variables for `SOLANA_RPC_URL`, `SESSION_ENCRYPTION_SECRET`, and optional `DATABASE_URL`.
- **Frontend on Vercel / Netlify**: Point the root to `frontend/`, set framework to **Vite**, build command to `npm run build`, and output directory to `dist`. Configure `VITE_API_URL` pointing to your backend service.

---

## Security & Risk Notice

- **Session Wallet Encryption**: Session private keys are encrypted on the server using `AES-256-CBC` with your unique `SESSION_ENCRYPTION_SECRET`. Never commit your secret to version control.
- **Meme Coin Volatility**: Solana meme coins carry extreme volatility and risk of total capital loss. Always test your strategies with small amounts of SOL before deploying larger sums.
- **RPC Throughput**: For high-speed production trading, utilize a dedicated Solana RPC provider (e.g., Helius, QuickNode, Triton) rather than public endpoints.

---

## License

MIT License. Designed and built with Google Antigravity.
