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

export const api = {
  // Coins
  getRankedCoins:    ()           => request('/coins/ranked'),
  getTokenDetails:   (address)    => request(`/token/${address}/details`),

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
