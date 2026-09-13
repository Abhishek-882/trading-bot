import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api/client';
import soundFX from '../../engine/soundFX';
import { useBotStore } from '../../stores/botStore';

export function WalletsRadarPage({ onInspectCoin }) {
  const [smartWallets, setSmartWallets] = useState([]);
  const [kolWallets, setKolWallets] = useState([]);
  const [stats, setStats] = useState({ totalCoinsScanned: 0, smartCount: 0, kolCount: 0, lastScanTime: null });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'smart' | 'kol'
  const [viewMode, setViewMode] = useState('recent_coins'); // 'recent_coins' | 'wallets'
  const [copiedAddr, setCopiedAddr] = useState(null);
  const [copiedTokenCa, setCopiedTokenCa] = useState(null);

  // Interactive Filter Controls (User Spec: 0 = Lowest age first with >=1 smart/kol; >0 = <=X hours ranked by smart+kol buyers count)
  const [maxAgeHours, setMaxAgeHours] = useState(0);     // 0 = All (Lowest age first); >0 = <=X hours
  const [maxEntryMcap, setMaxEntryMcap] = useState(500); // 500 = $500k; null = 'All'
  const [minWinRate, setMinWinRate] = useState(0);       // 0 = 0% default
  const [minRealizedPnl, setMinRealizedPnl] = useState(0); // 0 = $0 default

  const addNotification = useBotStore((s) => s.addNotification);

  // Load radar data from backend
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.getRadarWallets({
        limit: 200,
        maxAgeHours,
        maxEntryMcap,
        minWinRate,
        minPnl: minRealizedPnl,
      });
      if (res) {
        setSmartWallets(res.smartWallets || []);
        setKolWallets(res.kolWallets || []);
        if (res.stats) setStats(res.stats);
      }
    } catch (err) {
      console.error('[Wallets Radar] Error loading data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Trigger on-demand scan of newly launched coins
  const handleScanNewlyCoins = async () => {
    soundFX.playClick(1.2);
    setScanning(true);
    addNotification({ type: 'info', text: 'Scanning newly launched meme coins for Smart Money & KOL traders...' });
    try {
      const res = await api.scanRadarWallets({ tokenLimit: 20 });
      if (res) {
        setSmartWallets(res.smartWallets || []);
        setKolWallets(res.kolWallets || []);
        if (res.stats) setStats(res.stats);
        if (res.rateLimited) {
          addNotification({
            type: 'warning',
            text: `GMGN live API cooldown active (~${res.cooldownRemainingSec}s). Serving verified on-chain wallets.`,
          });
        } else {
          soundFX.playTradeSuccess();
          addNotification({
            type: 'success',
            text: `Scan complete: ${res.smartWallets?.length || 0} Smart Money & ${res.kolWallets?.length || 0} KOL wallets ranked!`,
          });
        }
      }
    } catch (err) {
      addNotification({ type: 'error', text: `Radar scan notice: ${err.message}` });
    } finally {
      setScanning(false);
    }
  };

  // Star toggle
  const handleToggleStar = async (addr) => {
    soundFX.playClick(1.1);
    try {
      const updated = await api.toggleStarRadarWallet(addr);
      if (updated) {
        setSmartWallets((prev) =>
          prev.map((w) => (w.wallet_address === addr ? { ...w, is_starred: updated.is_starred } : w))
        );
        setKolWallets((prev) =>
          prev.map((w) => (w.wallet_address === addr ? { ...w, is_starred: updated.is_starred } : w))
        );
      }
    } catch (err) {
      console.warn('Star toggle notice:', err.message);
    }
  };

  // Copy address to clipboard
  const handleCopy = (address) => {
    navigator.clipboard.writeText(address);
    setCopiedAddr(address);
    soundFX.playClick(1.0);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  // Filter helper with interactive controls
  const filterList = (list) => {
    let res = list;

    // Search query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      res = res.filter((w) => {
        const addrMatch = w.wallet_address?.toLowerCase().includes(q);
        const nameMatch = w.name?.toLowerCase().includes(q);
        const twitterMatch = w.twitter_username?.toLowerCase().includes(q);
        const tagMatch = Array.isArray(w.tags) && w.tags.some((t) => t.toLowerCase().includes(q));
        const coinMatch = Array.isArray(w.coins_entered) && w.coins_entered.some((c) =>
          c.symbol?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q)
        );
        return addrMatch || nameMatch || twitterMatch || tagMatch || coinMatch;
      });
    }

    // 1. Max Entry Market Cap filter (default <$500k)
    if (maxEntryMcap !== null && maxEntryMcap !== '' && !isNaN(Number(maxEntryMcap))) {
      const threshold = Number(maxEntryMcap) * 1000;
      res = res.filter((w) => {
        if (w.avg_buy_mc == null && (!w.coins_entered || w.coins_entered.length === 0)) return true;
        const avgOk = w.avg_buy_mc != null && w.avg_buy_mc <= threshold;
        const anyCoinOk = Array.isArray(w.coins_entered) && w.coins_entered.some((c) => c.entryMcap != null && c.entryMcap <= threshold);
        return avgOk || anyCoinOk;
      });
    }

    // 2. Min 7D Win Rate filter (default 0%)
    if (minWinRate != null && !isNaN(Number(minWinRate)) && Number(minWinRate) > 0) {
      const minWr = Number(minWinRate);
      res = res.filter((w) => (Number(w.win_rate_7d) || 0) >= minWr);
    }

    // 3. Min Realized PnL filter (default $0)
    if (minRealizedPnl != null && !isNaN(Number(minRealizedPnl)) && Number(minRealizedPnl) > 0) {
      const minProfit = Number(minRealizedPnl);
      res = res.filter((w) => (Number(w.realized_pnl_usd) || 0) >= minProfit);
    }

    return res;
  };

  // Sort helper
  const sortList = (list) => {
    const copy = [...list];
    switch (sortBy) {
      case 'win_rate':
        return copy.sort((a, b) => (Number(b.win_rate_7d) || 0) - (Number(a.win_rate_7d) || 0));
      case 'realized_pnl':
        return copy.sort((a, b) => (Number(b.realized_pnl_usd) || 0) - (Number(a.realized_pnl_usd) || 0));
      case 'coins_count':
        return copy.sort((a, b) => (Number(b.coins_count) || 0) - (Number(a.coins_count) || 0));
      case 'last_active':
        return copy.sort((a, b) => (Number(b.last_active_timestamp) || 0) - (Number(a.last_active_timestamp) || 0));
      case 'rank':
      default:
        return copy.sort((a, b) => (Number(a.rank) || 999) - (Number(b.rank) || 999) || (Number(b.score) || 0) - (Number(a.score) || 0));
    }
  };

  const filteredSmart = useMemo(() => sortList(filterList(smartWallets)), [
    smartWallets,
    search,
    sortBy,
    maxEntryMcap,
    minWinRate,
    minRealizedPnl,
  ]);
  const filteredKol = useMemo(() => sortList(filterList(kolWallets)), [
    kolWallets,
    search,
    sortBy,
    maxEntryMcap,
    minWinRate,
    minRealizedPnl,
  ]);

  // Formatter for relative time
  const formatTimeAgo = (ts) => {
    if (!ts) return '--';
    const tsMs = ts > 1e11 ? ts : ts * 1000;
    const diffSec = Math.max(1, Math.floor((Date.now() - tsMs) / 1000));
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d`;
  };

  // Formatter for wallet age
  const formatWalletAge = (ts) => {
    if (!ts) return '--';
    const tsMs = ts > 1e11 ? ts : ts * 1000;
    const diffDays = Math.max(1, Math.floor((Date.now() - tsMs) / (1000 * 60 * 60 * 24)));
    return `${diffDays}d`;
  };

  // Formatter for token amounts
  const formatTokensAmount = (amount) => {
    if (!amount || isNaN(amount) || amount <= 0) return '0';
    if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
    if (amount >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
    if (amount >= 1e3) return `${(amount / 1e3).toFixed(1)}K`;
    return Math.round(amount).toString();
  };

  // Compute unique coins count across smart and kol wallets
  const newlyCoinsTotal = (smart, kol) => {
    const set = new Set();
    [...(smart || []), ...(kol || [])].forEach((w) => {
      if (Array.isArray(w.coins_entered)) {
        w.coins_entered.forEach((c) => {
          if (c.address) set.add(c.address);
          else if (c.symbol) set.add(c.symbol);
        });
      }
    });
    return set.size;
  };

  // Formatter for values in K, M, B
  const formatKMB = (val) => {
    if (val == null || isNaN(val) || val <= 0) return '--';
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    return Math.round(val).toString();
  };

  const formatPrice = (p) => {
    if (!p || isNaN(p) || p <= 0) return '--';
    if (p < 0.00001) return `$${p.toExponential(2)}`;
    if (p < 0.01) return `$${p.toFixed(6)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(2)}`;
  };

  // Copy token contract address to clipboard
  const handleCopyTokenCa = (address, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedTokenCa(address);
    soundFX.playClick(1.0);
    setTimeout(() => setCopiedTokenCa(null), 2000);
  };

  // Aggregate recent coins bought by Smart Money and KOL wallets (purely coins, no wallet addresses)
  const aggregatedCoins = useMemo(() => {
    const map = new Map();

    const addCoin = (w, c, isSmart, isKol) => {
      if (!c || !c.address) return;
      const addr = c.address;
      if (addr === 'So11111111111111111111111111111111111111112') return;

      if (!map.has(addr)) {
        map.set(addr, {
          address: addr,
          symbol: c.symbol || 'TOKEN',
          name: c.name || c.symbol || 'Meme Coin',
          entryMcap: c.entryMcap != null ? Math.round(c.entryMcap) : null,
          minEntryMcap: c.entryMcap != null ? Math.round(c.entryMcap) : null,
          price: c.entryPrice || 0,
          marketCap: c.entryMcap || null,
          smartBuyersCount: 0,
          kolBuyersCount: 0,
          totalBoughtUsd: 0,
          winRates: [],
          lastBoughtTimestamp: c.enteredAt || w.last_active_timestamp || 0,
          isPump: Boolean(addr.endsWith('pump') || c.isPump),
          dexId: addr.endsWith('pump') ? 'pump' : 'Raydium',
          isSmartBought: false,
          isKolBought: false,
        });
      }

      const item = map.get(addr);
      const boughtUsd = Number(c.boughtUsd) || 0;
      item.totalBoughtUsd += Math.round(boughtUsd);

      if (c.entryMcap != null) {
        if (item.minEntryMcap == null || c.entryMcap < item.minEntryMcap) {
          item.minEntryMcap = Math.round(c.entryMcap);
        }
        if (item.entryMcap == null) {
          item.entryMcap = Math.round(c.entryMcap);
        }
      }

      if (isSmart) {
        item.smartBuyersCount += 1;
        item.isSmartBought = true;
        const wr = Number(w.win_rate_7d);
        if (!isNaN(wr) && wr > 0) item.winRates.push(wr);
      }

      if (isKol) {
        item.kolBuyersCount += 1;
        item.isKolBought = true;
      }

      const ts = c.enteredAt || w.last_active_timestamp || 0;
      if (ts > item.lastBoughtTimestamp) {
        item.lastBoughtTimestamp = ts;
      }
    };

    smartWallets.forEach((w) => (w.coins_entered || []).forEach((c) => addCoin(w, c, true, false)));
    kolWallets.forEach((w) => (w.coins_entered || []).forEach((c) => addCoin(w, c, false, true)));

    return Array.from(map.values())
      .filter((c) => c.smartBuyersCount >= 1 || c.kolBuyersCount >= 1)
      .map((c) => {
        const avgWr = c.winRates.length > 0
          ? Math.round((c.winRates.reduce((a, b) => a + b, 0) / c.winRates.length) * 10) / 10
          : 0;

        const nowSec = Math.floor(Date.now() / 1000);
        const buyTs = c.lastBoughtTimestamp > 1e11
          ? Math.floor(c.lastBoughtTimestamp / 1000)
          : (c.lastBoughtTimestamp || nowSec);
        const diffSec = Math.max(60, nowSec - buyTs);
        const ageMinutes = Math.max(1, Math.round(diffSec / 60));
        const ageHours = Math.round((ageMinutes / 60) * 10) / 10;

        const formatAge = (min) => {
          if (!min || min <= 0) return 'Just now';
          if (min < 60) return `${min}m`;
          const hrs = Math.round((min / 60) * 10) / 10;
          if (hrs < 24) return `${hrs}h`;
          const days = Math.floor(hrs / 24);
          return `${days}d`;
        };

        return {
          ...c,
          entryMcap: c.minEntryMcap ?? c.entryMcap,
          avgWinRate: avgWr,
          ageMinutes,
          ageHours,
          ageDisplay: formatAge(ageMinutes),
          isEarly: (c.minEntryMcap != null && c.minEntryMcap < 500000) || (c.entryMcap != null && c.entryMcap < 500000),
        };
      });
  }, [smartWallets, kolWallets]);

  // Filter recent coins
  const filterCoins = (list) => {
    let res = list || [];

    // 0. Max Token Age (Hours) filter: if maxAgeHours > 0, filter c.ageHours <= maxAgeHours
    if (maxAgeHours > 0) {
      res = res.filter((c) => (c.ageHours || 0) <= maxAgeHours);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      res = res.filter((c) =>
        c.symbol?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      );
    }

    if (maxEntryMcap !== null && maxEntryMcap !== '' && !isNaN(Number(maxEntryMcap))) {
      const threshold = Number(maxEntryMcap) * 1000;
      res = res.filter((c) => {
        if (c.entryMcap == null) return true;
        return c.entryMcap <= threshold;
      });
    }

    if (minWinRate != null && !isNaN(Number(minWinRate)) && Number(minWinRate) > 0) {
      const minWr = Number(minWinRate);
      res = res.filter((c) => (Number(c.avgWinRate) || 0) >= minWr);
    }

    if (minRealizedPnl != null && !isNaN(Number(minRealizedPnl)) && Number(minRealizedPnl) > 0) {
      const minVol = Number(minRealizedPnl);
      res = res.filter((c) => (Number(c.totalBoughtUsd) || 0) >= minVol);
    }

    return res;
  };

  // Sort recent coins
  const sortCoins = (list) => {
    const copy = [...list];
    switch (sortBy) {
      case 'smart_count':
        return copy.sort((a, b) => b.smartBuyersCount - a.smartBuyersCount || b.lastBoughtTimestamp - a.lastBoughtTimestamp);
      case 'kol_count':
        return copy.sort((a, b) => b.kolBuyersCount - a.kolBuyersCount || b.lastBoughtTimestamp - a.lastBoughtTimestamp);
      case 'win_rate':
        return copy.sort((a, b) => (b.avgWinRate || 0) - (a.avgWinRate || 0));
      case 'realized_pnl':
      case 'volume':
        return copy.sort((a, b) => (b.totalBoughtUsd || 0) - (a.totalBoughtUsd || 0));
      case 'entry_mcap':
        return copy.sort((a, b) => (a.entryMcap || 999999999) - (b.entryMcap || 999999999));
      case 'last_active':
      case 'recent':
      default:
        // Dual Sorting Rule (User Spec):
        // If maxAgeHours > 0: Ranked by number of high KOL or Smart bought
        // If maxAgeHours === 0: Ranked by low age of tokens (lowest age first)
        if (maxAgeHours > 0) {
          return copy.sort((a, b) => {
            const buyersB = (b.smartBuyersCount || 0) + (b.kolBuyersCount || 0);
            const buyersA = (a.smartBuyersCount || 0) + (a.kolBuyersCount || 0);
            if (buyersB !== buyersA) return buyersB - buyersA;
            return (a.ageMinutes || 0) - (b.ageMinutes || 0);
          });
        }
        return copy.sort((a, b) => {
          if ((a.ageMinutes || 0) !== (b.ageMinutes || 0)) return (a.ageMinutes || 0) - (b.ageMinutes || 0);
          const buyersB = (b.smartBuyersCount || 0) + (b.kolBuyersCount || 0);
          const buyersA = (a.smartBuyersCount || 0) + (a.kolBuyersCount || 0);
          return buyersB - buyersA;
        });
    }
  };

  const allFilteredCoins = useMemo(() => sortCoins(filterCoins(aggregatedCoins)), [
    aggregatedCoins,
    search,
    sortBy,
    maxAgeHours,
    maxEntryMcap,
    minWinRate,
    minRealizedPnl,
  ]);

  const smartCoinsFiltered = useMemo(() => allFilteredCoins.filter((c) => c.isSmartBought), [allFilteredCoins]);
  const kolCoinsFiltered = useMemo(() => allFilteredCoins.filter((c) => c.isKolBought), [allFilteredCoins]);

  // Render recent coins table (purely tokens, zero wallet addresses)
  const renderRecentCoinsTable = (coinsList, sectionTitle, badgeBg, badgeBorder, badgeText, gmgnTab, emptyMsg) => {
    return (
      <div className="bg-[#0e131d] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-gradient-to-r from-[#0d1422] to-[#0e131d]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white flex items-center gap-1.5">
                {sectionTitle}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold ${badgeBg} ${badgeText} border ${badgeBorder}`}>
                {coinsList.length} Coins Found
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Recent Solana tokens entered by verified on-chain traders. Filtered by early entry (<span className="text-emerald-400 font-semibold">&lt;$500k MC</span>) and anti-scam vetoes.
            </p>
          </div>

          <span className="text-[11px] text-slate-500 font-mono shrink-0">
            Source: <strong className="text-slate-300">GMGN {gmgnTab}</strong>
          </span>
        </div>

        {coinsList.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
            <span className="text-2xl">🪙</span>
            <span className="text-xs font-semibold text-slate-400">{emptyMsg}</span>
            <button
              onClick={handleScanNewlyCoins}
              className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/40 transition-all"
            >
              Click to Scan Newly Coins
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#090d15] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-4 min-w-[240px]">Token (CA &amp; Launchpad)</th>
                  <th className="py-3 px-3 min-w-[110px]">Token Age</th>
                  <th className="py-3 px-3 min-w-[130px]">Smart Buyers</th>
                  <th className="py-3 px-3 min-w-[120px]">KOL Buyers</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Entry MCap</th>
                  <th className="py-3 px-4 text-right min-w-[130px]">Price / MCap</th>
                  <th className="py-3 px-4 text-right min-w-[130px]">Total Bought USD</th>
                  <th className="py-3 px-3 min-w-[110px]">Buyers Win Rate</th>
                  <th className="py-3 px-3 min-w-[110px]">Last Bought</th>
                  <th className="py-3 px-4 text-center min-w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {coinsList.map((c, idx) => {
                  const rankNum = idx + 1;
                  const isTop = rankNum <= 3;
                  const isCopied = copiedTokenCa === c.address;

                  return (
                    <tr key={c.address} className="hover:bg-slate-800/30 transition-colors group">
                      {/* Rank */}
                      <td className="py-3 px-3 text-center font-mono">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                            rankNum === 1
                              ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm'
                              : rankNum === 2
                              ? 'bg-slate-300/20 text-slate-200 border border-slate-400/40'
                              : rankNum === 3
                              ? 'bg-amber-700/20 text-amber-500 border border-amber-600/40'
                              : 'text-slate-500'
                          }`}
                        >
                          {rankNum}
                        </span>
                      </td>

                      {/* Token info: Symbol, Name, CA, Launchpad */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600/40 to-purple-600/40 border border-cyan-500/30 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">
                            {c.symbol ? c.symbol.slice(0, 2).toUpperCase() : '🪙'}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onInspectCoin && onInspectCoin({
                                  address: c.address,
                                  symbol: c.symbol,
                                  name: c.name,
                                  price: c.price,
                                  mktCapK: c.entryMcap ? c.entryMcap / 1000 : 0,
                                })}
                                className="font-extrabold text-white text-sm hover:text-cyan-300 transition-colors truncate text-left"
                              >
                                ${c.symbol}
                              </button>

                              {c.isPump ? (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 shrink-0">
                                  ⚡ Pump.fun
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 shrink-0">
                                  🦅 Raydium
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                              <span className="text-slate-400 truncate max-w-[130px]">
                                {c.name || c.symbol}
                              </span>

                              <span className="text-slate-600">•</span>

                              <button
                                onClick={(e) => handleCopyTokenCa(c.address, e)}
                                title="Copy Token CA"
                                className={`font-mono text-[10px] transition-colors flex items-center gap-1 ${
                                  isCopied ? 'text-emerald-300 font-bold' : 'text-slate-400 hover:text-cyan-300'
                                }`}
                              >
                                <span>{c.address ? `${c.address.slice(0, 4)}...${c.address.slice(-4)}` : 'CA'}</span>
                                <span>{isCopied ? '✓' : '📋'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Token Age */}
                      <td className="py-3 px-3 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${
                          (c.ageMinutes || 0) <= 15
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40 shadow-sm animate-pulse'
                            : (c.ageMinutes || 0) <= 60
                            ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                            : (c.ageHours || 0) <= 3
                            ? 'bg-purple-950/50 text-purple-300 border-purple-500/30'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700'
                        }`}>
                          <span>⏱️</span>
                          <span>{c.ageDisplay || formatTimeAgo(c.lastBoughtTimestamp)}</span>
                        </span>
                      </td>

                      {/* Smart Buyers */}
                      <td className="py-3 px-3">
                        {c.smartBuyersCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            🧠 {c.smartBuyersCount} Smart
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">--</span>
                        )}
                      </td>

                      {/* KOL Buyers */}
                      <td className="py-3 px-3">
                        {c.kolBuyersCount > 0 ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            📢 {c.kolBuyersCount} KOL
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">--</span>
                        )}
                      </td>

                      {/* Entry MCap */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-slate-100 text-xs">
                            ${formatKMB(c.entryMcap)}
                          </span>
                          {c.isEarly ? (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                              ⚡ &lt;$500k Early
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Established</span>
                          )}
                        </div>
                      </td>

                      {/* Price / MCap */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-cyan-300 text-xs">
                            {formatPrice(c.price)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            MC: ${formatKMB(c.marketCap || c.entryMcap)}
                          </span>
                        </div>
                      </td>

                      {/* Total Bought USD */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-emerald-400 text-xs">
                            +${formatKMB(c.totalBoughtUsd)}
                          </span>
                          <span className="text-[10px] text-slate-500">Tracked Buy Vol</span>
                        </div>
                      </td>

                      {/* Buyers Win Rate */}
                      <td className="py-3 px-3 font-mono">
                        {c.avgWinRate > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className={`text-xs font-bold ${
                              c.avgWinRate >= 60
                                ? 'text-emerald-400'
                                : c.avgWinRate >= 40
                                ? 'text-cyan-400'
                                : 'text-slate-300'
                            }`}>
                              {c.avgWinRate}% WR
                            </span>
                            <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  c.avgWinRate >= 60
                                    ? 'bg-emerald-400'
                                    : c.avgWinRate >= 40
                                    ? 'bg-cyan-400'
                                    : 'bg-slate-500'
                                }`}
                                style={{ width: `${Math.min(100, c.avgWinRate)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">Fresh (0%)</span>
                        )}
                      </td>

                      {/* Last Bought */}
                      <td className="py-3 px-3 font-mono text-slate-300 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">⏱️</span>
                          <span>{formatTimeAgo(c.lastBoughtTimestamp)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => {
                              soundFX.playTradeSuccess();
                              addNotification({
                                type: 'info',
                                text: `Opening trading portal for $${c.symbol}...`,
                              });
                              if (onInspectCoin) {
                                onInspectCoin({
                                  address: c.address,
                                  symbol: c.symbol,
                                  name: c.name,
                                  price: c.price,
                                  mktCapK: c.entryMcap ? c.entryMcap / 1000 : 0,
                                });
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-all flex items-center gap-1 shadow-sm"
                          >
                            <span>⚡</span>
                            <span>Buy</span>
                          </button>

                          <button
                            onClick={() => onInspectCoin && onInspectCoin({
                              address: c.address,
                              symbol: c.symbol,
                              name: c.name,
                              price: c.price,
                              mktCapK: c.entryMcap ? c.entryMcap / 1000 : 0,
                            })}
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-all"
                            title="Inspect Token Details"
                          >
                            🔍
                          </button>

                          <a
                            href={`https://dexscreener.com/solana/${c.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-1.5 py-1 rounded text-slate-400 hover:text-cyan-300 transition-colors"
                            title="DexScreener Chart"
                          >
                            🦅
                          </a>

                          <a
                            href={`https://gmgn.ai/sol/token/${c.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-1.5 py-1 rounded text-slate-400 hover:text-emerald-300 transition-colors font-bold text-[11px]"
                            title="GMGN Chart"
                          >
                            GMGN↗
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-fadeIn pb-16">
      {/* ── Top Header Banner & Actions ── */}
      <div className="bg-gradient-to-r from-[#0c1018] via-[#101726] to-[#1e1738] border border-cyan-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
                🎯 Wallets Radar
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                2-Section GMGN Ranking
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Newly Launched Coins Focus
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1.5 max-w-3xl leading-relaxed">
              Automated GMGN on-chain trader breakdown extracting Smart Money and KOL traders across newly launched Solana meme coins. Wallets are ranked purely by early entry timing (<span className="text-emerald-400 font-semibold">&lt;$500k MC</span>), 7D win rate, realized PnL, volume, and newly coins entered count.
            </p>

            {/* Quick Telemetry Chips */}
            <div className="flex items-center gap-2.5 mt-3 flex-wrap text-[11px] font-mono">
              <span className="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700">
                🪙 Newly Coins: <strong className="text-cyan-400">{stats.totalCoinsScanned || newlyCoinsTotal(smartWallets, kolWallets)}</strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700">
                🧠 Smart Money: <strong className="text-emerald-400">{smartWallets.length}</strong>
              </span>
              <span className="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-300 border border-slate-700">
                📢 Verified KOLs: <strong className="text-purple-400">{kolWallets.length}</strong>
              </span>
              {stats.lastScanTime && (
                <span className="px-2 py-1 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700">
                  🕒 Updated: {formatTimeAgo(stats.lastScanTime)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
            {/* Scan Newly Coins button */}
            <button
              onClick={handleScanNewlyCoins}
              disabled={scanning}
              className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scanning Newly Coins...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Scan Newly Coins
                </>
              )}
            </button>

            {/* Export Excel (.xlsx) */}
            <a
              href={api.getRadarExportUrl()}
              download
              className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
            >
              <span>📥</span>
              Export Excel (.xlsx)
            </a>
          </div>
        </div>
      </div>

      {/* ── View Mode Switcher: Recent Coins (Default) vs Wallet Telemetry ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#10141e] border border-cyan-500/30 rounded-xl p-2.5 shadow-lg">
        <div className="flex items-center bg-[#090d15] p-1 rounded-xl border border-slate-800 text-xs font-semibold w-full sm:w-auto">
          <button
            onClick={() => {
              soundFX.playClick(1.05);
              setViewMode('recent_coins');
              if (sortBy === 'rank') setSortBy('recent');
            }}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              viewMode === 'recent_coins'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 font-bold border border-cyan-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🪙</span>
            <span>Recent Coins Bought ({allFilteredCoins.length})</span>
          </button>
          <button
            onClick={() => {
              soundFX.playClick(1.05);
              setViewMode('wallets');
              if (sortBy === 'recent') setSortBy('rank');
            }}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              viewMode === 'wallets'
                ? 'bg-slate-700/70 text-slate-200 font-bold border border-slate-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>👛</span>
            <span>Wallet Telemetry ({smartWallets.length + kolWallets.length})</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {viewMode === 'recent_coins'
              ? `Displaying ${allFilteredCoins.length} tokens bought by Smart & KOL wallets (Zero wallet addresses)`
              : `Displaying ${filteredSmart.length + filteredKol.length} verified wallet profiles`}
          </span>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#10141e] border border-slate-800/90 rounded-xl p-3 shadow-lg">
        {/* Search bar */}
        <div className="flex items-center gap-2 flex-1 max-w-lg bg-[#090d15] border border-slate-800 rounded-lg px-3 py-2">
          <span className="text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              viewMode === 'recent_coins'
                ? "Search by coin symbol, name, or token CA (e.g. $JUST, Ation, pump)..."
                : "Search wallet address, name, or token symbol (e.g. $JUST, PUMP)..."
            }
            className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-500 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-300 text-xs px-1">
              ✕
            </button>
          )}
        </div>

        {/* Section View Tabs & Sort Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Section View switcher */}
          <div className="flex items-center bg-[#090d15] p-1 rounded-lg border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveSection('all')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeSection === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Sections
            </button>
            <button
              onClick={() => setActiveSection('smart')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeSection === 'smart'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🧠 Smart Money ({viewMode === 'recent_coins' ? smartCoinsFiltered.length : smartWallets.length})
            </button>
            <button
              onClick={() => setActiveSection('kol')}
              className={`px-3 py-1 rounded-md transition-all ${
                activeSection === 'kol'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📢 KOL ({viewMode === 'recent_coins' ? kolCoinsFiltered.length : kolWallets.length})
            </button>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-[#090d15] border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent border-none text-slate-300 outline-none cursor-pointer text-xs"
            >
              {viewMode === 'recent_coins' ? (
                <>
                  <option value="recent">Most Recent Buy</option>
                  <option value="smart_count">Most Smart Buyers</option>
                  <option value="kol_count">Most KOL Buyers</option>
                  <option value="entry_mcap">Lowest Entry MC</option>
                  <option value="volume">Highest Bought Vol ($)</option>
                  <option value="win_rate">Highest Win Rate (%)</option>
                </>
              ) : (
                <>
                  <option value="rank">Rank (Score)</option>
                  <option value="win_rate">Win Rate 7D</option>
                  <option value="realized_pnl">Realized PnL ($)</option>
                  <option value="coins_count">Newly Coins Count</option>
                  <option value="last_active">Last Active</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* ── Interactive Radar Filters Bar: Max Token Age, Early MC, 7D Win Rate, Realized PnL ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121c] border border-cyan-500/20 rounded-xl p-3 shadow-md">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {/* Max Token Age Pill Selector (User Spec: 0 = lowest age first with >=1 smart/kol; >0 = <=X hours ranked by smart+kol buyers count) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1">
              <span>⏱️</span> Max Token Age:
            </span>
            <div className="flex items-center bg-[#090d15] p-0.5 rounded-lg border border-slate-800 text-[11px]">
              {[
                { label: '0 (All - Lowest Age)', value: 0 },  // Default active
                { label: '< 1h',  value: 1 },
                { label: '< 3h',  value: 3 },
                { label: '< 6h',  value: 6 },
                { label: '< 12h', value: 12 },
                { label: '< 24h', value: 24 },
              ].map((pill) => {
                const active = maxAgeHours === pill.value;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => {
                      soundFX.playClick(1.05);
                      setMaxAgeHours(pill.value);
                    }}
                    className={`px-2 py-0.5 rounded transition-all font-mono ${
                      active
                        ? 'bg-purple-500/25 text-purple-300 font-bold border border-purple-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Max Entry MC Pill Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1">
              <span>📉</span> Max Entry MC:
            </span>
            <div className="flex items-center bg-[#090d15] p-0.5 rounded-lg border border-slate-800 text-[11px]">
              {[
                { label: '<$100k', value: 100 },
                { label: '<$250k', value: 250 },
                { label: '<$500k', value: 500 }, // Default active
                { label: '<$1M',   value: 1000 },
                { label: 'All',    value: null },
              ].map((pill) => {
                const active = maxEntryMcap === pill.value;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => {
                      soundFX.playClick(1.05);
                      setMaxEntryMcap(pill.value);
                    }}
                    className={`px-2 py-0.5 rounded transition-all font-mono ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Min 7D Win Rate Pill Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1">
              <span>🎯</span> Min 7D Win Rate:
            </span>
            <div className="flex items-center bg-[#090d15] p-0.5 rounded-lg border border-slate-800 text-[11px]">
              {[
                { label: '0%',  value: 0 },  // Default active
                { label: '30%', value: 30 },
                { label: '50%', value: 50 },
                { label: '60%', value: 60 },
                { label: '70%', value: 70 },
              ].map((pill) => {
                const active = minWinRate === pill.value;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => {
                      soundFX.playClick(1.05);
                      setMinWinRate(pill.value);
                    }}
                    className={`px-2 py-0.5 rounded transition-all font-mono ${
                      active
                        ? 'bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Min Realized PnL Pill Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1">
              <span>💰</span> Min Realized PnL:
            </span>
            <div className="flex items-center bg-[#090d15] p-0.5 rounded-lg border border-slate-800 text-[11px]">
              {[
                { label: '$0',    value: 0 },    // Default active
                { label: '+$100', value: 100 },
                { label: '+$500', value: 500 },
                { label: '+$1K',  value: 1000 },
                { label: '+$5K',  value: 5000 },
              ].map((pill) => {
                const active = minRealizedPnl === pill.value;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => {
                      soundFX.playClick(1.05);
                      setMinRealizedPnl(pill.value);
                    }}
                    className={`px-2 py-0.5 rounded transition-all font-mono ${
                      active
                        ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right side: Dual Priority Mode Indicator, Anti-scam badge, and Reset Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {maxAgeHours === 0 ? (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              ⚡ Priority: Lowest Age First (≥1 Smart/KOL)
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              🎯 Filtered: ≤{maxAgeHours}h Age • Ranked by High Smart/KOL Buyers
            </span>
          )}

          <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-red-950/40 text-red-300 border border-red-500/30 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            🛡️ Bundlers &amp; Rat-Traders Filtered
          </span>

          {(maxAgeHours !== 0 || maxEntryMcap !== 500 || minWinRate !== 0 || minRealizedPnl !== 0) && (
            <button
              type="button"
              onClick={() => {
                soundFX.playClick(1.1);
                setMaxAgeHours(0);
                setMaxEntryMcap(500);
                setMinWinRate(0);
                setMinRealizedPnl(0);
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-cyan-300 border border-slate-700 hover:bg-slate-700 transition-all"
            >
              ↺ Reset Defaults (0 Age, &lt;$500k, 0%, $0)
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-300">Loading verified Smart Money &amp; KOL wallets...</span>
          <span className="text-xs text-slate-500">Extracting on-chain telemetry from newly launched Solana meme coins</span>
        </div>
      ) : viewMode === 'recent_coins' ? (
        <div className="flex flex-col gap-8">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: RECENT COINS BOUGHT BY SMART MONEY                   */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(activeSection === 'all' || activeSection === 'smart') && (
            renderRecentCoinsTable(
              smartCoinsFiltered,
              '🧠 Section 1: Recent Coins Bought by Smart Money',
              'bg-emerald-500/20',
              'border-emerald-500/40',
              'text-emerald-300',
              'Smart',
              'No recent coins bought by Smart Money matching current filters.'
            )
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: RECENT COINS BOUGHT BY KOL WALLETS                   */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(activeSection === 'all' || activeSection === 'kol') && (
            renderRecentCoinsTable(
              kolCoinsFiltered,
              '📢 Section 2: Recent Coins Bought by KOL Wallets',
              'bg-purple-500/20',
              'border-purple-500/40',
              'text-purple-300',
              'KOL',
              'No recent coins bought by KOLs matching current filters.'
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: SMART MONEY WALLETS                                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(activeSection === 'all' || activeSection === 'smart') && (
            <div className="bg-[#0e131d] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-gradient-to-r from-[#0d1422] to-[#0e131d]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-white flex items-center gap-1.5">
                      🧠 Section 1: Smart Money Wallets
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {filteredSmart.length} Qualified
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ranked by early entry MC (<span className="text-emerald-400 font-semibold">&lt;$500k</span>), 7D win rate, realized PnL, and newly launched coins entered. Strictly filtered against bundlers &amp; rat-traders.
                  </p>
                </div>

                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  GMGN Tab: <strong className="text-slate-300">Smart</strong>
                </span>
              </div>

              {filteredSmart.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">📡</span>
                  <span className="text-xs font-semibold text-slate-400">No Smart Money wallets matching current criteria</span>
                  <button
                    onClick={handleScanNewlyCoins}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/40 transition-all"
                  >
                    Click to Scan Newly Coins
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#090d15] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-3 text-center w-12">#</th>
                        <th className="py-3 px-3 text-center w-12">Star</th>
                        <th className="py-3 px-4 min-w-[200px]">Wallet</th>
                        <th className="py-3 px-3 text-center">Score</th>
                        <th className="py-3 px-3 min-w-[120px]">SOL Bal / Active</th>
                        <th className="py-3 px-3 text-center">Created</th>
                        <th className="py-3 px-4 min-w-[220px]">Newly Coins Entered</th>
                        <th className="py-3 px-4 text-right min-w-[130px]">Bought / Avg MC</th>
                        <th className="py-3 px-4 text-right min-w-[130px]">Sold / Avg MC</th>
                        <th className="py-3 px-3 min-w-[110px]">Win Rate 7D</th>
                        <th className="py-3 px-4 text-right min-w-[130px]">Realized PnL</th>
                        <th className="py-3 px-3 text-right">Remaining</th>
                        <th className="py-3 px-3">Funding</th>
                        <th className="py-3 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-xs">
                      {filteredSmart.map((w, idx) => {
                        const rankNum = w.rank || (idx + 1);
                        const isTop = rankNum <= 3;
                        const score = Number(w.score || 0);

                        return (
                          <tr key={w.wallet_address} className="hover:bg-slate-800/30 transition-colors group">
                            {/* Rank */}
                            <td className="py-3 px-3 text-center font-mono font-bold">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                                  rankNum === 1
                                    ? 'bg-amber-400 text-black font-extrabold shadow-md shadow-amber-400/30'
                                    : rankNum === 2
                                    ? 'bg-slate-300 text-black font-bold'
                                    : rankNum === 3
                                    ? 'bg-amber-700/80 text-amber-200 font-bold'
                                    : 'text-slate-500'
                                }`}
                              >
                                {rankNum}
                              </span>
                            </td>

                            {/* Star button */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleToggleStar(w.wallet_address)}
                                className={`text-sm transition-transform active:scale-125 ${
                                  w.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                                }`}
                                title={w.is_starred ? 'Starred' : 'Star this wallet'}
                              >
                                {w.is_starred ? '★' : '☆'}
                              </button>
                            </td>

                            {/* Wallet Info (Avatar, Name/Address, Badges) */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                  {w.avatar ? (
                                    <img src={w.avatar} alt="avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-mono font-bold text-cyan-400">
                                      {w.wallet_address.slice(0, 2)}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-white text-xs hover:text-cyan-400 transition-colors">
                                      {w.name || `${w.wallet_address.slice(0, 4)}...${w.wallet_address.slice(-4)}`}
                                    </span>
                                    <button
                                      onClick={() => handleCopy(w.wallet_address)}
                                      className="text-slate-500 hover:text-slate-300 text-[10px] px-1 py-0.5 rounded bg-slate-800/80 transition-colors"
                                      title="Copy full address"
                                    >
                                      {copiedAddr === w.wallet_address ? '✓ Copied' : '📋'}
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                      Smart Money
                                    </span>
                                    {w.tags && w.tags.slice(0, 2).map((t, ti) => (
                                      <span
                                        key={ti}
                                        className="px-1 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold font-mono ${
                                  score >= 90
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                    : score >= 80
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                }`}
                              >
                                {score}
                              </span>
                            </td>

                            {/* SOL Balance & Last Active */}
                            <td className="py-3 px-3 font-mono text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-cyan-400 font-bold">
                                  {w.sol_balance != null ? `${w.sol_balance} SOL` : '--'}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {w.last_active_display || formatTimeAgo(w.last_active_timestamp)}
                                </span>
                              </div>
                            </td>

                            {/* Wallet Created */}
                            <td className="py-3 px-3 text-center font-mono text-slate-400 text-xs">
                              {w.wallet_age_display || formatWalletAge(w.wallet_created_at)}
                            </td>

                            {/* Newly Coins Entered */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-white">
                                    {w.coins_count || (w.coins_entered ? w.coins_entered.length : 0)} coins
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                  {Array.isArray(w.coins_entered) && w.coins_entered.length > 0 ? (
                                    w.coins_entered.slice(0, 4).map((c, ci) => (
                                      <button
                                        key={ci}
                                        onClick={() => onInspectCoin && onInspectCoin({ address: c.address, symbol: c.symbol, name: c.name })}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#141b29] hover:bg-cyan-900/30 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition-all active:scale-95"
                                        title={`Entry MC: $${c.entryMcap ? Math.round(c.entryMcap / 1000) + 'k' : '--'}`}
                                      >
                                        <span className="font-bold">${c.symbol}</span>
                                        <span className="text-slate-400 text-[9px]">
                                          {c.entryMcap ? `$${Math.round(c.entryMcap / 1000)}k` : ''}
                                        </span>
                                      </button>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-mono">--</span>
                                  )}
                                  {w.coins_entered && w.coins_entered.length > 4 && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      +{w.coins_entered.length - 4} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Bought / Avg MC */}
                            <td className="py-3 px-4 text-right font-mono">
                              <div className="text-emerald-400 font-bold text-xs">
                                {w.bought_usd ? `$${(w.bought_usd / 1000).toFixed(2)}K` : '--'}
                                {w.avg_buy_mc ? ` / $${Math.round(w.avg_buy_mc / 1000)}K` : ''}
                              </div>
                              <div className="text-slate-500 text-[10px]">
                                {w.total_buy_tokens ? `${formatTokensAmount(w.total_buy_tokens)}` : ''}
                                {w.total_buy_tokens && w.total_buy_txs ? ' / ' : ''}
                                {w.total_buy_txs ? `${w.total_buy_txs} TXs` : ''}
                                {!w.total_buy_tokens && !w.total_buy_txs && (w.avg_buy_mc ? `$${Math.round(w.avg_buy_mc / 1000)}K MC` : '--')}
                              </div>
                            </td>

                            {/* Sold / Avg MC */}
                            <td className="py-3 px-4 text-right font-mono">
                              <div className="text-rose-400 font-bold text-xs">
                                {w.sold_usd ? `$${(w.sold_usd / 1000).toFixed(2)}K` : '--'}
                                {w.sold_usd && w.avg_sold_mc ? ` / $${Math.round(w.avg_sold_mc / 1000)}K` : ''}
                              </div>
                              <div className="text-slate-500 text-[10px]">
                                {w.sold_usd ? (
                                  <>
                                    {w.total_sold_tokens ? `${formatTokensAmount(w.total_sold_tokens)}` : ''}
                                    {w.total_sold_tokens && w.total_sold_txs ? ' / ' : ''}
                                    {w.total_sold_txs ? `${w.total_sold_txs} TXs` : ''}
                                    {!w.total_sold_tokens && !w.total_sold_txs && (w.avg_sold_mc ? `$${Math.round(w.avg_sold_mc / 1000)}K MC` : '--')}
                                  </>
                                ) : (
                                  'Holding'
                                )}
                              </div>
                            </td>

                            {/* Win Rate 7D */}
                            <td className="py-3 px-3 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold ${w.win_rate_7d >= 70 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                  {w.win_rate_7d != null ? `${w.win_rate_7d}%` : '--'}
                                </span>
                                {w.win_rate_7d != null && (
                                  <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                                    <div
                                      className={`h-full ${w.win_rate_7d >= 70 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                                      style={{ width: `${Math.min(100, w.win_rate_7d)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Realized PnL */}
                            <td className="py-3 px-4 text-right font-mono">
                              <div className="font-extrabold text-emerald-400 text-xs">
                                {w.realized_pnl_usd != null ? `+$${Number(w.realized_pnl_usd).toLocaleString()}` : '--'}
                              </div>
                              {w.realized_pnl_percent != null && (
                                <div className="text-emerald-500 text-[10px]">
                                  +{w.realized_pnl_percent}%
                                </div>
                              )}
                            </td>

                            {/* Remaining USD */}
                            <td className="py-3 px-3 text-right font-mono text-slate-300 text-xs">
                              <div>{w.remaining_usd != null ? `$${w.remaining_usd}` : '$0'}</div>
                              <div className="text-slate-500 text-[10px]">{w.remaining_percent || 0}%</div>
                            </td>

                            {/* Funding Source */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                              <div className="flex items-center gap-1">
                                {w.funding_source ? (
                                  <span title={w.funding_source}>
                                    {w.funding_source.length > 8 ? `${w.funding_source.slice(0, 4)}...${w.funding_source.slice(-4)}` : w.funding_source}
                                  </span>
                                ) : (
                                  '--'
                                )}
                                {w.funding_source && w.wallet_age_display && (
                                  <span className="text-slate-500 text-[10px]">/ {w.wallet_age_display}</span>
                                )}
                              </div>
                              {w.funding_amount != null && (
                                <div className="text-slate-500 text-[10px]">◎ {w.funding_amount}</div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <a
                                  href={`https://gmgn.ai/sol/address/${w.wallet_address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-900/40 text-cyan-300 border border-slate-700 transition-colors"
                                  title="View on GMGN"
                                >
                                  GMGN ↗
                                </a>
                                <a
                                  href={`https://solscan.io/account/${w.wallet_address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-purple-900/40 text-purple-300 border border-slate-700 transition-colors"
                                  title="View on Solscan"
                                >
                                  Solscan ↗
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: KOL WALLETS                                          */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {(activeSection === 'all' || activeSection === 'kol') && (
            <div className="bg-[#0e131d] border border-slate-800/90 rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-gradient-to-r from-[#140f29] to-[#0e131d]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-white flex items-center gap-1.5">
                      📢 Section 2: KOL Wallets
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {filteredKol.length} Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Ranked by recent activity on newly launched coins, entry speed, volume, win rate, and influencer social tags.
                  </p>
                </div>

                <span className="text-[11px] text-slate-500 font-mono shrink-0">
                  GMGN Tab: <strong className="text-slate-300">KOL</strong>
                </span>
              </div>

              {filteredKol.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
                  <span className="text-2xl">📢</span>
                  <span className="text-xs font-semibold text-slate-400">No KOL wallets matching current criteria</span>
                  <button
                    onClick={handleScanNewlyCoins}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/40 transition-all"
                  >
                    Click to Scan Newly Coins
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#090d15] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-3 text-center w-12">#</th>
                        <th className="py-3 px-3 text-center w-12">Star</th>
                        <th className="py-3 px-4 min-w-[200px]">KOL Identity</th>
                        <th className="py-3 px-3 text-center">Score</th>
                        <th className="py-3 px-3 min-w-[120px]">SOL Bal / Active</th>
                        <th className="py-3 px-3 text-center">Created</th>
                        <th className="py-3 px-4 min-w-[220px]">Newly Coins Entered</th>
                        <th className="py-3 px-4 text-right min-w-[130px]">Bought / Avg MC</th>
                        <th className="py-3 px-4 text-right min-w-[130px]">Sold / Avg MC</th>
                        <th className="py-3 px-3 min-w-[110px]">Win Rate</th>
                        <th className="py-3 px-4 text-right min-w-[130px]">Realized PnL</th>
                        <th className="py-3 px-3 text-right">Remaining</th>
                        <th className="py-3 px-3">Funding</th>
                        <th className="py-3 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-xs">
                      {filteredKol.map((w, idx) => {
                        const rankNum = w.rank || (idx + 1);
                        const score = Number(w.score || 0);

                        return (
                          <tr key={w.wallet_address} className="hover:bg-slate-800/30 transition-colors group">
                            {/* Rank */}
                            <td className="py-3 px-3 text-center font-mono font-bold">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                                  rankNum === 1
                                    ? 'bg-purple-400 text-black font-extrabold shadow-md shadow-purple-400/30'
                                    : rankNum === 2
                                    ? 'bg-slate-300 text-black font-bold'
                                    : rankNum === 3
                                    ? 'bg-amber-700/80 text-amber-200 font-bold'
                                    : 'text-slate-500'
                                }`}
                              >
                                {rankNum}
                              </span>
                            </td>

                            {/* Star button */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleToggleStar(w.wallet_address)}
                                className={`text-sm transition-transform active:scale-125 ${
                                  w.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                                }`}
                                title={w.is_starred ? 'Starred' : 'Star this wallet'}
                              >
                                {w.is_starred ? '★' : '☆'}
                              </button>
                            </td>

                            {/* KOL Identity (Avatar, Name / Twitter, Badge) */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-800 border border-purple-500/40 flex items-center justify-center overflow-hidden shrink-0">
                                  {w.avatar ? (
                                    <img src={w.avatar} alt="avatar" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-mono font-bold text-purple-400">
                                      {w.twitter_username ? w.twitter_username.slice(0, 2).toUpperCase() : 'KOL'}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-white text-xs hover:text-purple-400 transition-colors">
                                      {w.twitter_username ? `@${w.twitter_username}` : (w.name || `${w.wallet_address.slice(0, 4)}...${w.wallet_address.slice(-4)}`)}
                                    </span>
                                    <button
                                      onClick={() => handleCopy(w.wallet_address)}
                                      className="text-slate-500 hover:text-slate-300 text-[10px] px-1 py-0.5 rounded bg-slate-800/80 transition-colors"
                                      title="Copy full address"
                                    >
                                      {copiedAddr === w.wallet_address ? '✓ Copied' : '📋'}
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                      KOL
                                    </span>
                                    {w.tags && w.tags.slice(0, 2).map((t, ti) => (
                                      <span
                                        key={ti}
                                        className="px-1 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-300 border border-slate-700"
                                      >
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold font-mono ${
                                  score >= 90
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                }`}
                              >
                                {score}
                              </span>
                            </td>

                            {/* SOL Balance & Last Active */}
                            <td className="py-3 px-3 font-mono text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-purple-400 font-bold">
                                  {w.sol_balance != null ? `${w.sol_balance} SOL` : '--'}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {w.last_active_display || formatTimeAgo(w.last_active_timestamp)}
                                </span>
                              </div>
                            </td>

                            {/* Wallet Created */}
                            <td className="py-3 px-3 text-center font-mono text-slate-400 text-xs">
                              {w.wallet_age_display || formatWalletAge(w.wallet_created_at)}
                            </td>

                            {/* Newly Coins Entered */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-bold text-white">
                                    {w.coins_count || (w.coins_entered ? w.coins_entered.length : 0)} coins
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                  {Array.isArray(w.coins_entered) && w.coins_entered.length > 0 ? (
                                    w.coins_entered.slice(0, 4).map((c, ci) => (
                                      <button
                                        key={ci}
                                        onClick={() => onInspectCoin && onInspectCoin({ address: c.address, symbol: c.symbol, name: c.name })}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#141b29] hover:bg-purple-900/30 text-purple-300 border border-slate-700 hover:border-purple-500/50 transition-all active:scale-95"
                                        title={`Entry MC: $${c.entryMcap ? Math.round(c.entryMcap / 1000) + 'k' : '--'}`}
                                      >
                                        <span className="font-bold">${c.symbol}</span>
                                        <span className="text-slate-400 text-[9px]">
                                          {c.entryMcap ? `$${Math.round(c.entryMcap / 1000)}k` : ''}
                                        </span>
                                      </button>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-slate-500 font-mono">--</span>
                                  )}
                                  {w.coins_entered && w.coins_entered.length > 4 && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      +{w.coins_entered.length - 4} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Bought / Avg MC */}
                            <td className="py-3 px-4 text-right font-mono">
                              <div className="text-purple-300 font-bold text-xs">
                                {w.bought_usd ? `$${(w.bought_usd / 1000).toFixed(2)}K` : '--'}
                                {w.avg_buy_mc ? ` / $${Math.round(w.avg_buy_mc / 1000)}K` : ''}
                              </div>
                              <div className="text-slate-500 text-[10px]">
                                {w.total_buy_tokens ? `${formatTokensAmount(w.total_buy_tokens)}` : ''}
                                {w.total_buy_tokens && w.total_buy_txs ? ' / ' : ''}
                                {w.total_buy_txs ? `${w.total_buy_txs} TXs` : ''}
                                {!w.total_buy_tokens && !w.total_buy_txs && (w.avg_buy_mc ? `$${Math.round(w.avg_buy_mc / 1000)}K MC` : '--')}
                              </div>
                            </td>

                            {/* Sold / Avg MC */}
                            <td className="py-3 px-4 text-right font-mono">
                              <div className="text-rose-400 font-bold text-xs">
                                {w.sold_usd ? `$${(w.sold_usd / 1000).toFixed(2)}K` : '--'}
                                {w.sold_usd && w.avg_sold_mc ? ` / $${Math.round(w.avg_sold_mc / 1000)}K` : ''}
                              </div>
                              <div className="text-slate-500 text-[10px]">
                                {w.sold_usd ? (
                                  <>
                                    {w.total_sold_tokens ? `${formatTokensAmount(w.total_sold_tokens)}` : ''}
                                    {w.total_sold_tokens && w.total_sold_txs ? ' / ' : ''}
                                    {w.total_sold_txs ? `${w.total_sold_txs} TXs` : ''}
                                    {!w.total_sold_tokens && !w.total_sold_txs && (w.avg_sold_mc ? `$${Math.round(w.avg_sold_mc / 1000)}K MC` : '--')}
                                  </>
                                ) : (
                                  'Holding'
                                )}
                              </div>
                            </td>

                            {/* Win Rate */}
                            <td className="py-3 px-3 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-bold ${w.win_rate_7d >= 70 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                  {w.win_rate_7d != null ? `${w.win_rate_7d}%` : '--'}
                                </span>
                                {w.win_rate_7d != null && (
                                  <div className="w-10 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                                    <div
                                      className={`h-full ${w.win_rate_7d >= 70 ? 'bg-emerald-400' : 'bg-purple-400'}`}
                                      style={{ width: `${Math.min(100, w.win_rate_7d)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Realized PnL */}
                            <td className="py-3 px-4 text-right font-mono">
                              <div className="font-extrabold text-emerald-400 text-xs">
                                {w.realized_pnl_usd != null ? `+$${Number(w.realized_pnl_usd).toLocaleString()}` : '--'}
                              </div>
                              {w.realized_pnl_percent != null && (
                                <div className="text-emerald-500 text-[10px]">
                                  +{w.realized_pnl_percent}%
                                </div>
                              )}
                            </td>

                            {/* Remaining USD */}
                            <td className="py-3 px-3 text-right font-mono text-slate-300 text-xs">
                              <div>{w.remaining_usd != null ? `$${w.remaining_usd}` : '$0'}</div>
                              <div className="text-slate-500 text-[10px]">{w.remaining_percent || 0}%</div>
                            </td>

                            {/* Funding Source */}
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                              <div className="flex items-center gap-1">
                                {w.funding_source ? (
                                  <span title={w.funding_source}>
                                    {w.funding_source.length > 8 ? `${w.funding_source.slice(0, 4)}...${w.funding_source.slice(-4)}` : w.funding_source}
                                  </span>
                                ) : (
                                  '--'
                                )}
                                {w.funding_source && w.wallet_age_display && (
                                  <span className="text-slate-500 text-[10px]">/ {w.wallet_age_display}</span>
                                )}
                              </div>
                              {w.funding_amount != null && (
                                <div className="text-slate-500 text-[10px]">◎ {w.funding_amount}</div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <a
                                  href={`https://gmgn.ai/sol/address/${w.wallet_address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-900/40 text-cyan-300 border border-slate-700 transition-colors"
                                  title="View on GMGN"
                                >
                                  GMGN ↗
                                </a>
                                <a
                                  href={`https://solscan.io/account/${w.wallet_address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 hover:bg-purple-900/40 text-purple-300 border border-slate-700 transition-colors"
                                  title="View on Solscan"
                                >
                                  Solscan ↗
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Integrity Notice ── */}
      <div className="text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2 pt-4">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Verified on-chain telemetry from GMGN OpenAPI &amp; Solana RPC. Zero synthetic mock data.
      </div>
    </div>
  );
}

// Helper to count unique coins across smart and kol lists
function newlyCoinsTotal(smartList = [], kolList = []) {
  const set = new Set();
  for (const w of smartList) {
    if (Array.isArray(w.coins_entered)) {
      w.coins_entered.forEach((c) => c.address && set.add(c.address));
    }
  }
  for (const w of kolList) {
    if (Array.isArray(w.coins_entered)) {
      w.coins_entered.forEach((c) => c.address && set.add(c.address));
    }
  }
  return set.size;
}
