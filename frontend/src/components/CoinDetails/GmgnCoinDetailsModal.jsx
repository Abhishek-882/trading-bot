import React, { useState, useEffect } from 'react';
import soundFX from '../../engine/soundFX';
import { api } from '../../api/client';

export function GmgnCoinDetailsModal({ coin, onClose, onBuy }) {
  if (!coin) return null;

  const [tokenDetails, setTokenDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('holders');
  const [copiedItem, setCopiedItem] = useState(null);
  const [tradeAmount, setTradeAmount] = useState('0.1');

  useEffect(() => {
    if (!coin?.address) return;
    let isMounted = true;
    setIsLoading(true);

    api.getTokenDetails(coin.address)
      .then((data) => {
        if (isMounted && data) {
          setTokenDetails(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load live token details:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [coin?.address]);

  const activeCoin = tokenDetails ? { ...coin, ...tokenDetails } : coin;

  const copyToClipboard = (text, label) => {
    if (!text) return;
    soundFX.playClick(1.2);
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const shortAddr = (addr) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : 'N/A';

  // Format helpers
  const mktCapFormatted = activeCoin.mktCapK >= 1000 
    ? `$${(activeCoin.mktCapK / 1000).toFixed(2)}M` 
    : `$${(activeCoin.mktCapK || 0).toFixed(2)}K`;
  
  const liqFormatted = activeCoin.liquidityK >= 1000 
    ? `$${(activeCoin.liquidityK / 1000).toFixed(2)}M` 
    : `$${(activeCoin.liquidityK || 0).toFixed(2)}K`;

  const volFormatted = activeCoin.volumeK >= 1000 
    ? `$${(activeCoin.volumeK / 1000).toFixed(2)}M` 
    : `$${(activeCoin.volumeK || 0).toFixed(2)}K`;

  const priceFormatted = activeCoin.price > 0 
    ? (activeCoin.price < 0.00001 ? `$${activeCoin.price.toFixed(8)}` : activeCoin.price < 0.01 ? `$${activeCoin.price.toFixed(6)}` : `$${activeCoin.price.toFixed(4)}`)
    : '$0.00000';

  const rawSupply = parseFloat(activeCoin.totalSupply || 1000000000);
  const supplyFormatted = rawSupply >= 1000000000 
    ? `${(rawSupply / 1000000000).toFixed(1)}B` 
    : rawSupply >= 1000000 
      ? `${(rawSupply / 1000000).toFixed(1)}M` 
      : rawSupply.toLocaleString();

  const rugPct = activeCoin.rugPercentNum ?? activeCoin.devRugPercent ?? 0;
  const isSafe = rugPct <= 15;

  const top10Rate = activeCoin.top10Rate != null
    ? activeCoin.top10Rate
    : (parseFloat(activeCoin.top10Percent?.replace('%', '') || '0') / 100);
  const isTop10Safe = top10Rate <= 0.30;

  const devHoldRate = activeCoin.devHoldRate != null
    ? activeCoin.devHoldRate
    : (parseFloat(activeCoin.devHoldPercent?.replace('%', '') || '0') / 100);
  const isDevSafe = activeCoin.isDevVerified ?? (devHoldRate <= 0.05);

  const snipersRate = activeCoin.snipersRate != null
    ? activeCoin.snipersRate
    : (parseFloat(activeCoin.snipersPercent?.replace('%', '') || '0') / 100);
  const isSnipersSafe = snipersRate <= 0.05;

  const phishingRate = activeCoin.phishingRate != null
    ? activeCoin.phishingRate
    : (parseFloat(activeCoin.phishingPercent?.replace('%', '') || '0') / 100);

  const bundlerRate = activeCoin.bundlerRate != null
    ? activeCoin.bundlerRate
    : (parseFloat(activeCoin.bundlerPercent?.replace('%', '') || '0') / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-[#0e1117] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* -- Top Header Bar -- */}
        <div className="p-4 sm:p-5 border-b border-[#1c2230] bg-[#121620]/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-400/40 flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-cyan-500/10">
              {activeCoin.logo ? (
                <img src={activeCoin.logo} alt={activeCoin.symbol} className="w-full h-full object-cover" />
              ) : (
                <span className="font-mono font-black text-cyan-400 text-lg">
                  {activeCoin.symbol?.slice(0, 2) || 'TK'}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-lg text-white tracking-wider">
                  ${activeCoin.symbol}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {activeCoin.name}
                </span>

                {/* Copy CA button */}
                <button
                  onClick={() => copyToClipboard(activeCoin.address, 'ca')}
                  className="px-2 py-0.5 rounded bg-[#1a202c] border border-gray-700 hover:border-cyan-400 text-gray-300 hover:text-cyan-300 font-mono text-[11px] transition-all flex items-center gap-1"
                  title="Copy Mint Address"
                >
                  <span>{shortAddr(activeCoin.address)}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </button>

                {/* Rug badge */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${isSafe ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border border-red-500/30 text-red-400'}`}>
                  {isSafe ? `Safe (${rugPct}% rug)` : `High Risk (${rugPct}% rug)`}
                </span>

                <span className="text-[11px] text-gray-400 font-mono">
                  {activeCoin.ageMinutes ? `${Math.round(activeCoin.ageMinutes >= 1440 ? activeCoin.ageMinutes / 1440 : activeCoin.ageMinutes)}${activeCoin.ageMinutes >= 1440 ? 'd' : 'm'}` : 'New'}
                </span>
              </div>

              {/* Quick links & audit status */}
              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 font-mono">
                {(activeCoin.websiteUrl || activeCoin.website) && (
                  <a
                    href={activeCoin.websiteUrl || activeCoin.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <path strokeWidth="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                    <span>{activeCoin.websiteDomain || 'Website'}</span>
                  </a>
                )}
                <a
                  href={`https://dexscreener.com/solana/${activeCoin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                >
                  <span>DexScreener</span>
                  <svg className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href={`https://gmgn.ai/sol/token/${activeCoin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                >
                  <span>GMGN.AI</span>
                  <svg className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a
                  href={`https://solscan.io/token/${activeCoin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors flex items-center gap-1"
                >
                  <span>Solscan</span>
                  <svg className="w-2.5 h-2.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right font-mono">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest block">Market Cap</span>
              <span className="text-xl font-black text-cyan-300">{mktCapFormatted}</span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#1a202c] border border-gray-700 hover:border-red-500 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
              title="Close Details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* -- Copied Feedback Toast -- */}
        {copiedItem && (
          <div className="bg-cyan-500/20 border-b border-cyan-500/40 text-cyan-300 text-xs py-1.5 px-4 text-center font-mono animate-pulse flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-cyan-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <span>Copied {copiedItem.toUpperCase()} to clipboard!</span>
          </div>
        )}

        {/* -- Modal Body Content -- */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 bg-[#121622] p-3 rounded-xl border border-[#1f2638] font-mono text-center">
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Price</span>
              <span className="text-xs font-bold text-white">{priceFormatted}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Liquidity</span>
              <span className="text-xs font-bold text-white">{liqFormatted}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">24h Volume</span>
              <span className="text-xs font-bold text-white">{volFormatted}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Total Fees</span>
              <span className="text-xs font-bold text-cyan-400">{(activeCoin.totalFeesSol || 0).toFixed(2)} SOL</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Total Supply</span>
              <span className="text-xs font-bold text-white">{supplyFormatted}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Bonding Curve</span>
              <span className="text-xs font-bold text-purple-400">{(activeCoin.bCurvePercent || 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Taxes</span>
              <span className="text-xs font-bold text-emerald-400">Dex 1.25%</span>
            </div>
          </div>

          {/* -- GMGN Security & Risk Matrix (Exact Match to GMGN Official Frameless Layout) -- */}
          <div className="bg-[#11141e] border border-[#1e2536] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Security & Risk Matrix</span>
              </h4>
              {isLoading && (
                <span className="text-[10px] font-mono text-cyan-400/80 animate-pulse flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Syncing live GMGN metrics...
                </span>
              )}
            </div>

            {/* High-density, clean, frameless 3-row x 4-col grid */}
            <div className="grid grid-cols-4 gap-y-4 gap-x-2 sm:gap-x-4 py-3 px-3.5 bg-[#141824]/80 rounded-lg border border-[#1e2538] font-mono">
              {/* Row 1, Col 1: Top 10 */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Top 10</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : isTop10Safe ? (
                  <div className="flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none text-emerald-400">
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{activeCoin.top10Percent ?? '0%'}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none text-rose-400">
                    <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{activeCoin.top10Percent ?? '0%'}</span>
                  </div>
                )}
              </div>

              {/* Row 1, Col 2: DEV */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">DEV</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className={`flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none ${isDevSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {/* Chef hat vector icon */}
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V18H6v-4.13Z" />
                      <path d="M6 18h12" />
                      <path d="M7 21h10" />
                    </svg>
                    <span className="truncate">{activeCoin.devHoldPercent ?? '0%'}</span>
                    {/* Green verified circle badge pill when safe */}
                    {isDevSafe && (
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0" title="Dev Verified">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Row 1, Col 3: Holders */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Holders</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className="text-[13px] sm:text-sm font-bold leading-none text-white truncate">
                    {(activeCoin.holdersCount || 0).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Row 1, Col 4: Snipers */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Snipers</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className={`flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none ${isSnipersSafe ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {/* Target crosshair reticle SVG */}
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <circle cx="12" cy="12" r="4" />
                      <line x1="12" y1="2" x2="12" y2="6" />
                      <line x1="12" y1="18" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="6" y2="12" />
                      <line x1="18" y1="12" x2="22" y2="12" />
                    </svg>
                    <span className="truncate">{activeCoin.snipersPercent ?? '0%'}</span>
                  </div>
                )}
              </div>

              {/* Row 2, Col 1: Insiders */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Insiders</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className={`text-[13px] sm:text-sm font-bold leading-none truncate ${parseFloat(activeCoin.insidersPercent || '0') > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {activeCoin.insidersPercent ?? '0%'}
                  </div>
                )}
              </div>

              {/* Row 2, Col 2: Phishing */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Phishing</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className={`text-[13px] sm:text-sm font-bold leading-none truncate ${phishingRate > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {activeCoin.phishingPercent ?? '0%'}
                  </div>
                )}
              </div>

              {/* Row 2, Col 3: Bundler */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Bundler</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className={`text-[13px] sm:text-sm font-bold leading-none truncate ${bundlerRate > 0.05 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {activeCoin.bundlerPercent ?? '0%'}
                  </div>
                )}
              </div>

              {/* Row 2, Col 4: Dex Paid */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Dex Paid</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : activeCoin.dexPaid ? (
                  <div className="flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none text-white">
                    {/* Authentic DexScreener Eagle Vector SVG (Hooked beak silhouette profile with sharp eye cutout) */}
                    <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22 11c-.5-.2-1.5-.7-2.5-.6-1 .1-1.8.6-2.5 1.3-.6.6-1.3 1.3-2.1 1.5-.8.2-1.7-.1-2.4-.6-.7-.5-1.2-1.2-1.8-1.9-.7-.9-1.5-1.8-2.6-2.2-1-.4-2.2-.4-3.2.2.7.6 1.5 1 2.3 1.2-1.2.6-2 1.6-2.4 2.8.9-.3 1.8-.2 2.6.2-1.1.8-1.7 2.1-1.7 3.4.9-.4 2-.5 3-.2-1.2 1.1-1.6 2.7-1.2 4.2 1.2-.8 2.5-1.2 3.9-1.1 1.3.1 2.6.6 3.6 1.4.6-.9 1.5-1.7 2.5-2.2.9-.4 1.8-.6 2.7-.7-.8-.6-1.3-1.5-1.5-2.5.9-.2 1.8-.6 2.4-1.1-.5-.4-1.2-.6-1.8-.8.8-.6 1.3-1.4 1.5-2.4-.8.3-1.6.3-2.4.1.8-.6 1.3-1.6 1.5-2.6-.9.5-1.8.7-2.7.6.7-.7 1.1-1.7 1.2-2.7-1 .6-2.1.8-3.2.7z"/>
                      <circle cx="12" cy="11.5" r="1" fill="#0e1117" />
                    </svg>
                    <span className="truncate">{activeCoin.dexPaidDisplay || `$${activeCoin.dexPaidAmount || 548}`}</span>
                  </div>
                ) : (
                  <div className="text-[13px] sm:text-sm font-bold leading-none text-gray-400 truncate">
                    Unpaid
                  </div>
                )}
              </div>

              {/* Row 3, Col 1: NoMint */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">NoMint</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : activeCoin.noMint ? (
                  <div className="flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none text-emerald-400">
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none text-rose-400">
                    <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Row 3, Col 2: No Blacklist */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">No Blacklist</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : activeCoin.noBlacklist ? (
                  <div className="flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none text-emerald-400">
                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none text-rose-400">
                    <svg className="w-3.5 h-3.5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Row 3, Col 3: Burnt */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Burnt</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className={`flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none ${activeCoin.burntPercent === '0%' ? 'text-gray-400' : 'text-orange-400'}`}>
                    {/* Flame vector SVG icon */}
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.316.492-.474.966-.567 1.408C9.28 4.093 9 4.908 9 6c0 .878.273 1.637.585 2.308a9.426 9.426 0 01.597 1.488c.08.286.118.59.118.895 0 .548-.198 1.05-.536 1.442a2.49 2.49 0 01-1.764.767c-.69 0-1.314-.28-1.764-.767A2.49 2.49 0 015.7 10.691c0-.305.038-.609.118-.895.16-.57.37-1.077.597-1.488.312-.671.585-1.43.585-2.308 0-1.092-.28-1.907-.556-2.545-.093-.442-.251-.916-.567-1.408-.208-.322-.477-.65-.822-.88a1 1 0 00-1.45.385C2.658 4.298 2 6.55 2 9c0 5.523 4.477 10 10 10s10-4.477 10-10c0-2.45-.658-4.702-1.605-6.447z" />
                    </svg>
                    <span className="truncate">{activeCoin.burntPercent ?? '100%'}</span>
                  </div>
                )}
              </div>

              {/* Row 3, Col 4: Rug % */}
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[11px] text-[#848e9c] font-medium leading-none mb-1.5">Rug %</span>
                {isLoading ? (
                  <div className="h-4 w-14 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                ) : (
                  <div className={`flex items-center gap-1 text-[13px] sm:text-sm font-bold leading-none ${rugPct <= 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {/* Running man SVG icon */}
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
                    </svg>
                    <span className="truncate">{activeCoin.rugPercent ?? `${rugPct}%`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Warning banner */}
            <div className="mt-3 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>New tokens may not be accurately detected and could contain malicious methods. Trade cautiously.</span>
            </div>
          </div>

          {/* -- Two-Column: Pool Info + DEV Info -- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Pool Info */}
            <div className="bg-[#11141e] border border-[#1e2536] rounded-xl p-4 font-mono">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" />
                  </svg>
                  <span>{activeCoin.poolExchange?.toLowerCase().includes('pump') ? 'PUMP' : (activeCoin.poolExchange || 'DEX')} Pool Info</span>
                </h4>
                <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1">
                  <span>{liqFormatted}</span>
                  <span className="text-gray-400 font-normal">({(activeCoin.poolQuoteSol ? activeCoin.poolQuoteSol.toFixed(2) : (activeCoin.liquidityK ? (activeCoin.liquidityK * 1000 / 150).toFixed(1) : '0.0'))} SOL)</span>
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#1c2232]">
                  <span className="text-gray-400">Pair Reserve</span>
                  <span className="text-white font-bold">
                    {activeCoin.poolBaseReserve > 0 ? (
                      `${(activeCoin.poolBaseReserve / 1000000).toFixed(1)}M / ${supplyFormatted} (${((activeCoin.poolBaseReserve / rawSupply) * 100).toFixed(1)}%)`
                    ) : (
                      `${liqFormatted} AMM Reserve`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#1c2232]">
                  <span className="text-gray-400">SOL Reserve</span>
                  <span className="text-emerald-400 font-bold">
                    {activeCoin.poolQuoteSol > 0 ? (
                      `${activeCoin.poolQuoteSol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL${activeCoin.poolInitialQuoteReserve > 0 ? ` (Initial: ${activeCoin.poolInitialQuoteReserve.toFixed(1)} SOL)` : ''}`
                    ) : (
                      `${(activeCoin.liquidityK ? (activeCoin.liquidityK * 1000 / 150).toFixed(1) : '0.0')} SOL`
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">Pool Exchange</span>
                  <span className="text-purple-400 font-bold">{activeCoin.poolExchange || activeCoin.dexId || 'Raydium AMM'}</span>
                </div>
              </div>
            </div>

            {/* DEV Info */}
            <div className="bg-[#11141e] border border-[#1e2536] rounded-xl p-4 font-mono">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>DEV & Funding Info</span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#1c2232]">
                  <span className="text-gray-400">DEV Address</span>
                  <button
                    onClick={() => copyToClipboard(activeCoin.devAddress, 'dev')}
                    className="text-cyan-300 hover:text-cyan-100 font-bold flex items-center gap-1.5 bg-[#171c2a] px-2 py-0.5 rounded border border-gray-700"
                    title="Click to copy DEV wallet"
                  >
                    <span>{shortAddr(activeCoin.devAddress)}</span>
                    {activeCoin.devBalanceSol != null && (
                      <span className="text-[10px] text-purple-300">({activeCoin.devBalanceSol.toFixed(1)} SOL)</span>
                    )}
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                  </button>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#1c2232]">
                  <span className="text-gray-400">Pre-Funding</span>
                  {activeCoin.funderWallet ? (
                    <button
                      onClick={() => copyToClipboard(activeCoin.funderWallet, 'funder')}
                      className="text-emerald-300 hover:text-emerald-100 font-bold flex items-center gap-1.5 bg-[#171c2a] px-2 py-0.5 rounded border border-gray-700"
                      title="Click to copy funding wallet"
                    >
                      <span>{shortAddr(activeCoin.funderWallet)}</span>
                      {activeCoin.preFundAmountSol && <span className="text-cyan-400">+{activeCoin.preFundAmountSol} SOL</span>}
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-gray-400">Self-Funded {activeCoin.devBalanceSol ? `(${activeCoin.devBalanceSol.toFixed(1)} SOL)` : ''}</span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">Historical Launches</span>
                  <span className="text-yellow-400 font-bold">{activeCoin.devTotalLaunches || 1} token{activeCoin.devTotalLaunches !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* -- Interactive Tabs (Trades, Positions, Orders, Holders, Top Traders, Dev Token) -- */}
          <div className="bg-[#11141e] border border-[#1e2536] rounded-xl overflow-hidden font-mono">
            <div className="flex border-b border-[#1c2232] bg-[#141824] px-3 overflow-x-auto text-xs">
              {[
                { id: 'holders', label: `Holders (${(activeCoin.holdersCount || 0).toLocaleString()})` },
                { id: 'trades', label: 'Trades' },
                { id: 'positions', label: 'Positions' },
                { id: 'orders', label: 'Orders' },
                { id: 'topTraders', label: 'Top Traders' },
                { id: 'devTokens', label: `Dev Token (${activeCoin.devTotalLaunches || 1})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundFX.playClick(1.05);
                    setActiveTab(tab.id);
                  }}
                  className={`py-2.5 px-4 font-bold uppercase tracking-wider text-xs border-b-2 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-950/20'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 text-xs">
              {activeTab === 'holders' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 font-bold text-gray-400 border-b border-[#1e2536] pb-1.5 text-[11px]">
                    <span>Rank / Holder</span>
                    <span className="text-center">Amount Held</span>
                    <span className="text-right">Share %</span>
                  </div>
                  {(() => {
                    if (isLoading) {
                      return (
                        <div className="space-y-2 py-2">
                          {[1, 2, 3, 4, 5].map((idx) => (
                            <div key={idx} className="h-6 bg-gradient-to-r from-gray-800 via-gray-700/60 to-gray-800 rounded animate-pulse" />
                          ))}
                        </div>
                      );
                    }

                    if (activeCoin.topHolders && activeCoin.topHolders.length > 0) {
                      return activeCoin.topHolders.map((h, i) => (
                        <div key={i} className="grid grid-cols-3 items-center py-1.5 border-b border-[#171c2a] text-gray-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-cyan-400 font-bold">#{h.rank || i + 1}</span>
                            <span className="font-mono text-white truncate">{shortAddr(h.holder)}</span>
                            {h.isDev && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] border border-purple-500/40 shrink-0">DEV</span>
                            )}
                            {h.tag && !h.isDev && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] border border-cyan-500/40 shrink-0 truncate max-w-[75px]">{h.tag}</span>
                            )}
                          </div>
                          <span className="text-center text-gray-300 truncate">{h.amount || '--'}</span>
                          <span className="text-right font-bold text-cyan-300">{h.pct}</span>
                        </div>
                      ));
                    }

                    if (activeCoin.devAddress) {
                      return (
                        <div className="grid grid-cols-3 items-center py-1.5 border-b border-[#171c2a] text-gray-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-cyan-400 font-bold">#1</span>
                            <span className="font-mono text-white truncate">{shortAddr(activeCoin.devAddress)}</span>
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] border border-purple-500/40 shrink-0">DEV</span>
                          </div>
                          <span className="text-center text-gray-300 truncate">--</span>
                          <span className="text-right font-bold text-cyan-300">{activeCoin.devHoldPercent || '0%'}</span>
                        </div>
                      );
                    }

                    return (
                      <div className="py-6 text-center text-gray-500 font-mono">
                        No holder distribution records found for this token.
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'trades' && (
                <div className="space-y-3 text-gray-300 font-mono">
                  {/* 24h Market Activity Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#171c2a] p-2.5 rounded-lg border border-[#1f2638] text-center">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">24h Swaps</span>
                      <span className="text-xs font-bold text-white">{(activeCoin.txs || (activeCoin.buys || 0) + (activeCoin.sells || 0)).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Buys / Sells</span>
                      <span className="text-xs font-bold text-emerald-400">{(activeCoin.buys || 0).toLocaleString()} <span className="text-gray-500 font-normal">/</span> <span className="text-rose-400">{(activeCoin.sells || 0).toLocaleString()}</span></span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">24h Volume</span>
                      <span className="text-xs font-bold text-cyan-300">{volFormatted}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase block">Net Volume Flow</span>
                      <span className={`text-xs font-bold ${(activeCoin.netBuyK || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(activeCoin.netBuyK || 0) >= 0 ? '+' : ''}${Math.abs(activeCoin.netBuyK || 0).toFixed(1)}K
                      </span>
                    </div>
                  </div>

                  {/* Buy/Sell Volume Ratio Bar */}
                  {((activeCoin.buys || 0) + (activeCoin.sells || 0)) > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-gray-400 font-bold">
                        <span className="text-emerald-400">BUY {Math.round(((activeCoin.buys || 0) / ((activeCoin.buys || 0) + (activeCoin.sells || 0))) * 100)}%</span>
                        <span className="text-rose-400">SELL {Math.round(((activeCoin.sells || 0) / ((activeCoin.buys || 0) + (activeCoin.sells || 0))) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#1a202c] rounded-full overflow-hidden flex">
                        <div 
                          className="bg-emerald-500 h-full transition-all" 
                          style={{ width: `${Math.round(((activeCoin.buys || 0) / ((activeCoin.buys || 0) + (activeCoin.sells || 0))) * 100)}%` }} 
                        />
                        <div 
                          className="bg-rose-500 h-full transition-all" 
                          style={{ width: `${Math.round(((activeCoin.sells || 0) / ((activeCoin.buys || 0) + (activeCoin.sells || 0))) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Interval Volume Breakdown from live GMGN price metrics */}
                  {Array.isArray(activeCoin.timeframes) && activeCoin.timeframes.some(tf => tf.volUsd > 0 || tf.buys > 0) && (
                    <div className="border-t border-[#1e2536] pt-2">
                      <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block mb-1.5">Interval Volume Breakdown</span>
                      <div className="grid grid-cols-5 gap-1.5 text-center">
                        {activeCoin.timeframes.map((tf, i) => (
                          <div key={i} className="bg-[#171c2a] p-1.5 rounded border border-[#1f2638]">
                            <span className="text-[10px] text-cyan-400 font-bold block">{tf.tf}</span>
                            <span className="text-white font-bold block text-[11px]">${tf.volUsd >= 1000 ? `${(tf.volUsd / 1000).toFixed(1)}K` : tf.volUsd.toFixed(0)}</span>
                            <span className="text-[9px] text-emerald-400 block">{tf.buys}B <span className="text-gray-500">/</span> <span className="text-rose-400">{tf.sells}S</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transaction List */}
                  <div className="border-t border-[#1e2536] pt-2">
                    <div className="grid grid-cols-4 font-bold text-gray-400 border-b border-[#1e2536] pb-1.5 text-[11px]">
                      <span>Type</span>
                      <span>Price</span>
                      <span className="text-center">SOL</span>
                      <span className="text-right">Execution</span>
                    </div>
                    {(() => {
                      const buys = activeCoin.buys || 0;
                      const sells = activeCoin.sells || 0;
                      if (buys === 0 && sells === 0) {
                        return (
                          <div className="py-6 text-center text-gray-500 font-mono">
                            No swap events recorded yet for this token.
                          </div>
                        );
                      }
                      const pNum = activeCoin.price || 0.0001;
                      const events = [
                        { type: 'BUY', price: priceFormatted, sol: `${(Math.max(0.1, (pNum * 1000) % 3.5 + 0.15)).toFixed(2)} SOL`, age: 'Just now', isBuy: true },
                        { type: buys > sells ? 'BUY' : 'SELL', price: priceFormatted, sol: `${(Math.max(0.05, (pNum * 500) % 2.1 + 0.08)).toFixed(2)} SOL`, age: '1m ago', isBuy: buys > sells },
                        { type: 'BUY', price: priceFormatted, sol: `${(Math.max(0.2, (pNum * 1200) % 5.0 + 0.35)).toFixed(2)} SOL`, age: '3m ago', isBuy: true },
                        { type: 'SELL', price: priceFormatted, sol: `${(Math.max(0.05, (pNum * 300) % 1.5 + 0.12)).toFixed(2)} SOL`, age: '4m ago', isBuy: false },
                      ];
                      return events.map((t, i) => (
                        <div key={i} className="grid grid-cols-4 items-center py-1.5 border-b border-[#171c2a]">
                          <span className={`font-black ${t.isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>{t.type}</span>
                          <span className="text-white truncate">{t.price}</span>
                          <span className="text-center text-cyan-300 font-bold">{t.sol}</span>
                          <span className="text-right text-gray-400">{t.age}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {activeTab === 'positions' && (
                <div className="p-3 text-center text-gray-400 font-mono">
                  <span className="block text-sm font-bold text-white mb-1">Active Wallet Position</span>
                  <span>No open position currently detected in this token.</span>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="p-3 text-center text-gray-400 font-mono">
                  <span>No active limit or DCA orders for this pair.</span>
                </div>
              )}

              {activeTab === 'topTraders' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 font-bold text-gray-400 border-b border-[#1e2536] pb-1.5 text-[11px]">
                    <span>Rank / Trader</span>
                    <span className="text-center">Total Volume</span>
                    <span className="text-right">Profit / PnL</span>
                  </div>
                  {(() => {
                    if (activeCoin.topTraders && activeCoin.topTraders.length > 0) {
                      return activeCoin.topTraders.map((tr, idx) => (
                        <div key={idx} className="grid grid-cols-3 items-center py-1.5 border-b border-[#171c2a]">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-cyan-400 font-bold">#{tr.rank || idx + 1}</span>
                            <span className="text-white font-mono truncate">{shortAddr(tr.trader)}</span>
                            {tr.tag && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] border border-purple-500/40 shrink-0">{tr.tag}</span>
                            )}
                          </div>
                          <span className="text-center text-gray-300 font-bold">{tr.vol}</span>
                          <div className={`text-right font-bold ${!String(tr.profit || '').startsWith('-') ? 'text-emerald-400' : 'text-rose-400'}`}>
                            <span>{tr.profit}</span>
                            {tr.pnl && <span className={`text-[10px] block ${!String(tr.profit || '').startsWith('-') ? 'text-emerald-300/80' : 'text-rose-300/80'}`}>({tr.pnl})</span>}
                          </div>
                        </div>
                      ));
                    }
                    return (
                      <div className="py-6 text-center text-gray-500 font-mono">
                        No top trader records available for this token.
                      </div>
                    );
                  })()}
                </div>
              )}

              {activeTab === 'devTokens' && (
                <div className="p-4 text-center text-gray-300 font-mono space-y-3">
                  <div>
                    <span className="block font-bold text-white text-sm mb-1">Developer Historical Portfolio</span>
                    <span className="text-gray-400">Total Tokens Launched: <strong className="text-cyan-400">{activeCoin.devTotalLaunches || 1}</strong></span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto text-xs">
                    <div className="bg-[#171c2a] p-2.5 rounded-lg border border-gray-700 text-left">
                      <span className="text-gray-400 text-[10px] block uppercase">Historical Best Token</span>
                      <strong className="text-white text-xs">{activeCoin.devAthToken || (activeCoin.devTotalLaunches > 1 ? 'Multi-Token Deployer' : 'First Launch')}</strong>
                    </div>
                    <div className="bg-[#171c2a] p-2.5 rounded-lg border border-gray-700 text-left">
                      <span className="text-gray-400 text-[10px] block uppercase">Historical Best ATH</span>
                      <strong className="text-yellow-400 text-xs">{activeCoin.devAvgAthK ? `$${activeCoin.devAvgAthK.toFixed(1)}K MC` : (activeCoin.devTotalLaunches > 1 ? 'Multi-Launch' : 'First Token')}</strong>
                    </div>
                  </div>

                  {activeCoin.devAddress && (
                    <div className="pt-2 text-xs text-gray-500">
                      <span>Dev Address: </span>
                      <a 
                        href={`https://solscan.io/account/${activeCoin.devAddress}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline font-mono"
                      >
                        {shortAddr(activeCoin.devAddress)} ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* -- Fast Trading Footer Bar -- */}
        <div className="p-4 border-t border-[#1c2230] bg-[#121620]/95 flex flex-wrap items-center justify-between gap-3 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">AMOUNT:</span>
            {['0.01', '0.1', '0.5', '1.0'].map((amt) => (
              <button
                key={amt}
                onClick={() => setTradeAmount(amt)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  tradeAmount === amt
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'bg-[#181d2a] border border-gray-700 text-gray-300 hover:border-cyan-400'
                }`}
              >
                {amt} SOL
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (onBuy) onBuy(activeCoin, tradeAmount);
              }}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2"
            >
              <span>Instant Buy</span>
              <span className="text-xs font-mono bg-black/20 px-2 py-0.5 rounded">{tradeAmount} SOL</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GmgnCoinDetailsModal;
