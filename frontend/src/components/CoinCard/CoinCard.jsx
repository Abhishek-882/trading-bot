import React, { useState } from 'react';
import soundFX from '../../engine/soundFX';
import { WatcherBadge } from '../Common/WatcherBadge';
import { getCoinDomainDetails } from '../RankingsTab/RankingsTab';

function formatK(valK, isCurrency = true) {
  const num = parseFloat(valK ?? 0);
  const prefix = isCurrency ? '$' : '';
  if (Math.abs(num) >= 1000) {
    return `${prefix}${(num / 1000).toFixed(2)}M`;
  }
  return `${prefix}${num.toFixed(1)}K`;
}

function formatNetBuy(valK) {
  const num = parseFloat(valK ?? 0);
  const sign = num >= 0 ? '+' : '-';
  const abs = Math.abs(num);
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(2)}M`;
  }
  return `${sign}$${abs.toFixed(1)}K`;
}

export function CoinCard({ coin, rank, onInspect }) {
  const [copied, setCopied] = useState(false);
  const [devCopied, setDevCopied] = useState(false);

  const copyAddress = (e) => {
    e.stopPropagation();
    if (coin.address) {
      soundFX.playClick(1.2);
      navigator.clipboard.writeText(coin.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyDevAddress = (e) => {
    e.stopPropagation();
    if (coin.devAddress) {
      soundFX.playClick(1.2);
      navigator.clipboard.writeText(coin.devAddress);
      setDevCopied(true);
      setTimeout(() => setDevCopied(false), 2000);
    }
  };

  const rugPct = coin.devRugPercent ?? 0;
  let rugBadgeClass = 'badge-green';
  let rugText = 'Safe';
  if (rugPct > 30) {
    rugBadgeClass = 'badge-red';
    rugText = 'High Risk';
  } else if (rugPct > 10) {
    rugBadgeClass = 'badge-yellow';
    rugText = 'Moderate';
  }

  const shortCoin = coin.address ? `${coin.address.slice(0, 4)}...${coin.address.slice(-4)}` : '';
  const shortDev = coin.devAddress ? `${coin.devAddress.slice(0, 4)}...${coin.devAddress.slice(-4)}` : 'N/A';

  const handleCardClick = () => {
    if (onInspect) {
      soundFX.playClick(1.0);
      onInspect(coin);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        contain: 'layout paint style',
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0)',
      }}
      className={`gmgn-card transition-all duration-200 coin-enter coin-card-hover relative overflow-hidden group cursor-pointer ${rugPct <= 5 ? 'trust-aura' : ''}`}
    >
      {/* Top row: Rank, Symbol, Name, Score, Badges */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <span className={`font-bold text-base w-7 text-center ${(rank || coin.rank || 0) <= 3 ? 'text-yellow-400 rank-badge-top' : 'text-gmgn-accent'}`}>
            #{coin.sectionRank || rank || coin.rank || '-'}
          </span>
          <div className="coin-logo w-8 h-8 rounded-full bg-[#20222a] flex items-center justify-center font-bold text-xs text-gmgn-accent border border-gmgn-border overflow-hidden">
            {coin.logo ? (
              <img src={coin.logo} alt={coin.symbol} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              (coin.symbol || '?').slice(0, 3)
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-gmgn-text group-hover:text-gmgn-accent transition-colors">
                {coin.symbol || 'UNKNOWN'}
              </span>
              <span className="text-xs text-gmgn-muted truncate max-w-[120px]">
                {coin.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-mono text-gmgn-muted">{shortCoin}</span>
              <button
                onClick={copyAddress}
                className="text-[10px] text-gmgn-muted hover:text-gmgn-accent transition-colors"
                title="Copy token mint"
              >
                {copied ? '✓' : 'copy'}
              </button>
              <WatcherBadge count={coin.watchersCount || 1} delta={coin.watchersDelta || 0} size="xs" isLive={coin.hasLiveWatchers ?? true} />

              {/* Social Quick Links (GMGN Parity: Website, Twitter/X, Telegram) */}
              {(coin.websiteUrl || coin.website) && (
                <a
                  href={coin.websiteUrl || coin.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded flex items-center justify-center bg-[#182030] hover:bg-[#202e48] text-cyan-400 hover:text-cyan-300 transition-colors"
                  title={`Project Website: ${coin.websiteUrl || coin.website}`}
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
                  className="w-4 h-4 rounded flex items-center justify-center bg-[#182030] hover:bg-[#202e48] text-slate-300 hover:text-white transition-colors"
                  title={`Twitter/X: ${coin.twitterUrl}`}
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
                  className="w-4 h-4 rounded flex items-center justify-center bg-[#182030] hover:bg-[#202e48] text-sky-400 hover:text-sky-300 transition-colors"
                  title={`Telegram: ${coin.telegramUrl}`}
                >
                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Section & Risk Badges */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {coin.isCTO && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1" title="Community Takeover (CTO) · 0% Dev Rug">
                <svg className="w-2.5 h-2.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>CTO</span>
              </span>
            )}
            {Boolean(coin.activeBoosts > 0) && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1" title={`${coin.activeBoosts} Active DexScreener Boosts`}>
                <svg className="w-2.5 h-2.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>⚡ {coin.activeBoosts}</span>
              </span>
            )}
            {Boolean(coin.dexPaid) && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1" title="DexScreener Paid Order Approved">
                <svg className="w-2.5 h-2.5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 11c-.5-.2-1.5-.7-2.5-.6-1 .1-1.8.6-2.5 1.3-.6.6-1.3 1.3-2.1 1.5-.8.2-1.7-.1-2.4-.6-.7-.5-1.2-1.2-1.8-1.9-.7-.9-1.5-1.8-2.6-2.2-1-.4-2.2-.4-3.2.2.7.6 1.5 1 2.3 1.2-1.2.6-2 1.6-2.4 2.8.9-.3 1.8-.2 2.6.2-1.1.8-1.7 2.1-1.7 3.4.9-.4 2-.5 3-.2-1.2 1.1-1.6 2.7-1.2 4.2 1.2-.8 2.5-1.2 3.9-1.1 1.3.1 2.6.6 3.6 1.4.6-.9 1.5-1.7 2.5-2.2.9-.4 1.8-.6 2.7-.7-.8-.6-1.3-1.5-1.5-2.5.9-.2 1.8-.6 2.4-1.1-.5-.4-1.2-.6-1.8-.8.8-.6 1.3-1.4 1.5-2.4-.8.3-1.6.3-2.4.1.8-.6 1.3-1.6 1.5-2.6-.9.5-1.8.7-2.7.6.7-.7 1.1-1.7 1.2-2.7-1 .6-2.1.8-3.2.7z"/>
                </svg>
                <span>{coin.dexPaidDisplay || (coin.dexPaidAmount ? `$${coin.dexPaidAmount}` : '$299')}</span>
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${rugBadgeClass} ${rugPct <= 10 ? 'badge-glow-green' : rugPct > 30 ? 'badge-glow-red' : ''}`}>
              {coin.isCTO ? 'CTO Safe' : `${rugText} (${rugPct.toFixed(0)}% rug)`}
            </span>
            <div className="bg-[#20222a] border border-gmgn-border px-2 py-0.5 rounded text-xs flex items-center gap-1">
              <span className="text-gmgn-muted text-[10px]">Score</span>
              <span className="font-bold text-gmgn-accent">{coin.score ?? 0}</span>
              <span className="text-[9px] font-mono text-gmgn-accent/60 ml-0.5 group-hover:text-gmgn-accent transition-colors">
                Audit ➔
              </span>
            </div>
          </div>
          {coin.rankReason && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-medium ${
              coin.section === 'high_risk' ? 'text-gmgn-accent bg-[#00d4aa15]' : 'text-gmgn-yellow bg-[#f5c54215]'
            }`}>
              {coin.rankReason}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 bg-[#121317] p-2.5 rounded-lg text-xs mb-3 border border-[#22252e]">
        <div>
          <span className="text-gmgn-muted block text-[10px]">MKT Cap</span>
          <span className="font-semibold text-gmgn-text">{formatK(coin.mktCapK)}</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Liquidity</span>
          <span className="font-semibold text-gmgn-text">{formatK(coin.liquidityK)}</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Volume</span>
          <span className="font-semibold text-gmgn-text">{formatK(coin.volumeK)}</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Net Buy</span>
          <span className={`font-semibold ${(coin.netBuyK ?? 0) >= 0 ? 'text-gmgn-green' : 'text-gmgn-red'}`}>
            {formatNetBuy(coin.netBuyK)}
          </span>
        </div>

        <div>
          <span className="text-gmgn-muted block text-[10px]">B. Curve</span>
          <span className="font-medium text-gmgn-accent">{(coin.bCurvePercent ?? 0).toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Age</span>
          <span className="font-medium text-gmgn-text">{coin.ageMinutes ?? 0}m</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">TXs (B/S)</span>
          <span className="font-medium text-gmgn-text" title={`${coin.txs ?? 0} total: ${coin.buys ?? 0} buys, ${coin.sells ?? 0} sells`}>
            {(coin.txs ?? 0).toLocaleString()} ({(coin.buys ?? 0).toLocaleString()}/{(coin.sells ?? 0).toLocaleString()})
          </span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Fees</span>
          <span className="font-medium text-gmgn-text">{(coin.totalFeesSol ?? 0).toFixed(2)} SOL</span>
        </div>
      </div>

      {/* ── Advanced Solscan & ATH Intelligence Badges ── */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap mb-2.5 px-0.5 text-[10px] font-mono">
        {/* Pre-funding */}
        {coin.isPreFunded ? (
          <span
            className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold flex items-center gap-1"
            title={coin.preFundDetails || `Funded with ${coin.preFundAmountSol} SOL`}
          >
            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>+{coin.preFundAmountSol || 5} SOL Pre-Funded</span>
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-[#1c1e26] border border-[#2c3140] text-gray-400 flex items-center gap-1">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>{(coin.devBalanceSol || 0) >= 5 ? `Self-Funded (${coin.devBalanceSol.toFixed(1)} SOL)` : 'No Pre-Funding'}</span>
          </span>
        )}

        {/* Website pill */}
        {(() => {
          const dInfo = getCoinDomainDetails(coin);
          const effectiveTier = (coin.domainTier && coin.domainTier !== 'none') ? coin.domainTier : dInfo.tier;
          if (!dInfo.hasWebsite) {
            return (
              <span className="px-1.5 py-0.5 rounded bg-[#181920] text-gray-600 text-[9px]">
                No Web
              </span>
            );
          }
          return (
            <a
              href={dInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`px-2 py-0.5 rounded border hover:underline flex items-center gap-1 ${
                effectiveTier === 'best'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : effectiveTier === 'small'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
              }`}
              title={`Project Website: ${dInfo.url} [Tier: ${effectiveTier}]`}
            >
              <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeWidth="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
              <span>{dInfo.domain || 'Website'} ↗</span>
            </a>
          );
        })()}

        {/* ATH probability */}
        <div
          className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
            (coin.athReachProbability || 50) >= 70
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : (coin.athReachProbability || 50) >= 45
              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
          title={coin.athStatusText || 'Estimated Probability to hit target ATH'}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" strokeWidth="2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
          </svg>
          <span>{coin.athReachProbability || 50}% ATH Prob</span>
        </div>
      </div>


      {/* Dev Wallet info row */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#22252e] text-gmgn-muted">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px]">Dev:</span>
          <button
            onClick={copyDevAddress}
            className="text-gmgn-text hover:text-cyan-400 transition-colors font-mono text-[11px] flex items-center gap-1"
            title="Click to copy full dev address"
          >
            <span>{shortDev}</span>
            {devCopied && <span className="text-[9px] text-cyan-400 font-bold bg-cyan-950/60 px-1 rounded border border-cyan-500/40 animate-pulse">✓ Copied!</span>}
          </button>
          {/* Total net worth badge — the key metric for Section 1 */}
          <span className="text-[11px] bg-[#1e2028] px-1.5 py-0.5 rounded text-gmgn-yellow font-semibold" title="Dev total portfolio net worth in USD">
            ${Math.round(coin.devTotalValueUsd ?? (coin.devBalanceSol ?? 0) * 150).toLocaleString()} net worth
          </span>
          <span className="text-[10px] bg-[#1e2028] px-1 py-0.5 rounded text-gmgn-muted" title="SOL balance">
            {(coin.devBalanceSol ?? 0).toFixed(2)} SOL
          </span>
          {coin.devTotalLaunches != null && (
            <span className="text-[10px] text-gmgn-muted">
              ({coin.devTotalLaunches} launch{coin.devTotalLaunches !== 1 ? 'es' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={coin.dexUrl || `https://dexscreener.com/solana/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-gmgn-accent hover:underline flex items-center gap-0.5"
          >
            DexScreener ↗
          </a>
          <a
            href={`https://gmgn.ai/sol/token/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-gmgn-muted hover:text-gmgn-accent hover:underline flex items-center gap-0.5"
          >
            GMGN ↗
          </a>
          <a
            href={`https://solscan.io/token/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-gmgn-muted hover:text-white"
          >
            Solscan ↗
          </a>
        </div>
      </div>
    </div>
  );
}
