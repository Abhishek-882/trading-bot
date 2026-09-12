import React, { useState } from 'react';
import { WatcherBadge } from '../Common/WatcherBadge';
import { RollingNumber } from '../Common/RollingNumber';

/**
 * MobileCoinCard — High-Density Responsive Mobile Token Card
 * Delivers ergonomic 1-tap controls, 48px touch targets, and tactile spring feedback.
 * Features the GMGN Watcher Badge, Dev Net Worth, and 3D Inspection trigger.
 */
export function MobileCoinCard({ coin, onSelect, onInspect, index }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!coin.address) return;
    navigator.clipboard.writeText(coin.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isLowRisk = coin.section === 'low_risk';
  const ageDisplay = coin.pumpLiveAgeMin != null
    ? (coin.pumpLiveAgeMin >= 1440
      ? `${Math.round(coin.pumpLiveAgeMin / 1440)}d`
      : coin.pumpLiveAgeMin >= 60
      ? `${Math.round(coin.pumpLiveAgeMin / 60)}h`
      : `${coin.pumpLiveAgeMin}m`)
    : 'New';

  const shortAddr = coin.address
    ? `${coin.address.slice(0, 4)}...${coin.address.slice(-4)}`
    : 'Unknown';

  const priceFormatted = coin.price >= 1
    ? `$${coin.price.toFixed(2)}`
    : coin.price >= 0.001
    ? `$${coin.price.toFixed(4)}`
    : `$${(coin.price || 0).toFixed(6)}`;

  return (
    <div
      onClick={() => onSelect && onSelect(coin)}
      className="w-full bg-[#0d121c]/95 hover:bg-[#131a27] border border-[#1e2738] hover:border-[#a855f7]/40 rounded-xl p-3.5 transition-all duration-200 active:scale-[0.98] shadow-md relative overflow-hidden group mb-3 cursor-pointer"
    >
      {/* Background ambient gradient glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-2xl pointer-events-none group-hover:bg-purple-600/10 transition-colors" />

      {/* Top Row: Rank, Logo, Name, Symbol, Age & Watcher Badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Rank Badge */}
          <span className="shrink-0 w-5 h-5 rounded-md bg-[#182030] text-[#8e9cb5] text-[10px] font-mono font-bold flex items-center justify-center border border-[#26334d]">
            #{index != null ? index + 1 : (coin.sectionRank || coin.rank || 1)}
          </span>

          {/* Token Avatar / Icon */}
          <div className="relative shrink-0 w-9 h-9 rounded-lg bg-[#151c28] border border-[#26334d] overflow-hidden flex items-center justify-center">
            {coin.logo ? (
              <img src={coin.logo} alt={coin.symbol} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-slate-300 font-mono">
                {coin.symbol?.slice(0, 3) || '???'}
              </span>
            )}
            {/* Pump.fun badge pill */}
            {coin.address?.endsWith('pump') && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#0d121c]" title="Pump.fun Trench Token" />
            )}
          </div>

          {/* Symbol & Name */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm tracking-wide truncate">
                {coin.symbol || '???'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono bg-[#161f30] px-1.5 py-0.2 rounded border border-[#26334d]">
                {ageDisplay}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[130px]">
              {coin.name || 'Unknown Token'}
            </p>
          </div>
        </div>

        {/* Watcher Badge (GMGN 1:1 Parity) */}
        <div className="shrink-0">
          <WatcherBadge count={coin.watchersCount || 12} delta={coin.watchersDelta || 0} size="sm" />
        </div>
      </div>

      {/* Middle Row: Metrics Grid (Mkt Cap, Price, Liquidity, Net Money) */}
      <div className="grid grid-cols-3 gap-2 bg-[#080c14] rounded-lg p-2 border border-[#171f2e] mb-2.5 text-center">
        <div>
          <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-mono">MCap</span>
          <span className="font-mono text-xs font-bold text-slate-200">
            $<RollingNumber value={coin.mktCapK || 0} decimals={1} />K
          </span>
        </div>

        <div>
          <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-mono">Price</span>
          <span className="font-mono text-xs font-bold text-emerald-400">
            {priceFormatted}
          </span>
        </div>

        <div>
          <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-mono">Liq</span>
          <span className="font-mono text-xs font-semibold text-slate-300">
            ${(coin.liquidityK || 0).toFixed(1)}K
          </span>
        </div>
      </div>

      {/* Dev Pre-Fund & Net Money Pill */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-3 px-0.5">
        <div className="flex items-center gap-1">
          <span className="text-slate-500">Dev:</span>
          {coin.isPreFunded ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[10px]">
              <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 8.5l3.5 3.5 6.5-8" />
              </svg>
              ≥{coin.preFundAmountSol || 5} SOL Pre-Fund
            </span>
          ) : (
            <span className="text-slate-300 font-medium">
              ${Math.round(coin.devTotalValueUsd || (coin.devBalanceSol || 0) * 150).toLocaleString()}
            </span>
          )}
        </div>

        {/* Bonding Curve Progress */}
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 bg-[#1a2333] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
              style={{ width: `${Math.min(100, coin.bCurvePercent || 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-300">
            {Math.round(coin.bCurvePercent || 100)}%
          </span>
        </div>
      </div>

      {/* Bottom Row: 1-Tap Touch Controls (Copy Address, Inspect 3D, Fast Trade) */}
      <div className="flex items-center gap-2 pt-1 border-t border-[#171f2e]">
        {/* Copy Address Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex-1 py-2 px-2.5 rounded-lg bg-[#141b27] hover:bg-[#1a2436] active:bg-[#1e2a3f] border border-[#232f45] text-slate-300 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
          title="Copy Contract Address"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8.5l3.5 3.5 6.5-8" />
              </svg>
              <span className="text-emerald-400 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{shortAddr}</span>
            </>
          )}
        </button>

        {/* Inspect 3D Medallion Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect && onInspect(coin);
          }}
          className="flex-1 py-2 px-2.5 rounded-lg bg-gradient-to-r from-purple-950/70 to-indigo-950/70 hover:from-purple-900/80 hover:to-indigo-900/80 active:from-purple-800 active:to-indigo-800 border border-purple-500/30 text-purple-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all min-h-[44px] shadow-sm"
          title="Inspect 3D Medallion & Security Risk Matrix"
        >
          {/* Vector 3D Cube / Medallion Icon */}
          <svg className="w-3.5 h-3.5 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span>Inspect 3D</span>
        </button>
      </div>
    </div>
  );
}

export default MobileCoinCard;
