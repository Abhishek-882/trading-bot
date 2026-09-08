import axios from 'axios';

const API_KEY = process.env.GMGN_API_KEY;
const BASE    = 'https://gmgn.ai';

// Axios instance with auth headers required by GMGN
const client = axios.create({
  baseURL: BASE,
  timeout: 15000,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'X-API-Key':     API_KEY,
    'Content-Type':  'application/json',
    'User-Agent':    'Mozilla/5.0 (compatible; GMGNBot/1.0)',
  },
});

export class GMGNService {
  constructor() {
    this.chain = 'sol';
  }

  /**
   * Fetch newly created token pairs from GMGN.
   * Returns normalized coin objects.
   */
  async fetchNewTokens(limit = 50) {
    try {
      const res = await client.get(`/defi/quotation/v1/tokens/new_pairs/${this.chain}`, {
        params: {
          limit,
          orderby:   'created_timestamp',
          direction: 'desc',
          filters:   '{}',
        },
      });

      const pairs = res.data?.data?.pairs || res.data?.data || [];
      return pairs.map(p => this._normalizePair(p));
    } catch (err) {
      // Gracefully degrade — return mock data in dev if GMGN is unreachable
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[GMGN] API error, using mock data:', err.message);
        return this._mockTokens();
      }
      throw err;
    }
  }

  /**
   * Fetch detailed token info including dev/creator address.
   */
  async fetchTokenInfo(tokenAddress) {
    try {
      const res = await client.get(`/api/v1/token_info/${this.chain}/${tokenAddress}`);
      return res.data?.data || null;
    } catch (err) {
      console.error(`[GMGN] Token info error for ${tokenAddress}:`, err.message);
      return null;
    }
  }

  /**
   * Fetch all tokens launched by a dev wallet.
   */
  async fetchDevTokenHistory(devAddress) {
    try {
      const res = await client.get(`/api/v1/wallet_holdings/${this.chain}/${devAddress}`, {
        params: { limit: 50, orderby: 'last_active_timestamp', direction: 'desc' }
      });
      return res.data?.data?.holdings || [];
    } catch (err) {
      console.error(`[GMGN] Dev history error for ${devAddress}:`, err.message);
      return [];
    }
  }

  /**
   * Fetch token security / rug metrics from GMGN.
   */
  async fetchTokenSecurity(tokenAddress) {
    try {
      const res = await client.get(`/api/v1/token_security/${this.chain}/${tokenAddress}`);
      return res.data?.data || {};
    } catch (err) {
      return {};
    }
  }

  // ── Normalization ───────────────────────────────────────────────

  _normalizePair(p) {
    return {
      address:          p.base_address   || p.address        || '',
      name:             p.base_name      || p.name           || 'Unknown',
      symbol:           p.base_symbol    || p.symbol         || '???',
      logo:             p.logo           || p.base_logo_url  || '',
      price:            parseFloat(p.price || p.close || 0),
      mktCapK:          parseFloat(p.market_cap || 0) / 1000,
      liquidityK:       parseFloat(p.liquidity  || 0) / 1000,
      volumeK:          parseFloat(p.volume     || p.volume_24h || 0) / 1000,
      netBuyK:          parseFloat(p.net_buy_volume || 0) / 1000,
      txs:              parseInt(p.txns  || p.swaps || 0),
      buys:             parseInt(p.buys  || 0),
      sells:            parseInt(p.sells || 0),
      totalFeesSol:     parseFloat(p.total_fees  || 0),
      ageMinutes:       this._ageMinutes(p.created_timestamp || p.open_timestamp),
      pumpLiveAgeMin:   this._ageMinutes(p.launchpad_timestamp || p.created_timestamp),
      bCurvePercent:    parseFloat(p.bonding_curve_progress || p.b_curve || 0),
      devAddress:       p.creator || p.deployer || p.dev_address || null,
      // These will be filled by DevWalletService
      devBalanceSol:    null,
      devRugPercent:    null,
      devTotalLaunches: null,
      // Ranking score (filled by RankingService)
      score:            0,
      rank:             0,
    };
  }

  _ageMinutes(ts) {
    if (!ts) return 9999;
    const ms = (Date.now() / 1000) - ts;
    return Math.max(0, Math.round(ms / 60));
  }

  // ── Mock data for development ────────────────────────────────────

  _mockTokens() {
    const now = Math.floor(Date.now() / 1000);
    return Array.from({ length: 20 }, (_, i) => ({
      address:          `MockAddr${i}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      name:             `MockCoin${i}`,
      symbol:           `MC${i}`,
      logo:             '',
      price:            Math.random() * 0.001,
      mktCapK:          10 + Math.random() * 500,
      liquidityK:       5  + Math.random() * 100,
      volumeK:          2  + Math.random() * 200,
      netBuyK:          -10 + Math.random() * 50,
      txs:              50  + Math.floor(Math.random() * 500),
      buys:             30  + Math.floor(Math.random() * 300),
      sells:            20  + Math.floor(Math.random() * 200),
      totalFeesSol:     Math.random() * 5,
      ageMinutes:       Math.floor(Math.random() * 60),
      pumpLiveAgeMin:   Math.floor(Math.random() * 30),
      bCurvePercent:    Math.random() * 100,
      devAddress:       `DevAddr${i}xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      devBalanceSol:    null,
      devRugPercent:    null,
      devTotalLaunches: null,
      score:            0,
      rank:             0,
    }));
  }
}
