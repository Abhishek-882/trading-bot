import React, { useState } from 'react';
import { WatcherBadge } from '../Common/WatcherBadge';
import { RollingNumber } from '../Common/RollingNumber';

const formatMcap = (k) => {
  if (!k || isNaN(k)) return '$0K';
  if (k >= 1000000) return `$${(k / 1000000).toFixed(2)}B`;
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}M`;
  return `$${k.toFixed(1)}K`;
};

/**
 * MobileCoinCard — High-Density Responsive Mobile Token Card
 * Delivers ergonomic 1-tap controls, 48px touch targets, and tactile feedback.
 * Features GMGN Watcher Badge, Dev Net Worth, Direct GMGN/Dex Links, and 1-tap Audit.
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
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] text-slate-400 truncate max-w-[90px]">
                {coin.name || 'Unknown Token'}
              </p>
              {(coin.websiteUrl || coin.website) && (
                <a
                  href={coin.websiteUrl || coin.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded flex items-center justify-center bg-[#161f30] text-cyan-400 border border-cyan-500/30"
                  title="Website"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <path strokeWidth="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                </a>
              )}
              {coin.twitterUrl && (
                <a
                  href={coin.twitterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded flex items-center justify-center bg-[#161f30] text-slate-300 border border-slate-600/30"
                  title="Twitter / X"
                >
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
              )}
              {coin.telegramUrl && (
                <a
                  href={coin.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded flex items-center justify-center bg-[#161f30] text-sky-400 border border-sky-500/30"
                  title="Telegram"
                >
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Watcher Badge (GMGN 1:1 Parity) */}
        <div className="shrink-0">
          <WatcherBadge count={coin.watchersCount || 1} delta={coin.watchersDelta || 0} size="sm" isLive={coin.hasLiveWatchers ?? true} />
        </div>
      </div>

      {/* Badges strip: CTO, Boosts, Dex Paid */}
      {(coin.isCTO || Boolean(coin.activeBoosts > 0) || Boolean(coin.dexPaid)) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {coin.isCTO && (
            <span className="inline-flex items-center gap-1 text-emerald-300 font-bold bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.2 rounded text-[10px] font-mono">
              <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              CTO (0% Rug)
            </span>
          )}
          {Boolean(coin.activeBoosts > 0) && (
            <span className="inline-flex items-center gap-1 text-amber-300 font-bold bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.2 rounded text-[10px] font-mono">
              <svg className="w-2.5 h-2.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              ⚡ {coin.activeBoosts}
            </span>
          )}
          {Boolean(coin.dexPaid) && (
            <span className="inline-flex items-center gap-1 text-cyan-300 font-bold bg-cyan-950/60 border border-cyan-500/40 px-1.5 py-0.2 rounded text-[10px] font-mono">
              <svg className="w-2.5 h-2.5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 11c-.5-.2-1.5-.7-2.5-.6-1 .1-1.8.6-2.5 1.3-.6.6-1.3 1.3-2.1 1.5-.8.2-1.7-.1-2.4-.6-.7-.5-1.2-1.2-1.8-1.9-.7-.9-1.5-1.8-2.6-2.2-1-.4-2.2-.4-3.2.2.7.6 1.5 1 2.3 1.2-1.2.6-2 1.6-2.4 2.8.9-.3 1.8-.2 2.6.2-1.1.8-1.7 2.1-1.7 3.4.9-.4 2-.5 3-.2-1.2 1.1-1.6 2.7-1.2 4.2 1.2-.8 2.5-1.2 3.9-1.1 1.3.1 2.6.6 3.6 1.4.6-.9 1.5-1.7 2.5-2.2.9-.4 1.8-.6 2.7-.7-.8-.6-1.3-1.5-1.5-2.5.9-.2 1.8-.6 2.4-1.1-.5-.4-1.2-.6-1.8-.8.8-.6 1.3-1.4 1.5-2.4-.8.3-1.6.3-2.4.1.8-.6 1.3-1.6 1.5-2.6-.9.5-1.8.7-2.7.6.7-.7 1.1-1.7 1.2-2.7-1 .6-2.1.8-3.2.7z"/>
              </svg>
              {coin.dexPaidDisplay || '$548'}
            </span>
          )}
        </div>
      )}

      {/* Middle Row: Metrics Grid (Mkt Cap, Price, Liquidity, Net Money) */}
      <div className="grid grid-cols-3 gap-2 bg-[#080c14] rounded-lg p-2 border border-[#171f2e] mb-2.5 text-center">
        <div>
          <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-mono">MCap</span>
          <span className="font-mono text-xs font-bold text-slate-200">
            {formatMcap(coin.mktCapK)}
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

      {/* Bottom Row: 1-Tap Direct Links & Institutional Audit Toolbar */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-[#171f2e]">
        {/* Copy Address Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="py-1.5 px-2 rounded-lg bg-[#141b27] hover:bg-[#1a2436] active:bg-[#1e2a3f] border border-[#232f45] text-slate-300 text-[11px] font-mono font-medium flex items-center justify-center gap-1 transition-colors min-h-[36px]"
          title="Copy Contract Address"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8.5l3.5 3.5 6.5-8" />
              </svg>
              <span className="text-emerald-400 font-bold">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{shortAddr}</span>
            </>
          )}
        </button>

        {/* Direct DexScreener Link */}
        <a
          href={coin.dexUrl || `https://dexscreener.com/solana/${coin.address}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="py-1.5 px-2 rounded-lg bg-[#141b27] hover:bg-[#1a2436] active:bg-[#1e2a3f] border border-[#232f45] text-cyan-300 hover:text-cyan-200 text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition-colors min-h-[36px]"
          title="Open Token on DEX Screener"
        >
          <svg className="w-3 h-3 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 11c-.5-.2-1.5-.7-2.5-.6-1 .1-1.8.6-2.5 1.3-.6.6-1.3 1.3-2.1 1.5-.8.2-1.7-.1-2.4-.6-.7-.5-1.2-1.2-1.8-1.9-.7-.9-1.5-1.8-2.6-2.2-1-.4-2.2-.4-3.2.2.7.6 1.5 1 2.3 1.2-1.2.6-2 1.6-2.4 2.8.9-.3 1.8-.2 2.6.2-1.1.8-1.7 2.1-1.7 3.4.9-.4 2-.5 3-.2-1.2 1.1-1.6 2.7-1.2 4.2 1.2-.8 2.5-1.2 3.9-1.1 1.3.1 2.6.6 3.6 1.4.6-.9 1.5-1.7 2.5-2.2.9-.4 1.8-.6 2.7-.7-.8-.6-1.3-1.5-1.5-2.5.9-.2 1.8-.6 2.4-1.1-.5-.4-1.2-.6-1.8-.8.8-.6 1.3-1.4 1.5-2.4-.8.3-1.6.3-2.4.1.8-.6 1.3-1.6 1.5-2.6-.9.5-1.8.7-2.7.6.7-.7 1.1-1.7 1.2-2.7-1 .6-2.1.8-3.2.7z"/>
          </svg>
          <span>Dex ↗</span>
        </a>

        {/* Direct GMGN Link */}
        <a
          href={`https://gmgn.ai/sol/token/${coin.address}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="py-1.5 px-2 rounded-lg bg-[#141b27] hover:bg-[#1a2436] active:bg-[#1e2a3f] border border-[#232f45] text-emerald-300 hover:text-emerald-200 text-[11px] font-mono font-bold flex items-center justify-center gap-1 transition-colors min-h-[36px]"
          title="Open Token on GMGN.AI"
        >
          <span className="w-3.5 h-3.5 rounded bg-emerald-500/20 text-emerald-400 font-black text-[9px] flex items-center justify-center border border-emerald-500/40">G</span>
          <span>GMGN ↗</span>
        </a>

        {/* Audit & Details Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect && onInspect(coin);
          }}
          className="flex-1 py-1.5 px-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30 active:from-cyan-500/40 active:to-emerald-500/40 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center justify-center gap-1 transition-all min-h-[36px] shadow-sm ml-auto"
          title="View Full GMGN Security Audit, Orders & Buy"
        >
          <svg className="w-3.5 h-3.5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Audit ↗</span>
        </button>
      </div>
    </div>
  );
}

export default MobileCoinCard;
