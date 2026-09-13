import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'local_db.json');

let dbMode = 'local'; // 'postgres' | 'local'
let pool = null;

// In-memory local state backed by JSON file
let localDb = {
  trades: [],
  session_wallets: [],
  dev_cache: {},
  filter_presets: [],
  smart_wallets: [],
  kol_wallets: [],
  smart_signals: [],
  cluster_events: [],
  radar_stats: { lastScanTime: null, totalCoinsScanned: 0 },
};

function ensureLocalFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(LOCAL_DB_FILE)) {
    try {
      const content = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
      localDb = { ...localDb, ...JSON.parse(content) };
      if (!Array.isArray(localDb.smart_wallets)) localDb.smart_wallets = [];
      if (!Array.isArray(localDb.kol_wallets)) localDb.kol_wallets = [];
      if (!Array.isArray(localDb.smart_signals)) localDb.smart_signals = [];
      if (!Array.isArray(localDb.cluster_events)) localDb.cluster_events = [];
      if (!localDb.radar_stats) localDb.radar_stats = { lastScanTime: null, totalCoinsScanned: 0 };
    } catch {
      // fresh file if corrupt
    }
  } else {
    saveLocalFile();
  }
}

function saveLocalFile() {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error saving local DB:', err.message);
  }
}

export async function initializeDB() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isPlaceholder = !dbUrl || dbUrl.includes('@host:') || dbUrl.includes('user:password');

  if (!isPlaceholder) {
    try {
      console.log('[DB] Connecting to PostgreSQL...');
      pool = new Pool({
        connectionString: dbUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 4000,
      });

      const client = await pool.connect();
      await client.query('BEGIN');
      await client.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id              SERIAL PRIMARY KEY,
          coin_address    TEXT NOT NULL,
          coin_name       TEXT,
          coin_symbol     TEXT,
          buy_price_sol   NUMERIC,
          amount_sol      NUMERIC,
          wallet_address  TEXT NOT NULL,
          session_pubkey  TEXT,
          tx_signature    TEXT,
          status          TEXT DEFAULT 'open',
          tp1_hit         BOOLEAN DEFAULT FALSE,
          tp2_hit         BOOLEAN DEFAULT FALSE,
          tp3_hit         BOOLEAN DEFAULT FALSE,
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          closed_at       TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS session_wallets (
          id                SERIAL PRIMARY KEY,
          user_wallet       TEXT NOT NULL UNIQUE,
          session_pubkey    TEXT NOT NULL,
          encrypted_privkey TEXT NOT NULL,
          is_active         BOOLEAN DEFAULT TRUE,
          bot_config        JSONB DEFAULT '{}',
          created_at        TIMESTAMPTZ DEFAULT NOW(),
          updated_at        TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS dev_cache (
          dev_address     TEXT PRIMARY KEY,
          sol_balance     NUMERIC,
          total_value_usd NUMERIC DEFAULT 0,
          rug_percent     NUMERIC,
          total_launches  INTEGER,
          rugs_count      INTEGER,
          cached_at       TIMESTAMPTZ DEFAULT NOW()
        );
        -- Add total_value_usd column if upgrading existing schema
        ALTER TABLE dev_cache ADD COLUMN IF NOT EXISTS total_value_usd NUMERIC DEFAULT 0;

        CREATE TABLE IF NOT EXISTS filter_presets (
          id            SERIAL PRIMARY KEY,
          user_wallet   TEXT NOT NULL,
          name          TEXT NOT NULL,
          filters       JSONB NOT NULL DEFAULT '{}',
          dev_filters   JSONB NOT NULL DEFAULT '{}',
          created_at    TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS smart_wallets (
          wallet_address        TEXT PRIMARY KEY,
          score                 NUMERIC DEFAULT 0,
          win_rate_7d           NUMERIC DEFAULT 0,
          win_rate_30d          NUMERIC DEFAULT 0,
          realized_pnl_usd      NUMERIC DEFAULT 0,
          realized_pnl_percent  NUMERIC DEFAULT 0,
          unrealized_pnl_usd    NUMERIC DEFAULT 0,
          total_trades          INTEGER DEFAULT 0,
          tokens_traded_count   INTEGER DEFAULT 0,
          early_entry_count     INTEGER DEFAULT 0,
          avg_entry_mcap_usd    NUMERIC DEFAULT 0,
          coins_count           INTEGER DEFAULT 0,
          coins_entered         JSONB DEFAULT '[]',
          sol_balance           NUMERIC DEFAULT 0,
          last_active_timestamp BIGINT DEFAULT 0,
          wallet_created_at     BIGINT DEFAULT 0,
          bought_usd            NUMERIC DEFAULT 0,
          avg_buy_mc            NUMERIC DEFAULT 0,
          sold_usd              NUMERIC DEFAULT 0,
          avg_sold_mc           NUMERIC DEFAULT 0,
          remaining_usd         NUMERIC DEFAULT 0,
          remaining_percent     NUMERIC DEFAULT 0,
          funding_source        TEXT,
          funding_amount        NUMERIC DEFAULT 0,
          is_starred            BOOLEAN DEFAULT FALSE,
          tags                  JSONB DEFAULT '[]',
          name                  TEXT,
          avatar                TEXT,
          twitter_username      TEXT,
          rank                  INTEGER DEFAULT 0,
          raw_profile           JSONB DEFAULT '{}',
          updated_at            TIMESTAMPTZ DEFAULT NOW(),
          created_at            TIMESTAMPTZ DEFAULT NOW()
        );
        -- Add any missing columns to smart_wallets if upgrading schema
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS realized_pnl_percent NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS coins_count INTEGER DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS coins_entered JSONB DEFAULT '[]';
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS sol_balance NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS last_active_timestamp BIGINT DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS wallet_created_at BIGINT DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS bought_usd NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS avg_buy_mc NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS sold_usd NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS avg_sold_mc NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS remaining_usd NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS remaining_percent NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS funding_source TEXT;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS funding_amount NUMERIC DEFAULT 0;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS name TEXT;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS avatar TEXT;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS twitter_username TEXT;
        ALTER TABLE smart_wallets ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 0;

        CREATE TABLE IF NOT EXISTS kol_wallets (
          wallet_address        TEXT PRIMARY KEY,
          score                 NUMERIC DEFAULT 0,
          win_rate_7d           NUMERIC DEFAULT 0,
          win_rate_30d          NUMERIC DEFAULT 0,
          realized_pnl_usd      NUMERIC DEFAULT 0,
          realized_pnl_percent  NUMERIC DEFAULT 0,
          unrealized_pnl_usd    NUMERIC DEFAULT 0,
          total_trades          INTEGER DEFAULT 0,
          tokens_traded_count   INTEGER DEFAULT 0,
          coins_count           INTEGER DEFAULT 0,
          coins_entered         JSONB DEFAULT '[]',
          sol_balance           NUMERIC DEFAULT 0,
          last_active_timestamp BIGINT DEFAULT 0,
          wallet_created_at     BIGINT DEFAULT 0,
          bought_usd            NUMERIC DEFAULT 0,
          avg_buy_mc            NUMERIC DEFAULT 0,
          sold_usd              NUMERIC DEFAULT 0,
          avg_sold_mc           NUMERIC DEFAULT 0,
          remaining_usd         NUMERIC DEFAULT 0,
          remaining_percent     NUMERIC DEFAULT 0,
          funding_source        TEXT,
          funding_amount        NUMERIC DEFAULT 0,
          is_starred            BOOLEAN DEFAULT FALSE,
          tags                  JSONB DEFAULT '[]',
          name                  TEXT,
          avatar                TEXT,
          twitter_username      TEXT,
          rank                  INTEGER DEFAULT 0,
          raw_profile           JSONB DEFAULT '{}',
          updated_at            TIMESTAMPTZ DEFAULT NOW(),
          created_at            TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS smart_signals (
          id                  SERIAL PRIMARY KEY,
          wallet_address      TEXT NOT NULL,
          token_address       TEXT NOT NULL,
          token_symbol        TEXT,
          action              TEXT NOT NULL,
          entry_mcap_usd      NUMERIC,
          price_usd           NUMERIC,
          amount_usd          NUMERIC,
          created_at          TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cluster_events (
          id                  SERIAL PRIMARY KEY,
          token_address       TEXT NOT NULL,
          token_name          TEXT,
          token_symbol        TEXT,
          cluster_count       INTEGER DEFAULT 0,
          smart_wallets       JSONB DEFAULT '[]',
          average_entry_mcap  NUMERIC,
          confidence_score    NUMERIC,
          is_cabal_divergence BOOLEAN DEFAULT FALSE,
          created_at          TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await client.query('COMMIT');
      client.release();

      dbMode = 'postgres';
      console.log('✅ [DB] Connected to PostgreSQL successfully');
      return;
    } catch (err) {
      console.warn(`⚠️ [DB] PostgreSQL not reachable (${err.message}). Falling back to local storage.`);
    }
  } else {
    console.log('ℹ️ [DB] No external PostgreSQL URL detected in .env. Using local storage.');
  }

  // Fallback to local file-based database
  dbMode = 'local';
  ensureLocalFile();
  console.log(`✅ [DB] Local storage initialized at: ${LOCAL_DB_FILE}`);
}

// ── Trade helpers ──────────────────────────────────────────────────

export async function recordTrade(trade) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `INSERT INTO trades (coin_address, coin_name, coin_symbol, buy_price_sol, amount_sol,
        wallet_address, session_pubkey, tx_signature)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [trade.coin_address, trade.coin_name, trade.coin_symbol, trade.buy_price_sol,
       trade.amount_sol, trade.wallet_address, trade.session_pubkey, trade.tx_signature]
    );
    return res.rows[0];
  }

  const id = localDb.trades.length + 1;
  const item = {
    id,
    ...trade,
    status: 'open',
    tp1_hit: false,
    tp2_hit: false,
    tp3_hit: false,
    created_at: new Date().toISOString(),
    closed_at: null,
  };
  localDb.trades.unshift(item);
  saveLocalFile();
  return item;
}

export async function hasBought(coinAddress, walletAddress) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `SELECT id FROM trades WHERE coin_address=$1 AND wallet_address=$2 LIMIT 1`,
      [coinAddress, walletAddress]
    );
    return res.rows.length > 0;
  }

  return localDb.trades.some(
    t => t.coin_address === coinAddress && t.wallet_address === walletAddress
  );
}

export async function getTrades(walletAddress) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `SELECT * FROM trades WHERE wallet_address=$1 ORDER BY created_at DESC`,
      [walletAddress]
    );
    return res.rows;
  }

  return localDb.trades.filter(t => !walletAddress || t.wallet_address === walletAddress);
}

export async function updateTradeTP(tradeId, tpLevel) {
  if (dbMode === 'postgres') {
    await pool.query(
      `UPDATE trades SET tp${tpLevel}_hit=TRUE WHERE id=$1`,
      [tradeId]
    );
    return;
  }

  const item = localDb.trades.find(t => t.id === tradeId);
  if (item) {
    item[`tp${tpLevel}_hit`] = true;
    saveLocalFile();
  }
}

// ── Session wallet helpers ─────────────────────────────────────────

export async function saveSessionWallet({ userWallet, sessionPubkey, encryptedPrivkey, botConfig }) {
  if (dbMode === 'postgres') {
    await pool.query(
      `INSERT INTO session_wallets (user_wallet, session_pubkey, encrypted_privkey, bot_config)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_wallet)
       DO UPDATE SET session_pubkey=$2, encrypted_privkey=$3, bot_config=$4, updated_at=NOW()`,
      [userWallet, sessionPubkey, encryptedPrivkey, JSON.stringify(botConfig || {})]
    );
    return;
  }

  const existingIdx = localDb.session_wallets.findIndex(s => s.user_wallet === userWallet);
  const now = new Date().toISOString();
  const sessionData = {
    id: existingIdx >= 0 ? localDb.session_wallets[existingIdx].id : localDb.session_wallets.length + 1,
    user_wallet: userWallet,
    session_pubkey: sessionPubkey,
    encrypted_privkey: encryptedPrivkey,
    is_active: true,
    bot_config: botConfig || {},
    created_at: existingIdx >= 0 ? localDb.session_wallets[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    localDb.session_wallets[existingIdx] = sessionData;
  } else {
    localDb.session_wallets.push(sessionData);
  }
  saveLocalFile();
}

export async function getSessionWallet(userWallet) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `SELECT * FROM session_wallets WHERE user_wallet=$1 AND is_active=TRUE`,
      [userWallet]
    );
    return res.rows[0] || null;
  }

  return localDb.session_wallets.find(s => s.user_wallet === userWallet && s.is_active) || null;
}

export async function getAllActiveSessions() {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `SELECT * FROM session_wallets WHERE is_active=TRUE`
    );
    return res.rows;
  }

  return localDb.session_wallets.filter(s => s.is_active);
}

export async function updateBotConfig(userWallet, botConfig) {
  if (dbMode === 'postgres') {
    await pool.query(
      `UPDATE session_wallets SET bot_config=$2, updated_at=NOW() WHERE user_wallet=$1`,
      [userWallet, JSON.stringify(botConfig)]
    );
    return;
  }

  const session = localDb.session_wallets.find(s => s.user_wallet === userWallet);
  if (session) {
    session.bot_config = botConfig;
    session.updated_at = new Date().toISOString();
    saveLocalFile();
  }
}

export async function deactivateSession(userWallet) {
  if (dbMode === 'postgres') {
    await pool.query(
      `UPDATE session_wallets SET is_active=FALSE WHERE user_wallet=$1`,
      [userWallet]
    );
    return;
  }

  const session = localDb.session_wallets.find(s => s.user_wallet === userWallet);
  if (session) {
    session.is_active = false;
    session.updated_at = new Date().toISOString();
    saveLocalFile();
  }
}

// ── Dev cache helpers ──────────────────────────────────────────────

export async function getCachedDev(devAddress) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `SELECT *, EXTRACT(EPOCH FROM (NOW()-cached_at))/60 AS age_minutes
       FROM dev_cache WHERE dev_address=$1`,
      [devAddress]
    );
    const row = res.rows[0];
    if (!row) return null;
    if (row.age_minutes > 5) return null;
    return row;
  }

  const item = localDb.dev_cache[devAddress];
  if (!item) return null;
  const ageMinutes = (Date.now() - new Date(item.cached_at).getTime()) / 60000;
  if (ageMinutes > 5) return null;
  return item;
}

export async function cacheDev(data) {
  if (dbMode === 'postgres') {
    await pool.query(
      `INSERT INTO dev_cache (dev_address, sol_balance, total_value_usd, rug_percent, total_launches, rugs_count, cached_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (dev_address) DO UPDATE
       SET sol_balance=$2, total_value_usd=$3, rug_percent=$4, total_launches=$5, rugs_count=$6, cached_at=NOW()`,
      [data.dev_address, data.sol_balance, data.total_value_usd || 0, data.rug_percent, data.total_launches, data.rugs_count]
    );
    return;
  }

  localDb.dev_cache[data.dev_address] = {
    ...data,
    total_value_usd: data.total_value_usd || 0,
    cached_at: new Date().toISOString(),
  };
  saveLocalFile();
}

// ── Filter preset helpers ──────────────────────────────────────────

export async function savePreset(userWallet, name, filters, devFilters) {
  if (dbMode === 'postgres') {
    await pool.query(
      `INSERT INTO filter_presets (user_wallet, name, filters, dev_filters)
       VALUES ($1,$2,$3,$4)`,
      [userWallet, name, JSON.stringify(filters), JSON.stringify(devFilters)]
    );
    return;
  }

  const id = localDb.filter_presets.length + 1;
  localDb.filter_presets.unshift({
    id,
    user_wallet: userWallet,
    name,
    filters,
    dev_filters: devFilters,
    created_at: new Date().toISOString(),
  });
  saveLocalFile();
}

export async function getPresets(userWallet) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `SELECT * FROM filter_presets WHERE user_wallet=$1 ORDER BY created_at DESC`,
      [userWallet]
    );
    return res.rows;
  }

  return localDb.filter_presets.filter(p => !userWallet || p.user_wallet === userWallet);
}

// ── Smart Money & Cluster Helpers ─────────────────────────────────

export async function saveSmartWallet(data) {
  const {
    wallet_address,
    score = 0,
    win_rate_7d = 0,
    win_rate_30d = 0,
    realized_pnl_usd = 0,
    unrealized_pnl_usd = 0,
    total_trades = 0,
    tokens_traded_count = 0,
    early_entry_count = 0,
    avg_entry_mcap_usd = 0,
    is_starred,
    tags = [],
    raw_profile = {},
  } = data;

  if (!wallet_address) return null;

  if (dbMode === 'postgres') {
    await pool.query(
      `INSERT INTO smart_wallets (
        wallet_address, score, win_rate_7d, win_rate_30d, realized_pnl_usd,
        realized_pnl_percent, unrealized_pnl_usd, total_trades, tokens_traded_count,
        coins_count, coins_entered, sol_balance, last_active_timestamp, wallet_created_at,
        bought_usd, avg_buy_mc, sold_usd, avg_sold_mc, remaining_usd, remaining_percent,
        funding_source, funding_amount, is_starred, tags, name, avatar, twitter_username,
        rank, raw_profile, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,COALESCE($23, FALSE),$24,$25,$26,$27,$28,$29,NOW()
      )
      ON CONFLICT (wallet_address) DO UPDATE SET
        score = EXCLUDED.score,
        win_rate_7d = EXCLUDED.win_rate_7d,
        win_rate_30d = EXCLUDED.win_rate_30d,
        realized_pnl_usd = EXCLUDED.realized_pnl_usd,
        realized_pnl_percent = EXCLUDED.realized_pnl_percent,
        unrealized_pnl_usd = EXCLUDED.unrealized_pnl_usd,
        total_trades = EXCLUDED.total_trades,
        tokens_traded_count = EXCLUDED.tokens_traded_count,
        coins_count = EXCLUDED.coins_count,
        coins_entered = EXCLUDED.coins_entered,
        sol_balance = EXCLUDED.sol_balance,
        last_active_timestamp = EXCLUDED.last_active_timestamp,
        wallet_created_at = EXCLUDED.wallet_created_at,
        bought_usd = EXCLUDED.bought_usd,
        avg_buy_mc = EXCLUDED.avg_buy_mc,
        sold_usd = EXCLUDED.sold_usd,
        avg_sold_mc = EXCLUDED.avg_sold_mc,
        remaining_usd = EXCLUDED.remaining_usd,
        remaining_percent = EXCLUDED.remaining_percent,
        funding_source = EXCLUDED.funding_source,
        funding_amount = EXCLUDED.funding_amount,
        is_starred = COALESCE($23, smart_wallets.is_starred),
        tags = EXCLUDED.tags,
        name = EXCLUDED.name,
        avatar = EXCLUDED.avatar,
        twitter_username = EXCLUDED.twitter_username,
        rank = EXCLUDED.rank,
        raw_profile = EXCLUDED.raw_profile,
        updated_at = NOW()`,
      [
        wallet_address,
        score,
        win_rate_7d,
        win_rate_30d,
        realized_pnl_usd,
        data.realized_pnl_percent || 0,
        unrealized_pnl_usd,
        total_trades,
        tokens_traded_count,
        data.coins_count || (Array.isArray(data.coins_entered) ? data.coins_entered.length : 0),
        JSON.stringify(data.coins_entered || []),
        data.sol_balance || 0,
        data.last_active_timestamp || 0,
        data.wallet_created_at || 0,
        data.bought_usd || 0,
        data.avg_buy_mc || 0,
        data.sold_usd || 0,
        data.avg_sold_mc || 0,
        data.remaining_usd || 0,
        data.remaining_percent || 0,
        data.funding_source || null,
        data.funding_amount || 0,
        is_starred !== undefined ? is_starred : null,
        JSON.stringify(tags),
        data.name || null,
        data.avatar || null,
        data.twitter_username || null,
        data.rank || 0,
        JSON.stringify(raw_profile),
      ]
    );
    return data;
  }

  // localDb
  const idx = localDb.smart_wallets.findIndex(w => w.wallet_address === wallet_address);
  const existing = idx >= 0 ? localDb.smart_wallets[idx] : null;
  const entry = {
    wallet_address,
    score: Number(score) || 0,
    win_rate_7d: Number(win_rate_7d) || 0,
    win_rate_30d: Number(win_rate_30d) || 0,
    realized_pnl_usd: Number(realized_pnl_usd) || 0,
    unrealized_pnl_usd: Number(unrealized_pnl_usd) || 0,
    total_trades: Number(total_trades) || 0,
    tokens_traded_count: Number(tokens_traded_count) || 0,
    early_entry_count: Number(early_entry_count) || 0,
    avg_entry_mcap_usd: Number(avg_entry_mcap_usd) || 0,
    is_starred: is_starred !== undefined ? Boolean(is_starred) : (existing?.is_starred || false),
    tags: Array.isArray(tags) ? tags : (existing?.tags || []),
    raw_profile: raw_profile || existing?.raw_profile || {},
    name: data.name ?? existing?.name ?? null,
    avatar: data.avatar ?? existing?.avatar ?? null,
    twitter_username: data.twitter_username ?? existing?.twitter_username ?? null,
    sol_balance: data.sol_balance !== undefined ? Number(data.sol_balance) : (existing?.sol_balance ?? null),
    last_active_timestamp: data.last_active_timestamp !== undefined ? Number(data.last_active_timestamp) : (existing?.last_active_timestamp ?? null),
    wallet_created_at: data.wallet_created_at !== undefined ? Number(data.wallet_created_at) : (existing?.wallet_created_at ?? null),
    coins_entered: Array.isArray(data.coins_entered) ? data.coins_entered : (existing?.coins_entered || []),
    coins_count: data.coins_count !== undefined ? Number(data.coins_count) : (existing?.coins_count ?? (Array.isArray(data.coins_entered) ? data.coins_entered.length : 0)),
    bought_usd: data.bought_usd !== undefined ? Number(data.bought_usd) : (existing?.bought_usd ?? null),
    avg_buy_mc: data.avg_buy_mc !== undefined ? Number(data.avg_buy_mc) : (existing?.avg_buy_mc ?? null),
    sold_usd: data.sold_usd !== undefined ? Number(data.sold_usd) : (existing?.sold_usd ?? null),
    avg_sold_mc: data.avg_sold_mc !== undefined ? Number(data.avg_sold_mc) : (existing?.avg_sold_mc ?? null),
    realized_pnl_percent: data.realized_pnl_percent !== undefined ? Number(data.realized_pnl_percent) : (existing?.realized_pnl_percent ?? null),
    remaining_usd: data.remaining_usd !== undefined ? Number(data.remaining_usd) : (existing?.remaining_usd ?? null),
    remaining_percent: data.remaining_percent !== undefined ? Number(data.remaining_percent) : (existing?.remaining_percent ?? null),
    funding_source: data.funding_source ?? existing?.funding_source ?? null,
    funding_amount: data.funding_amount !== undefined ? Number(data.funding_amount) : (existing?.funding_amount ?? null),
    total_buy_tokens: data.total_buy_tokens !== undefined ? Number(data.total_buy_tokens) : (existing?.total_buy_tokens ?? null),
    total_buy_txs: data.total_buy_txs !== undefined ? Number(data.total_buy_txs) : (existing?.total_buy_txs ?? null),
    total_sold_tokens: data.total_sold_tokens !== undefined ? Number(data.total_sold_tokens) : (existing?.total_sold_tokens ?? null),
    total_sold_txs: data.total_sold_txs !== undefined ? Number(data.total_sold_txs) : (existing?.total_sold_txs ?? null),
    rank: data.rank !== undefined ? Number(data.rank) : (existing?.rank ?? 0),
    updated_at: new Date().toISOString(),
    created_at: existing?.created_at || new Date().toISOString(),
  };

  if (idx >= 0) {
    localDb.smart_wallets[idx] = entry;
  } else {
    localDb.smart_wallets.push(entry);
  }
  saveLocalFile();
  return entry;
}

export async function getSmartWallets({ minScore = 0, isStarred = null, limit = 100 } = {}) {
  if (dbMode === 'postgres') {
    let query = `SELECT * FROM smart_wallets WHERE score >= $1`;
    const params = [minScore];
    if (isStarred !== null) {
      params.push(isStarred);
      query += ` AND is_starred = $${params.length}`;
    }
    query += ` ORDER BY score DESC, realized_pnl_usd DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await pool.query(query, params);
    return res.rows;
  }

  let list = localDb.smart_wallets.filter(w => (Number(w.score) || 0) >= minScore);
  if (isStarred !== null) {
    list = list.filter(w => Boolean(w.is_starred) === Boolean(isStarred));
  }
  list.sort((a, b) => (b.score - a.score) || (b.realized_pnl_usd - a.realized_pnl_usd));
  return list.slice(0, limit);
}

export async function toggleStarSmartWallet(walletAddress) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `UPDATE smart_wallets SET is_starred = NOT is_starred, updated_at = NOW() WHERE wallet_address = $1 RETURNING *`,
      [walletAddress]
    );
    return res.rows[0] || null;
  }

  const wallet = localDb.smart_wallets.find(w => w.wallet_address === walletAddress);
  if (wallet) {
    wallet.is_starred = !wallet.is_starred;
    wallet.updated_at = new Date().toISOString();
    saveLocalFile();
    return wallet;
  }
  return null;
}

// ── KOL Wallets Persistence ──────────────────────────────────────────

export async function saveKolWallet(data) {
  const {
    wallet_address,
    score = 0,
    win_rate_7d = 0,
    win_rate_30d = 0,
    realized_pnl_usd = 0,
    unrealized_pnl_usd = 0,
    total_trades = 0,
    tokens_traded_count = 0,
    early_entry_count = 0,
    avg_entry_mcap_usd = 0,
    is_starred,
    tags = [],
    raw_profile = {},
  } = data;

  if (!wallet_address) return null;

  if (dbMode === 'postgres') {
    await pool.query(
      `INSERT INTO kol_wallets (
        wallet_address, score, win_rate_7d, win_rate_30d, realized_pnl_usd,
        realized_pnl_percent, unrealized_pnl_usd, total_trades, tokens_traded_count,
        coins_count, coins_entered, sol_balance, last_active_timestamp, wallet_created_at,
        bought_usd, avg_buy_mc, sold_usd, avg_sold_mc, remaining_usd, remaining_percent,
        funding_source, funding_amount, is_starred, tags, name, avatar, twitter_username,
        rank, raw_profile, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,COALESCE($23, FALSE),$24,$25,$26,$27,$28,$29,NOW()
      )
      ON CONFLICT (wallet_address) DO UPDATE SET
        score = EXCLUDED.score,
        win_rate_7d = EXCLUDED.win_rate_7d,
        win_rate_30d = EXCLUDED.win_rate_30d,
        realized_pnl_usd = EXCLUDED.realized_pnl_usd,
        realized_pnl_percent = EXCLUDED.realized_pnl_percent,
        unrealized_pnl_usd = EXCLUDED.unrealized_pnl_usd,
        total_trades = EXCLUDED.total_trades,
        tokens_traded_count = EXCLUDED.tokens_traded_count,
        coins_count = EXCLUDED.coins_count,
        coins_entered = EXCLUDED.coins_entered,
        sol_balance = EXCLUDED.sol_balance,
        last_active_timestamp = EXCLUDED.last_active_timestamp,
        wallet_created_at = EXCLUDED.wallet_created_at,
        bought_usd = EXCLUDED.bought_usd,
        avg_buy_mc = EXCLUDED.avg_buy_mc,
        sold_usd = EXCLUDED.sold_usd,
        avg_sold_mc = EXCLUDED.avg_sold_mc,
        remaining_usd = EXCLUDED.remaining_usd,
        remaining_percent = EXCLUDED.remaining_percent,
        funding_source = EXCLUDED.funding_source,
        funding_amount = EXCLUDED.funding_amount,
        is_starred = COALESCE($23, kol_wallets.is_starred),
        tags = EXCLUDED.tags,
        name = EXCLUDED.name,
        avatar = EXCLUDED.avatar,
        twitter_username = EXCLUDED.twitter_username,
        rank = EXCLUDED.rank,
        raw_profile = EXCLUDED.raw_profile,
        updated_at = NOW()`,
      [
        wallet_address,
        score,
        win_rate_7d,
        win_rate_30d,
        realized_pnl_usd,
        data.realized_pnl_percent || 0,
        unrealized_pnl_usd,
        total_trades,
        tokens_traded_count,
        data.coins_count || (Array.isArray(data.coins_entered) ? data.coins_entered.length : 0),
        JSON.stringify(data.coins_entered || []),
        data.sol_balance || 0,
        data.last_active_timestamp || 0,
        data.wallet_created_at || 0,
        data.bought_usd || 0,
        data.avg_buy_mc || 0,
        data.sold_usd || 0,
        data.avg_sold_mc || 0,
        data.remaining_usd || 0,
        data.remaining_percent || 0,
        data.funding_source || null,
        data.funding_amount || 0,
        is_starred !== undefined ? is_starred : null,
        JSON.stringify(tags),
        data.name || null,
        data.avatar || null,
        data.twitter_username || null,
        data.rank || 0,
        JSON.stringify(raw_profile),
      ]
    );
    return data;
  }

  // localDb
  if (!Array.isArray(localDb.kol_wallets)) localDb.kol_wallets = [];
  const idx = localDb.kol_wallets.findIndex(w => w.wallet_address === wallet_address);
  const existing = idx >= 0 ? localDb.kol_wallets[idx] : null;
  const entry = {
    wallet_address,
    score: Number(score) || 0,
    win_rate_7d: Number(win_rate_7d) || 0,
    win_rate_30d: Number(win_rate_30d) || 0,
    realized_pnl_usd: Number(realized_pnl_usd) || 0,
    unrealized_pnl_usd: Number(unrealized_pnl_usd) || 0,
    total_trades: Number(total_trades) || 0,
    tokens_traded_count: Number(tokens_traded_count) || 0,
    early_entry_count: Number(early_entry_count) || 0,
    avg_entry_mcap_usd: Number(avg_entry_mcap_usd) || 0,
    is_starred: is_starred !== undefined ? Boolean(is_starred) : (existing?.is_starred || false),
    tags: Array.isArray(tags) ? tags : (existing?.tags || []),
    raw_profile: raw_profile || existing?.raw_profile || {},
    name: data.name ?? existing?.name ?? null,
    avatar: data.avatar ?? existing?.avatar ?? null,
    twitter_username: data.twitter_username ?? existing?.twitter_username ?? null,
    sol_balance: data.sol_balance !== undefined ? Number(data.sol_balance) : (existing?.sol_balance ?? null),
    last_active_timestamp: data.last_active_timestamp !== undefined ? Number(data.last_active_timestamp) : (existing?.last_active_timestamp ?? null),
    wallet_created_at: data.wallet_created_at !== undefined ? Number(data.wallet_created_at) : (existing?.wallet_created_at ?? null),
    coins_entered: Array.isArray(data.coins_entered) ? data.coins_entered : (existing?.coins_entered || []),
    coins_count: data.coins_count !== undefined ? Number(data.coins_count) : (existing?.coins_count ?? (Array.isArray(data.coins_entered) ? data.coins_entered.length : 0)),
    bought_usd: data.bought_usd !== undefined ? Number(data.bought_usd) : (existing?.bought_usd ?? null),
    avg_buy_mc: data.avg_buy_mc !== undefined ? Number(data.avg_buy_mc) : (existing?.avg_buy_mc ?? null),
    sold_usd: data.sold_usd !== undefined ? Number(data.sold_usd) : (existing?.sold_usd ?? null),
    avg_sold_mc: data.avg_sold_mc !== undefined ? Number(data.avg_sold_mc) : (existing?.avg_sold_mc ?? null),
    realized_pnl_percent: data.realized_pnl_percent !== undefined ? Number(data.realized_pnl_percent) : (existing?.realized_pnl_percent ?? null),
    remaining_usd: data.remaining_usd !== undefined ? Number(data.remaining_usd) : (existing?.remaining_usd ?? null),
    remaining_percent: data.remaining_percent !== undefined ? Number(data.remaining_percent) : (existing?.remaining_percent ?? null),
    funding_source: data.funding_source ?? existing?.funding_source ?? null,
    funding_amount: data.funding_amount !== undefined ? Number(data.funding_amount) : (existing?.funding_amount ?? null),
    total_buy_tokens: data.total_buy_tokens !== undefined ? Number(data.total_buy_tokens) : (existing?.total_buy_tokens ?? null),
    total_buy_txs: data.total_buy_txs !== undefined ? Number(data.total_buy_txs) : (existing?.total_buy_txs ?? null),
    total_sold_tokens: data.total_sold_tokens !== undefined ? Number(data.total_sold_tokens) : (existing?.total_sold_tokens ?? null),
    total_sold_txs: data.total_sold_txs !== undefined ? Number(data.total_sold_txs) : (existing?.total_sold_txs ?? null),
    rank: data.rank !== undefined ? Number(data.rank) : (existing?.rank ?? 0),
    updated_at: new Date().toISOString(),
    created_at: existing?.created_at || new Date().toISOString(),
  };

  if (idx >= 0) {
    localDb.kol_wallets[idx] = entry;
  } else {
    localDb.kol_wallets.push(entry);
  }
  saveLocalFile();
  return entry;
}

export async function getKolWallets({ minScore = 0, isStarred = null, limit = 100 } = {}) {
  if (dbMode === 'postgres') {
    let query = `SELECT * FROM kol_wallets WHERE score >= $1`;
    const params = [minScore];
    if (isStarred !== null) {
      params.push(isStarred);
      query += ` AND is_starred = $${params.length}`;
    }
    query += ` ORDER BY score DESC, realized_pnl_usd DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await pool.query(query, params);
    return res.rows;
  }

  if (!Array.isArray(localDb.kol_wallets)) localDb.kol_wallets = [];
  let list = localDb.kol_wallets.filter(w => (Number(w.score) || 0) >= minScore);
  if (isStarred !== null) {
    list = list.filter(w => Boolean(w.is_starred) === Boolean(isStarred));
  }
  list.sort((a, b) => (b.score - a.score) || (b.realized_pnl_usd - a.realized_pnl_usd));
  return list.slice(0, limit);
}

export async function toggleStarKolWallet(walletAddress) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `UPDATE kol_wallets SET is_starred = NOT is_starred, updated_at = NOW() WHERE wallet_address = $1 RETURNING *`,
      [walletAddress]
    );
    return res.rows[0] || null;
  }

  if (!Array.isArray(localDb.kol_wallets)) localDb.kol_wallets = [];
  const wallet = localDb.kol_wallets.find(w => w.wallet_address === walletAddress);
  if (wallet) {
    wallet.is_starred = !wallet.is_starred;
    wallet.updated_at = new Date().toISOString();
    saveLocalFile();
    return wallet;
  }
  return null;
}

export async function saveRadarStats(stats = {}) {
  if (!localDb.radar_stats) localDb.radar_stats = {};
  localDb.radar_stats = { ...localDb.radar_stats, ...stats, updated_at: new Date().toISOString() };
  saveLocalFile();
  return localDb.radar_stats;
}

export async function getRadarStats() {
  return localDb.radar_stats || { lastScanTime: null, totalCoinsScanned: 0 };
}

export async function saveSmartSignal(signal) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `INSERT INTO smart_signals (wallet_address, token_address, token_symbol, action, entry_mcap_usd, price_usd, amount_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [signal.wallet_address, signal.token_address, signal.token_symbol, signal.action, signal.entry_mcap_usd, signal.price_usd, signal.amount_usd]
    );
    return res.rows[0];
  }

  const item = {
    id: localDb.smart_signals.length + 1,
    ...signal,
    created_at: new Date().toISOString(),
  };
  localDb.smart_signals.unshift(item);
  if (localDb.smart_signals.length > 500) localDb.smart_signals.pop();
  saveLocalFile();
  return item;
}

export async function getSmartSignals({ tokenAddress = null, walletAddress = null, limit = 50 } = {}) {
  if (dbMode === 'postgres') {
    let query = `SELECT * FROM smart_signals WHERE 1=1`;
    const params = [];
    if (tokenAddress) {
      params.push(tokenAddress);
      query += ` AND token_address = $${params.length}`;
    }
    if (walletAddress) {
      params.push(walletAddress);
      query += ` AND wallet_address = $${params.length}`;
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const res = await pool.query(query, params);
    return res.rows;
  }

  return localDb.smart_signals
    .filter(s => (!tokenAddress || s.token_address === tokenAddress) && (!walletAddress || s.wallet_address === walletAddress))
    .slice(0, limit);
}

export async function saveClusterEvent(cluster) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `INSERT INTO cluster_events (token_address, token_name, token_symbol, cluster_count, smart_wallets, average_entry_mcap, confidence_score, is_cabal_divergence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        cluster.token_address,
        cluster.token_name,
        cluster.token_symbol,
        cluster.cluster_count,
        JSON.stringify(cluster.smart_wallets || []),
        cluster.average_entry_mcap,
        cluster.confidence_score,
        cluster.is_cabal_divergence || false,
      ]
    );
    return res.rows[0];
  }

  const item = {
    id: localDb.cluster_events.length + 1,
    ...cluster,
    created_at: new Date().toISOString(),
  };
  localDb.cluster_events.unshift(item);
  if (localDb.cluster_events.length > 200) localDb.cluster_events.pop();
  saveLocalFile();
  return item;
}

export async function getClusterEvents({ limit = 30 } = {}) {
  if (dbMode === 'postgres') {
    const res = await pool.query(
      `SELECT * FROM cluster_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  return localDb.cluster_events.slice(0, limit);
}

