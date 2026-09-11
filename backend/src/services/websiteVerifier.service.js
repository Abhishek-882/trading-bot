import axios from 'axios';

const BLACKLIST_DOMAINS = [
  'pump.fun',
  't.me',
  'telegram.me',
  'telegram.org',
  'twitter.com',
  'x.com',
  'discord.gg',
  'discord.com',
  'dexscreener.com',
  'gmgn.ai',
  'solscan.io',
  'solana.com',
  'birdeye.so',
  'dextools.io',
  'github.com',
  'medium.com',
  'reddit.com',
  'youtube.com',
];

export class WebsiteVerifierService {
  constructor() {
    // Cache: tokenAddress / domain -> verification result
    this.cache = new Map();
  }

  /**
   * Verifies if the token has a genuine, active, independent website.
   *
   * @param {object} coin - Coin object with website/links/socials
   * @returns {Promise<{ hasGenuineWebsite: boolean, websiteUrl: string|null, domain: string|null, verified: boolean, reason: string }>}
   */
  async verifyCoinWebsite(coin) {
    if (!coin) {
      return {
        hasGenuineWebsite: false,
        websiteUrl: null,
        domain: null,
        verified: false,
        reason: 'No coin data provided',
      };
    }

    const cacheKey = coin.address || coin.website || 'unknown';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 1. Extract candidate URLs
    const candidateUrls = this._extractCandidateUrls(coin);

    if (!candidateUrls.length) {
      const res = {
        hasGenuineWebsite: false,
        websiteUrl: null,
        domain: null,
        verified: false,
        reason: 'No website URL provided in token metadata',
      };
      this.cache.set(cacheKey, res);
      return res;
    }

    // 2. Find the first URL that is not on the social/platform blacklist
    for (const rawUrl of candidateUrls) {
      const parsed = this._parseDomain(rawUrl);
      if (!parsed) continue;

      const isBlacklisted = BLACKLIST_DOMAINS.some(bl =>
        parsed.domain === bl || parsed.domain.endsWith('.' + bl)
      );

      if (isBlacklisted) continue;

      // 3. Perform lightweight HTTP check
      const verification = await this._checkUrl(parsed.normalizedUrl, parsed.domain);
      if (verification.verified) {
        const result = {
          hasGenuineWebsite: true,
          websiteUrl: parsed.normalizedUrl,
          domain: parsed.domain,
          verified: true,
          reason: `Verified live domain (${parsed.domain})`,
        };
        this.cache.set(cacheKey, result);
        return result;
      }
    }

    const finalResult = {
      hasGenuineWebsite: false,
      websiteUrl: candidateUrls[0] || null,
      domain: null,
      verified: false,
      reason: 'No independent responsive domain found (only social/platform links or unreachable website)',
    };
    this.cache.set(cacheKey, finalResult);
    return finalResult;
  }

  _extractCandidateUrls(coin) {
    const urls = [];

    if (coin.website && typeof coin.website === 'string') {
      urls.push(coin.website);
    }

    if (Array.isArray(coin.websites)) {
      for (const w of coin.websites) {
        const u = typeof w === 'string' ? w : w?.url;
        if (u) urls.push(u);
      }
    }

    if (Array.isArray(coin.links)) {
      for (const link of coin.links) {
        if (link && (link.label === 'Website' || link.type === 'website' || (!link.type && link.url))) {
          if (link.url) urls.push(link.url);
        }
      }
    }

    return Array.from(new Set(urls.filter(Boolean)));
  }

  _parseDomain(rawUrl) {
    try {
      let formatted = rawUrl.trim();
      if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
        formatted = 'https://' + formatted;
      }
      const u = new URL(formatted);
      const domain = u.hostname.toLowerCase().replace(/^www\./, '');
      return { normalizedUrl: formatted, domain };
    } catch {
      return null;
    }
  }

  async _checkUrl(url, domain) {
    try {
      const res = await axios.get(url, {
        timeout: 3000,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      return { verified: res.status >= 200 && res.status < 400 };
    } catch (err) {
      // Some websites block scrapers with 403 or have strict SSL, but have a genuine domain with valid DNS
      if (err.response && (err.response.status === 403 || err.response.status === 401)) {
        return { verified: true };
      }
      return { verified: false };
    }
  }
}

export const websiteVerifier = new WebsiteVerifierService();
export default websiteVerifier;
