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
};

function ensureLocalFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(LOCAL_DB_FILE)) {
    try {
      const content = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
      localDb = { ...localDb, ...JSON.parse(content) };
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
