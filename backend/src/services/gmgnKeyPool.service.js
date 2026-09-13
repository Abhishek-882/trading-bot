import { OpenApiClient } from 'gmgn-cli/dist/client/OpenApiClient.js';

export const DEFAULT_GMGN_KEY_PAIRS = [
  {
    id: 1,
    apiKey: 'gmgn_53de6fb22b3fd814a80c1001f415c886',
    publicKey: 'MCowBQYDK2VwAyEA12NPsUQIAlkDfXaf1k22j5kJb6nRnRoL+Tj/ZfeR/LY=',
  },
  {
    id: 2,
    apiKey: 'gmgn_4d56d11c7331e1bc88d969efcf38f843',
    publicKey: 'MCowBQYDK2VwAyEAYy4yaFo7EtZp4BYJFBbXCXCE0jOJVO6LchQ1cFO3lAo=',
  },
  {
    id: 3,
    apiKey: 'gmgn_72c9409fdf75739774c4da90bace2f66',
    publicKey: 'MCowBQYDK2VwAyEANlPM/ts1h7VTDL/qd3KIH1OhnSZNwQViZq350TJI/FE=',
  },
  {
    id: 4,
    apiKey: 'gmgn_28c34d1605cb3007de11109744330e68',
    publicKey: 'MCowBQYDK2VwAyEA6+tDehKPvPU7opSubNWEJEaK8FI0OB5/FGr0E4nzzHw=',
  },
  {
    id: 5,
    apiKey: 'gmgn_d4afcd22dc05f611afd9cff4dc96a823',
    publicKey: 'MCowBQYDK2VwAyEAb19Dduxys0THMUn/X9VVsenbKa2CZZjIycs9VeEsu7Q=',
  },
];

export class GMGNKeyPool {
  constructor(customKeys = null) {
    this.host = 'https://openapi.gmgn.ai';
    this.keys = [];
    this.rrIndex = 0;
    this.globalRateLimitedUntil = 0;
    this._initKeys(customKeys);
  }

  isAvailable() {
    const now = Date.now();
    return now >= this.globalRateLimitedUntil && this.keys.some(k => k.rateLimitedUntil <= now);
  }

  _initKeys(customKeys) {
    let keyList = [];

    // Check environment variable for comma-separated list
    const envKeys = process.env.GMGN_API_KEYS;
    if (envKeys && typeof envKeys === 'string') {
      const split = envKeys.split(',').map(s => s.trim()).filter(Boolean);
      if (split.length > 0) {
        keyList = split.map((apiKey, idx) => ({
          id: idx + 1,
          apiKey,
          publicKey: null,
        }));
      }
    }

    if (keyList.length === 0) {
      keyList = customKeys && customKeys.length > 0 ? customKeys : DEFAULT_GMGN_KEY_PAIRS;
    }

    // Also verify single legacy env key if present and not in list
    if (process.env.GMGN_API_KEY && !keyList.some(k => k.apiKey === process.env.GMGN_API_KEY)) {
      keyList.unshift({
        id: 0,
        apiKey: process.env.GMGN_API_KEY,
        publicKey: null,
      });
    }

    this.keys = keyList.map(item => ({
      id: item.id,
      apiKey: item.apiKey,
      publicKey: item.publicKey || null,
      client: new OpenApiClient({
        apiKey: item.apiKey,
        host: this.host,
      }),
      rateLimitedUntil: 0,
      activeRequests: 0,
      totalRequests: 0,
      successCount: 0,
      errorCount: 0,
      lastLatencyMs: 0,
      lastUsedAt: 0,
    }));

    console.log(`[GMGN Key Pool] Initialized with ${this.keys.length} high-speed in-process API clients.`);
  }

  /**
   * Acquire the best available client entry.
   * Priority: Healthy keys (rateLimitedUntil <= now), sorted by lowest activeRequests,
   * with Round-Robin arbitration to avoid single-key hotspots.
   */
  acquireKey(excludeId = null) {
    const now = Date.now();
    const available = this.keys.filter(k => k.rateLimitedUntil <= now && k.id !== excludeId);

    if (available.length > 0) {
      // Pick round-robin among least active keys
      const minActive = Math.min(...available.map(k => k.activeRequests));
      const leastActive = available.filter(k => k.activeRequests === minActive);
      const chosen = leastActive[this.rrIndex % leastActive.length];
      this.rrIndex = (this.rrIndex + 1) % 1000000;
      return chosen;
    }

    // If all keys are rate-limited or excluded, pick key that recovers earliest
    const candidates = excludeId ? this.keys.filter(k => k.id !== excludeId) : this.keys;
    if (candidates.length === 0) return this.keys[0];

    const earliest = [...candidates].sort((a, b) => a.rateLimitedUntil - b.rateLimitedUntil)[0];
    return earliest;
  }

  /**
   * Execute an operation with automatic failover to sibling keys if rate limit occurs.
   */
  async execute(operationName, fn, maxAttempts = 3) {
    const now = Date.now();
    if (now < this.globalRateLimitedUntil) {
      const remainingSec = Math.ceil((this.globalRateLimitedUntil - now) / 1000);
      throw new Error(`GMGN IP cooldown active (${remainingSec}s remaining)`);
    }

    let lastError = null;
    let excludedId = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const keyEntry = this.acquireKey(excludedId);
      keyEntry.activeRequests++;
      keyEntry.totalRequests++;
      keyEntry.lastUsedAt = Date.now();
      const t0 = Date.now();

      try {
        const result = await fn(keyEntry.client, keyEntry);
        const elapsed = Date.now() - t0;
        keyEntry.lastLatencyMs = elapsed;
        keyEntry.successCount++;
        keyEntry.activeRequests = Math.max(0, keyEntry.activeRequests - 1);
        return result;
      } catch (err) {
        const elapsed = Date.now() - t0;
        keyEntry.lastLatencyMs = elapsed;
        keyEntry.errorCount++;
        keyEntry.activeRequests = Math.max(0, keyEntry.activeRequests - 1);
        lastError = err;

        const isIpBan =
          err?.apiError === 'RATE_LIMIT_BANNED' ||
          (err?.message && err.message.includes('IP is temporarily banned'));

        if (isIpBan) {
          const resetUnix = err?.resetAtUnix;
          const waitMs = resetUnix ? Math.max(resetUnix * 1000 - Date.now(), 5000) : 60000;
          this.globalRateLimitedUntil = Date.now() + waitMs;
          console.warn(
            `[GMGN Key Pool] IP rate-limit cooldown engaged until ${new Date(this.globalRateLimitedUntil).toLocaleTimeString()} (${Math.ceil(waitMs / 1000)}s). Fast-failing over to secondary fallbacks in 0ms.`
          );
          throw err;
        }

        const isRateLimit =
          err?.status === 429 ||
          err?.apiError === 'RATE_LIMIT_EXCEEDED' ||
          (err?.message && (err.message.includes('429') || err.message.includes('RATE_LIMIT')));

        if (isRateLimit) {
          const resetUnix = err?.resetAtUnix;
          const waitMs = resetUnix ? Math.max(resetUnix * 1000 - Date.now(), 5000) : 30000;
          keyEntry.rateLimitedUntil = Date.now() + waitMs;
          console.warn(
            `[GMGN Key Pool] Key #${keyEntry.id} (${keyEntry.apiKey.slice(0, 10)}...) rate limited for ${Math.ceil(waitMs / 1000)}s during ${operationName}. Instantly failing over to sibling key in 0ms.`
          );
          excludedId = keyEntry.id;
          continue; // Failover immediately to next available key
        }

        // For non-rate-limit errors, rethrow
        throw err;
      }
    }

    throw lastError || new Error(`All attempts failed for ${operationName}`);
  }

  /**
   * Concurrently execute two operations using two distinct keys in parallel.
   * e.g., Token Info + Token Security executed simultaneously on separate keys.
   */
  async executeParallel(op1, op2) {
    const now = Date.now();
    if (now < this.globalRateLimitedUntil) {
      return [
        { status: 'rejected', reason: new Error('GMGN IP cooldown active') },
        { status: 'rejected', reason: new Error('GMGN IP cooldown active') },
      ];
    }

    const key1 = this.acquireKey();
    const key2 = this.acquireKey(key1.id);

    const runWithKey = async (keyEntry, opName, fn) => {
      keyEntry.activeRequests++;
      keyEntry.totalRequests++;
      keyEntry.lastUsedAt = Date.now();
      const t0 = Date.now();
      try {
        const res = await fn(keyEntry.client);
        keyEntry.lastLatencyMs = Date.now() - t0;
        keyEntry.successCount++;
        return res;
      } catch (err) {
        keyEntry.lastLatencyMs = Date.now() - t0;
        keyEntry.errorCount++;

        const isIpBan =
          err?.apiError === 'RATE_LIMIT_BANNED' ||
          (err?.message && err.message.includes('IP is temporarily banned'));
        if (isIpBan) {
          const resetUnix = err?.resetAtUnix;
          const waitMs = resetUnix ? Math.max(resetUnix * 1000 - Date.now(), 5000) : 60000;
          this.globalRateLimitedUntil = Date.now() + waitMs;
          console.warn(`[GMGN Key Pool] IP rate-limit cooldown engaged until ${new Date(this.globalRateLimitedUntil).toLocaleTimeString()}.`);
          throw err;
        }

        const isRateLimit =
          err?.status === 429 ||
          err?.apiError === 'RATE_LIMIT_EXCEEDED';
        if (isRateLimit) {
          const waitMs = err?.resetAtUnix ? Math.max(err.resetAtUnix * 1000 - Date.now(), 5000) : 30000;
          keyEntry.rateLimitedUntil = Date.now() + waitMs;
          console.warn(`[GMGN Key Pool] Key #${keyEntry.id} rate-limited during ${opName}. Failover...`);
          return await this.execute(opName, fn);
        }
        throw err;
      } finally {
        keyEntry.activeRequests = Math.max(0, keyEntry.activeRequests - 1);
      }
    };

    return Promise.allSettled([
      runWithKey(key1, op1.name, op1.fn),
      runWithKey(key2, op2.name, op2.fn),
    ]);
  }

  // ── High-Speed API Methods ───────────────────────────────────────────

  async getTokenInfo(chain, address) {
    return this.execute(`getTokenInfo(${address})`, client => client.getTokenInfo(chain, address));
  }

  async getTokenSecurity(chain, address) {
    return this.execute(`getTokenSecurity(${address})`, client => client.getTokenSecurity(chain, address));
  }

  /**
   * Simultaneously fetch token info & token security using 2 distinct keys.
   * Returns { tokenInfo, tokenSecurity } in ~250ms cold.
   */
  async getTokenSecurityBundle(chain, address) {
    const [infoRes, secRes] = await this.executeParallel(
      { name: `bundleInfo(${address})`, fn: client => client.getTokenInfo(chain, address) },
      { name: `bundleSecurity(${address})`, fn: client => client.getTokenSecurity(chain, address) }
    );

    return {
      tokenInfo: infoRes.status === 'fulfilled' ? infoRes.value : null,
      tokenSecurity: secRes.status === 'fulfilled' ? secRes.value : null,
      errors: [
        infoRes.status === 'rejected' ? infoRes.reason?.message : null,
        secRes.status === 'rejected' ? secRes.reason?.message : null,
      ].filter(Boolean),
    };
  }

  async getTrendingSwaps(chain, interval = '1h', extra = {}) {
    return this.execute(`getTrendingSwaps(${interval})`, client =>
      client.getTrendingSwaps(chain, interval, extra)
    );
  }

  async getTrenches(chain, types, platforms, limit = 50, filters = {}) {
    return this.execute(`getTrenches(${limit})`, client =>
      client.getTrenches(chain, types, platforms, limit, filters)
    );
  }

  async getTokenKline(chain, address, resolution, from, to) {
    return this.execute(`getTokenKline(${address})`, client =>
      client.getTokenKline(chain, address, resolution, from, to)
    );
  }

  async getTokenTopTraders(chain, address, extra = {}) {
    return this.execute(`getTokenTopTraders(${address})`, client =>
      client.getTokenTopTraders(chain, address, extra)
    );
  }

  async getWalletProfits(chain, walletAddresses, period = '7d') {
    return this.execute(`getWalletProfits(${walletAddresses?.length || 0})`, client =>
      client.getWalletProfits(chain, walletAddresses, period)
    );
  }

  async getSmartMoney(chain, limit = 50) {
    return this.execute(`getSmartMoney(${limit})`, client =>
      client.getSmartMoney(chain, limit)
    );
  }

  async getKol(chain, limit = 50) {
    return this.execute(`getKol(${limit})`, client =>
      client.getKol(chain, limit)
    );
  }

  async getWalletStats(chain, walletAddresses, period = '7d') {
    return this.execute(`getWalletStats(${walletAddresses?.length || 0})`, client =>
      client.getWalletStats(chain, walletAddresses, period)
    );
  }

  async getWalletActivity(chain, walletAddress, extra = {}) {
    return this.execute(`getWalletActivity(${walletAddress})`, client =>
      client.getWalletActivity(chain, walletAddress, extra)
    );
  }

  async getWalletHoldings(chain, walletAddress, extra = {}) {
    return this.execute(`getWalletHoldings(${walletAddress})`, client =>
      client.getWalletHoldings(chain, walletAddress, extra)
    );
  }

  /**
   * Health metrics and status for telemetry dashboard
   */
  getPoolStats() {
    const now = Date.now();
    return {
      totalKeys: this.keys.length,
      healthyKeys: this.keys.filter(k => k.rateLimitedUntil <= now).length,
      keys: this.keys.map(k => ({
        id: k.id,
        maskedKey: `${k.apiKey.slice(0, 8)}...${k.apiKey.slice(-4)}`,
        isHealthy: k.rateLimitedUntil <= now,
        cooldownRemainingSec: Math.max(0, Math.ceil((k.rateLimitedUntil - now) / 1000)),
        activeRequests: k.activeRequests,
        totalRequests: k.totalRequests,
        successCount: k.successCount,
        errorCount: k.errorCount,
        lastLatencyMs: k.lastLatencyMs,
      })),
    };
  }
}

export const gmgnKeyPool = new GMGNKeyPool();
