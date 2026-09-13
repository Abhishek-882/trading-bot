import React, { useState, useEffect, useMemo } from 'react';
import { api, connectWS } from '../../api/client';
import soundFX from '../../engine/soundFX';
import { useBotStore } from '../../stores/botStore';

export function SmartMoneyRadarTab() {
  const [wallets, setWallets] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [presetRunning, setPresetRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [copiedAddr, setCopiedAddr] = useState(null);

  const addNotification = useBotStore((s) => s.addNotification);

  // Initial data load
  const fetchData = async () => {
    try {
      setLoading(true);
      const [walletList, clusterList] = await Promise.all([
        api.getSmartWallets({ minScore: 0, limit: 200 }),
        api.getSmartClusters(),
      ]);
      setWallets(walletList || []);
      setClusters(clusterList || []);
    } catch (err) {
      console.error('[Smart Money Radar] Error fetching data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Listen to real-time cluster signals over WebSocket
    connectWS((msg) => {
      if (msg.type === 'smart_cluster_signal' && msg.data) {
        soundFX.playChime();
        setClusters((prev) => [msg.data, ...prev.filter(c => c.token_address !== msg.data.token_address)]);
        addNotification({
          type: 'info',
          text: `⚡ Cluster Alert: ${msg.data.cluster_count} smart wallets converged on $${msg.data.token_symbol}!`,
        });
      }
    });
  }, []);

  // Handle Scan Trending Tokens
  const handleRunScan = async () => {
    soundFX.playClick(1.2);
    setScanning(true);
    addNotification({ type: 'info', text: 'Scanning 30 trending tokens across top traders...' });
    try {
      const res = await api.scanSmartMoney({ tokenLimit: 30, traderLimit: 50, minTokens: 3, minWinRate: 0.60 });
      await fetchData();
      soundFX.playTradeSuccess();
      addNotification({
        type: 'success',
        text: `Scan complete: ${res.walletsCount || 0} qualified smart wallets, ${res.clustersCount || 0} clusters active!`,
      });
    } catch (err) {
      addNotification({ type: 'error', text: `Scan failed: ${err.message}` });
    } finally {
      setScanning(false);
    }
  };

  // Handle 1-Click 7D Preset
  const handleRunPreset7D = async () => {
    soundFX.playClick(1.3);
    setPresetRunning(true);
    addNotification({ type: 'info', text: 'Running 1-Click 7D Preset: Filtering WinRate >= 70% & Realized PnL >= $50k+...' });
    try {
      const res = await api.runPreset7D({ minWinRate: 0.70, minPnlUsd: 50000, starCount: 20 });
      await fetchData();
      soundFX.playTradeSuccess();
      addNotification({
        type: 'success',
        text: `Preset Applied: ${res.count || 0} institutional wallets found, top ${res.starredCount || 20} starred!`,
      });
    } catch (err) {
      addNotification({ type: 'error', text: `Preset failed: ${err.message}` });
    } finally {
      setPresetRunning(false);
    }
  };

  // Handle Star Toggle
  const handleToggleStar = async (walletAddress) => {
    soundFX.playClick(1.1);
    try {
      const updated = await api.toggleStarWallet(walletAddress);
      setWallets((prev) =>
        prev.map((w) => (w.wallet_address === walletAddress ? { ...w, is_starred: updated.is_starred } : w))
      );
    } catch (err) {
      console.error('Star toggle failed:', err.message);
    }
  };

  // Copy address helper
  const handleCopy = (address) => {
    navigator.clipboard.writeText(address);
    setCopiedAddr(address);
    soundFX.playClick(1.0);
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  // Filtered and sorted wallets
  const filteredWallets = useMemo(() => {
    return wallets.filter((w) => {
      if (starredOnly && !w.is_starred) return false;
      if (minScore > 0 && (Number(w.score) || 0) < minScore) return false;
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const addrMatch = w.wallet_address.toLowerCase().includes(query);
        const tagMatch = Array.isArray(w.tags) && w.tags.some(t => t.toLowerCase().includes(query));
        if (!addrMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [wallets, starredOnly, minScore, search]);

  return (
    <div className="w-full flex flex-col gap-6 animate-fadeIn pb-12">
      {/* ── Top Header Banner & Actions ── */}
      <div className="bg-gradient-to-r from-[#111827] via-[#0f172a] to-[#1e1b4b] border border-cyan-500/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
                🎯 Smart Money Radar
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                5-Stage CI Engine
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Automated on-chain tracking &amp; cross-token correlation. Discovers high-conviction wallets entering under <span className="text-emerald-400 font-semibold">$500k MCap</span> with <span className="text-emerald-400 font-semibold">60%+ win rate</span> while strictly filtering bundlers, rat-traders, and cabal exit dumps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* 1-Click 7D Preset */}
            <button
              onClick={handleRunPreset7D}
              disabled={presetRunning}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-amber-500/10"
              title="Filter WinRate >= 70% & PnL >= $50k+, star top 20"
            >
              {presetRunning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  Applying 7D...
                </>
              ) : (
                <>
                  <span>⚡</span>
                  1-Click 7D Preset
                </>
              )}
            </button>

            {/* Scan Trending Tokens */}
            <button
              onClick={handleRunScan}
              disabled={scanning}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {scanning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scanning 30 Tokens...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Scan Trending
                </>
              )}
            </button>

            {/* Excel Download */}
            <a
              href={api.getExportUrl()}
              download
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
            >
              <span>📥</span>
              Export Excel (.xlsx)
            </a>
          </div>
        </div>
      </div>

      {/* ── Active Cluster Convergence Alert Banner ── */}
      {clusters.length > 0 && (
        <div className="bg-[#121927]/90 border border-purple-500/40 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-purple-300">
                Active Cluster Convergence Signals ({clusters.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              2+ Qualified Smart Wallets Entered Same Token
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clusters.slice(0, 6).map((c, i) => (
              <div
                key={i}
                className="bg-[#0b101b] border border-slate-800 hover:border-purple-500/50 rounded-xl p-3 transition-all flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-sm text-white">${c.token_symbol}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{c.token_name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {c.token_address?.slice(0, 6)}...{c.token_address?.slice(-4)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.is_cabal_divergence
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {c.is_cabal_divergence ? '⚠️ KOL Selling' : '✅ Clean Setup'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Wallets:</span>
                    <span className="font-bold text-cyan-400">{c.cluster_count} Smart</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Avg Entry:</span>
                    <span className="font-mono text-slate-200">
                      ${c.average_entry_mcap ? Math.round(c.average_entry_mcap / 1000) + 'k' : '--'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Conf:</span>
                    <span className="font-bold text-purple-400">{c.confidence_score}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter & Search Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#111622] border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-[#0a0e17] border border-slate-800 rounded-lg px-3 py-1.5">
          <span className="text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search wallet address or tag (e.g. whale, sniper)..."
            className="bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-500 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-500 hover:text-slate-300 text-xs">
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStarredOnly(!starredOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              starredOnly
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                : 'bg-[#182030] text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <span>{starredOnly ? '⭐' : '☆'}</span>
            Starred Only ({wallets.filter(w => w.is_starred).length})
          </button>

          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="bg-[#182030] border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
          >
            <option value="0">All Scores (0+)</option>
            <option value="70">Score 70+ (High)</option>
            <option value="80">Score 80+ (Elite)</option>
            <option value="90">Score 90+ (Institutional)</option>
          </select>
        </div>
      </div>

      {/* ── Smart Wallet Leaderboard Table ── */}
      <div className="bg-[#111622] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">Smart Money Leaderboard</span>
            <span className="text-xs text-slate-400 font-mono">({filteredWallets.length} Qualified)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Sorted by Score &amp; Realized PnL
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Loading verified on-chain smart wallets...</span>
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <span className="text-3xl">📡</span>
            <span className="text-sm font-semibold text-slate-300">No smart wallets match current filters</span>
            <p className="text-xs text-slate-500 max-w-md">
              Try resetting your filters or click <strong className="text-cyan-400">"Scan Trending"</strong> / <strong className="text-amber-400">"1-Click 7D Preset"</strong> to identify active alpha traders.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#0d121c] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 text-center w-12">Star</th>
                  <th className="py-3 px-4">Wallet Address</th>
                  <th className="py-3 px-3 text-center">Score</th>
                  <th className="py-3 px-3">Win Rate 7D</th>
                  <th className="py-3 px-3">Win Rate 30D</th>
                  <th className="py-3 px-4 text-right">Realized PnL</th>
                  <th className="py-3 px-3 text-center">Early Entries</th>
                  <th className="py-3 px-4 text-right">Avg Entry MCap</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-3 text-center">Links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {filteredWallets.map((w, idx) => {
                  const score = Number(w.score || 0);
                  const isTopScore = score >= 90;
                  const isHigh = score >= 80;

                  return (
                    <tr
                      key={w.wallet_address}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Star button */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleStar(w.wallet_address)}
                          className={`text-base transition-transform active:scale-125 ${
                            w.is_starred ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                          }`}
                          title={w.is_starred ? 'Remove Star' : 'Star this wallet'}
                        >
                          {w.is_starred ? '★' : '☆'}
                        </button>
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-white">
                            {w.wallet_address.slice(0, 6)}...{w.wallet_address.slice(-6)}
                          </span>
                          <button
                            onClick={() => handleCopy(w.wallet_address)}
                            className="text-slate-500 hover:text-slate-300 text-[10px] px-1 py-0.5 rounded bg-slate-800/80 transition-colors"
                            title="Copy full address"
                          >
                            {copiedAddr === w.wallet_address ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </td>

                      {/* Score Badge */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold font-mono ${
                            isTopScore
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : isHigh
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {score}
                        </span>
                      </td>

                      {/* Win Rate 7D */}
                      <td className="py-3.5 px-3 font-mono font-bold">
                        <div className="flex items-center gap-2">
                          <span className={w.win_rate_7d >= 70 ? 'text-emerald-400' : 'text-slate-300'}>
                            {w.win_rate_7d}%
                          </span>
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full ${w.win_rate_7d >= 70 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                              style={{ width: `${Math.min(100, w.win_rate_7d)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Win Rate 30D */}
                      <td className="py-3.5 px-3 font-mono text-slate-400">
                        {w.win_rate_30d}%
                      </td>

                      {/* Realized PnL */}
                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-400">
                        +${Number(w.realized_pnl_usd || 0).toLocaleString()}
                      </td>

                      {/* Early Entries */}
                      <td className="py-3.5 px-3 text-center font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                          {w.early_entry_count} coins
                        </span>
                      </td>

                      {/* Avg Entry MCap */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        ${w.avg_entry_mcap_usd ? Math.round(w.avg_entry_mcap_usd / 1000) + 'k' : '--'}
                      </td>

                      {/* Tags */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {Array.isArray(w.tags) && w.tags.length > 0 ? (
                            w.tags.slice(0, 3).map((tag, tIdx) => (
                              <span
                                key={tIdx}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-cyan-300 border border-slate-700"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">smart_money</span>
                          )}
                        </div>
                      </td>

                      {/* External Links */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={`https://gmgn.ai/sol/address/${w.wallet_address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-cyan-400 text-xs transition-colors font-mono"
                            title="View on GMGN"
                          >
                            GMGN ↗
                          </a>
                          <a
                            href={`https://solscan.io/account/${w.wallet_address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-purple-400 text-xs transition-colors font-mono"
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

      {/* ── Integrity Notice ── */}
      <div className="text-center text-[11px] text-slate-500 font-mono flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Verified on-chain telemetry from GMGN OpenAPI 5-Key Pool. Zero synthetic mock data.
      </div>
    </div>
  );
}
