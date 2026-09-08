import React, { useState } from 'react';
import { useBotStore } from '../../stores/botStore';
import { CoinCard } from '../CoinCard/CoinCard';

export function RankingsTab() {
  const rankedCoins = useBotStore(s => s.rankedCoins);
  const lastUpdated = useBotStore(s => s.lastUpdated);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'low_risk' | 'high_risk'

  const timeAgo = lastUpdated
    ? `${Math.max(1, Math.round((Date.now() - lastUpdated) / 1000))}s ago`
    : 'connecting...';

  // Split into Section 1 and Section 2
  const lowRiskCoins = rankedCoins.filter(c => (c.devRugPercent ?? 0) < 20);
  const highRiskCoins = rankedCoins.filter(c => (c.devRugPercent ?? 0) >= 20);

  const applySearch = (list) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      (c.symbol && c.symbol.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  };

  const filteredLowRisk = applySearch(lowRiskCoins);
  const filteredHighRisk = applySearch(highRiskCoins);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gmgn-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gmgn-text flex items-center gap-2">
            Market Suggestions
            <span className="text-xs font-normal text-gmgn-muted bg-gmgn-surface px-2 py-0.5 rounded border border-gmgn-border">
              {rankedCoins.length} total
            </span>
          </h1>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16181c] border border-gmgn-border text-xs text-gmgn-muted">
            <span className="live-dot w-2 h-2 rounded-full bg-gmgn-accent" />
            <span>Polls every 30s · {timeAgo}</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-64">
          <input
            type="text"
            placeholder="Search coin symbol or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="gmgn-input text-xs"
          />
        </div>
      </div>

      {/* ── Section Selector Tabs ─────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 bg-[#14161d] p-1 rounded-xl border border-gmgn-border max-w-fit">
        <button
          onClick={() => setActiveSection('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'all'
              ? 'bg-gmgn-surface text-white border border-gmgn-border shadow-sm'
              : 'text-gmgn-muted hover:text-white'
          }`}
        >
          All Sections ({rankedCoins.length})
        </button>

        <button
          onClick={() => setActiveSection('low_risk')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSection === 'low_risk'
              ? 'bg-[#f5c54220] text-gmgn-yellow border border-[#f5c54250]'
              : 'text-gmgn-muted hover:text-gmgn-yellow'
          }`}
        >
          <span>🛡️ Low Risk (&lt;20%)</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-gray-300">
            {lowRiskCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal">Ranked by Net Money</span>
        </button>

        <button
          onClick={() => setActiveSection('high_risk')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSection === 'high_risk'
              ? 'bg-[#00d4aa20] text-gmgn-accent border border-[#00d4aa50]'
              : 'text-gmgn-muted hover:text-gmgn-accent'
          }`}
        >
          <span>⚡ High Profit (≥20% Risk)</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-gray-300">
            {highRiskCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal">Ranked by Net Profit</span>
        </button>
      </div>

      {/* ── Content Area ──────────────────────────────────── */}
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* SECTION 1: Low Risk (<20%) */}
        {(activeSection === 'all' || activeSection === 'low_risk') && (
          <div>
            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-[#222530]">
              <div className="flex items-center gap-2">
                <span className="text-base">🛡️</span>
                <h2 className="text-sm font-bold text-gmgn-text">
                  Section 1: Low Risk (&lt;20% Risk)
                </h2>
                <span className="text-[11px] text-gmgn-yellow bg-[#f5c54215] px-2 py-0.5 rounded font-mono font-medium">
                  Ranked by Dev Net Money
                </span>
              </div>
              <span className="text-xs text-gmgn-muted">
                {filteredLowRisk.length} tokens
              </span>
            </div>

            {filteredLowRisk.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No tokens with &lt;20% rug risk match current filter settings.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {filteredLowRisk.map((coin) => (
                  <CoinCard key={coin.address} coin={coin} rank={coin.sectionRank} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: High Profit (≥20% Risk) */}
        {(activeSection === 'all' || activeSection === 'high_risk') && (
          <div>
            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-[#222530]">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <h2 className="text-sm font-bold text-gmgn-text">
                  Section 2: High Profit (≥20% Risk)
                </h2>
                <span className="text-[11px] text-gmgn-accent bg-[#00d4aa15] px-2 py-0.5 rounded font-mono font-medium">
                  Ranked by Net Profit / Net Buy
                </span>
              </div>
              <span className="text-xs text-gmgn-muted">
                {filteredHighRisk.length} tokens
              </span>
            </div>

            {filteredHighRisk.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No high-risk / degen tokens currently passing active filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {filteredHighRisk.map((coin) => (
                  <CoinCard key={coin.address} coin={coin} rank={coin.sectionRank} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
