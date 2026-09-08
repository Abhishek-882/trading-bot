import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

export async function initializeDB() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      -- Tracks every auto-buy made by the bot
      CREATE TABLE IF NOT EXISTS trades (
        id              SERIAL PRIMARY KEY,
        coin_address    TEXT NOT NULL,
        coin_name       TEXT,
        coin_symbol     TEXT,
        buy_price_sol   NUMERIC,
        amount_sol      NUMERIC,
        wallet_address  TEXT NOT NULL,   -- user's main wallet
        session_pubkey  TEXT,            -- session wallet that executed the buy
        tx_signature    TEXT,
        status          TEXT DEFAULT 'open',  -- open | closed | partial
        tp1_hit         BOOLEAN DEFAULT FALSE,
        tp2_hit         BOOLEAN DEFAULT FALSE,
        tp3_hit         BOOLEAN DEFAULT FALSE,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        closed_at       TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_trades_wallet   ON trades(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_trades_coin     ON trades(coin_address, wallet_address);

      -- Session wallets: bot-controlled keypairs funded by the user
      CREATE TABLE IF NOT EXISTS session_wallets (
        id                SERIAL PRIMARY KEY,
        user_wallet       TEXT NOT NULL UNIQUE,  -- user's main Phantom wallet
        session_pubkey    TEXT NOT NULL,          -- bot session wallet public key
        encrypted_privkey TEXT NOT NULL,          -- AES-encrypted private key
        is_active         BOOLEAN DEFAULT TRUE,
        bot_config        JSONB DEFAULT '{}',     -- buy_amount, tp_levels, etc.
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );

      -- Dev wallet analysis cache (5-min TTL)
      CREATE TABLE IF NOT EXISTS dev_cache (
        dev_address     TEXT PRIMARY KEY,
        sol_balance     NUMERIC,
        rug_percent     NUMERIC,
        total_launches  INTEGER,
        rugs_count      INTEGER,
        cached_at       TIMESTAMPTZ DEFAULT NOW()
      );

      -- Saved filter presets per user
      CREATE TABLE IF NOT EXISTS filter_presets (
        id            SERIAL PRIMARY KEY,
        user_wallet   TEXT NOT NULL,
        name          TEXT NOT NULL,
        filters       JSONB NOT NULL DEFAULT '{}',
        dev_filters   JSONB NOT NULL DEFAULT '{}',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );

      -- Coin rankings log (for history/analytics)
      CREATE TABLE IF NOT EXISTS coin_rankings (
        id           SERIAL PRIMARY KEY,
        coin_address TEXT NOT NULL,
        snapshot     JSONB NOT NULL,
        ranked_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query('COMMIT');
    console.log('[DB] PostgreSQL schema initialized');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Trade helpers ──────────────────────────────────────────────────

export async function recordTrade(trade) {
  const res = await pool.query(
    `INSERT INTO trades (coin_address, coin_name, coin_symbol, buy_price_sol, amount_sol,
      wallet_address, session_pubkey, tx_signature)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [trade.coin_address, trade.coin_name, trade.coin_symbol, trade.buy_price_sol,
     trade.amount_sol, trade.wallet_address, trade.session_pubkey, trade.tx_signature]
  );
  return res.rows[0];
}

export async function hasBought(coinAddress, walletAddress) {
  const res = await pool.query(
    `SELECT id FROM trades WHERE coin_address=$1 AND wallet_address=$2 LIMIT 1`,
    [coinAddress, walletAddress]
  );
  return res.rows.length > 0;
}

export async function getTrades(walletAddress) {
  const res = await pool.query(
    `SELECT * FROM trades WHERE wallet_address=$1 ORDER BY created_at DESC`,
    [walletAddress]
  );
  return res.rows;
}

export async function updateTradeTP(tradeId, tpLevel) {
  await pool.query(
    `UPDATE trades SET tp${tpLevel}_hit=TRUE WHERE id=$1`,
    [tradeId]
  );
}

// ── Session wallet helpers ─────────────────────────────────────────

export async function saveSessionWallet({ userWallet, sessionPubkey, encryptedPrivkey, botConfig }) {
  await pool.query(
    `INSERT INTO session_wallets (user_wallet, session_pubkey, encrypted_privkey, bot_config)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_wallet)
     DO UPDATE SET session_pubkey=$2, encrypted_privkey=$3, bot_config=$4, updated_at=NOW()`,
    [userWallet, sessionPubkey, encryptedPrivkey, JSON.stringify(botConfig || {})]
  );
}

export async function getSessionWallet(userWallet) {
  const res = await pool.query(
    `SELECT * FROM session_wallets WHERE user_wallet=$1 AND is_active=TRUE`,
    [userWallet]
  );
  return res.rows[0] || null;
}

export async function getAllActiveSessions() {
  const res = await pool.query(
    `SELECT * FROM session_wallets WHERE is_active=TRUE`
  );
  return res.rows;
}

export async function updateBotConfig(userWallet, botConfig) {
  await pool.query(
    `UPDATE session_wallets SET bot_config=$2, updated_at=NOW() WHERE user_wallet=$1`,
    [userWallet, JSON.stringify(botConfig)]
  );
}

export async function deactivateSession(userWallet) {
  await pool.query(
    `UPDATE session_wallets SET is_active=FALSE WHERE user_wallet=$1`,
    [userWallet]
  );
}

// ── Dev cache helpers ──────────────────────────────────────────────

export async function getCachedDev(devAddress) {
  const res = await pool.query(
    `SELECT *, EXTRACT(EPOCH FROM (NOW()-cached_at))/60 AS age_minutes
     FROM dev_cache WHERE dev_address=$1`,
    [devAddress]
  );
  const row = res.rows[0];
  if (!row) return null;
  if (row.age_minutes > 5) return null; // expired
  return row;
}

export async function cacheDev(data) {
  await pool.query(
    `INSERT INTO dev_cache (dev_address, sol_balance, rug_percent, total_launches, rugs_count, cached_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (dev_address) DO UPDATE
     SET sol_balance=$2, rug_percent=$3, total_launches=$4, rugs_count=$5, cached_at=NOW()`,
    [data.dev_address, data.sol_balance, data.rug_percent, data.total_launches, data.rugs_count]
  );
}

// ── Filter preset helpers ──────────────────────────────────────────

export async function savePreset(userWallet, name, filters, devFilters) {
  await pool.query(
    `INSERT INTO filter_presets (user_wallet, name, filters, dev_filters)
     VALUES ($1,$2,$3,$4)`,
    [userWallet, name, JSON.stringify(filters), JSON.stringify(devFilters)]
  );
}

export async function getPresets(userWallet) {
  const res = await pool.query(
    `SELECT * FROM filter_presets WHERE user_wallet=$1 ORDER BY created_at DESC`,
    [userWallet]
  );
  return res.rows;
}
