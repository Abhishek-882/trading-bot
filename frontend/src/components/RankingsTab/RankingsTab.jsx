import React, { useState } from 'react';
import { useBotStore } from '../../stores/botStore';
import { CoinCard } from '../CoinCard/CoinCard';

export function RankingsTab() {
  const rankedCoins = useBotStore(s => s.rankedCoins);
  const lastUpdated = useBotStore(s => s.lastUpdated);
  const [search, setSearch] = useState('');

  const filtered = rankedCoins.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.symbol && c.symbol.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  const timeAgo = lastUpdated
    ? `${Math.max(1, Math.round((Date.now() - lastUpdated) / 1000))}s ago`
    : 'connecting...';

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gmgn-border">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gmgn-text flex items-center gap-2">
            Current Suggestions
            <span className="text-xs font-normal text-gmgn-muted bg-gmgn-surface px-2 py-0.5 rounded border border-gmgn-border">
              {rankedCoins.length} filtered
            </span>
          </h1>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#16181c] border border-gmgn-border text-xs text-gmgn-muted">
            <span className="live-dot w-2 h-2 rounded-full bg-gmgn-accent" />
            <span>Polls every 10s · {timeAgo}</span>
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

      {/* Coins List / Grid */}
      {filtered.length === 0 ? (
        <div className="gmgn-card flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-base font-semibold text-gmgn-text mb-1">No coins match your filters</h3>
          <p className="text-xs text-gmgn-muted max-w-sm">
            Try loosening the Liquidity, MKT Cap, or Dev Safety filter parameters on the left panel to discover more tokens.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 overflow-y-auto pr-1">
          {filtered.map((coin, index) => (
            <CoinCard key={coin.address || index} coin={coin} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
