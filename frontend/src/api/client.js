let rawApi = import.meta.env.VITE_API_URL || '';
if (rawApi && !rawApi.startsWith('http://') && !rawApi.startsWith('https://')) {
  rawApi = (rawApi.includes('localhost') ? 'http://' : 'https://') + rawApi;
}
// Remove trailing slash if any
const API_BASE = rawApi.replace(/\/$/, '');

async function request(path, options = {}) {
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || data.errors?.join(', ') || 'API error');
  return data.data;
}

// High-speed client-side memory cache (30s TTL) for zero-latency modal rendering
const tokenDetailsCache = new Map(); // address -> { data, timestamp }

async function getCachedTokenDetails(address) {
  if (!address) return null;
  const cached = tokenDetailsCache.get(address);
  const now = Date.now();

  // Background fetch to update cache (SWR)
  const refreshPromise = request(`/token/${address}/details`)
    .then((fresh) => {
      if (fresh) tokenDetailsCache.set(address, { data: fresh, timestamp: Date.now() });
      return fresh;
    })
    .catch((err) => {
      console.warn(`[Client API] SWR refresh error for ${address}:`, err.message);
      return cached ? cached.data : null;
    });

  // If cached and younger than 30s, return instantly (0ms)
  if (cached && (now - cached.timestamp < 30000)) {
    return cached.data;
  }

  // Otherwise await fresh fetch
  return refreshPromise;
}

export const api = {
  // Coins & System Telemetry
  getRankedCoins:    ()           => request('/coins/ranked'),
  getTokenDetails:   (address)    => getCachedTokenDetails(address),
  getKeysStatus:     ()           => request('/keys/status'),

  // Filters
  setFilters:        (body)       => request('/filters', { method: 'POST', body: JSON.stringify(body) }),
  getFilters:        (wallet)     => request(`/filters?wallet=${wallet}`),
  savePreset:        (body)       => request('/filters/preset', { method: 'POST', body: JSON.stringify(body) }),
  getPresets:        (wallet)     => request(`/filters/presets?wallet=${wallet}`),

  // Session wallet
  createSession:     (body)       => request('/session/create',     { method: 'POST', body: JSON.stringify(body) }),
  getSessionBalance: (wallet)     => request(`/session/balance?wallet=${wallet}`),
  withdrawSession:   (userWallet) => request('/session/withdraw',    { method: 'POST', body: JSON.stringify({ userWallet }) }),
  deactivateSession: (userWallet) => request('/session/deactivate',  { method: 'POST', body: JSON.stringify({ userWallet }) }),
  updateBotConfig:   (body)       => request('/session/config',      { method: 'PUT',  body: JSON.stringify(body) }),

  // Trades
  getTrades:         (wallet)     => request(`/trades?wallet=${wallet}`),

  // DexScreener Synergy & Orders
  getCommunityTakeovers: ()       => request('/tokens/cto'),
  getBoostedTokens:      ()       => request('/tokens/boosted'),
  getTrendingMetas:      ()       => request('/metas/trending'),
  getMetaWithPairs:      (slug)   => request(`/metas/${slug}`),
  getTokenOrders:        (address)=> request(`/token/${address}/orders`),

  // Smart Money Radar & Cluster Convergence
  getSmartWallets:       (params = {}) => {
    const qs = new URLSearchParams();
    if (params.minScore) qs.append('minScore', params.minScore);
    if (params.isStarred !== undefined && params.isStarred !== null) qs.append('isStarred', params.isStarred);
    if (params.limit) qs.append('limit', params.limit);
    return request(`/smart-money/wallets?${qs.toString()}`);
  },
  scanSmartMoney:        (body = {}) => request('/smart-money/scan', { method: 'POST', body: JSON.stringify(body) }),
  runPreset7D:           (body = {}) => request('/smart-money/preset-7d', { method: 'POST', body: JSON.stringify(body) }),
  toggleStarWallet:      (address) => request(`/smart-money/star/${address}`, { method: 'POST' }),
  getSmartClusters:      () => request('/smart-money/clusters'),
  getExportUrl:          () => `${API_BASE}/api/smart-money/export`,

  // Wallets Radar (Smart Money & KOL 2-Section Ranking)
  getRadarWallets:       (params = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.sortBy) qs.append('sortBy', params.sortBy);
    if (params.section) qs.append('section', params.section);
    if (params.limit) qs.append('limit', params.limit);
    return request(`/wallets/radar?${qs.toString()}`);
  },
  scanRadarWallets:      (body = {}) => request('/wallets/radar/scan', { method: 'POST', body: JSON.stringify(body) }),
  getTokenTraders:       (address) => request(`/token/${address}/traders`),
  toggleStarRadarWallet: (address) => request(`/wallets/star/${address}`, { method: 'POST' }),
  getRadarExportUrl:     () => `${API_BASE}/api/wallets/radar/export`,
};

// WebSocket singleton
let ws = null;
const listeners = new Set();

export function connectWS(onMessage) {
  listeners.add(onMessage);
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const base = API_BASE || (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `https://${window.location.host}`
    : 'http://localhost:3001');

  const WS_URL = base.replace(/^http/, 'ws');

  try {
    ws = new WebSocket(WS_URL);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        listeners.forEach(fn => fn(msg));
      } catch { /* ignore */ }
    };
    ws.onclose = () => setTimeout(() => connectWS(() => {}), 3000); // auto-reconnect
  } catch (err) {
    console.warn('[WS] Failed to initiate connection:', err);
  }
}

export function disconnectWS(onMessage) {
  listeners.delete(onMessage);
}

export function wsSend(data) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
