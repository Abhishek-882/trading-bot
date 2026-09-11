import React, { useState } from 'react';
import soundFX from '../../engine/soundFX';

export function GmgnCoinDetailsModal({ coin, onClose, onBuy }) {
  if (!coin) return null;

  const [activeTab, setActiveTab] = useState('holders');
  const [copiedItem, setCopiedItem] = useState(null);
  const [tradeAmount, setTradeAmount] = useState('0.1');

  const copyToClipboard = (text, label) => {
    if (!text) return;
    soundFX.playClick(1.2);
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const shortAddr = (addr) => addr ? `${addr.slice(0, 4)}...${addr.slice(-4)}` : 'N/A';

  // Format helpers
  const mktCapFormatted = coin.mktCapK >= 1000 
    ? `$${(coin.mktCapK / 1000).toFixed(2)}M` 
    : `$${(coin.mktCapK || 0).toFixed(2)}K`;
  
  const liqFormatted = coin.liquidityK >= 1000 
    ? `$${(coin.liquidityK / 1000).toFixed(2)}M` 
    : `$${(coin.liquidityK || 0).toFixed(2)}K`;

  const volFormatted = coin.volumeK >= 1000 
    ? `$${(coin.volumeK / 1000).toFixed(2)}M` 
    : `$${(coin.volumeK || 0).toFixed(2)}K`;

  const priceFormatted = coin.price > 0 
    ? (coin.price < 0.0001 ? `$0.0...${(coin.price * 100000).toFixed(2)}` : `$${coin.price.toFixed(6)}`)
    : '$0.00000';

  const rugPct = coin.devRugPercent ?? 0;
  const isSafe = rugPct <= 15;

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
              {coin.logo ? (
                <img src={coin.logo} alt={coin.symbol} className="w-full h-full object-cover" />
              ) : (
                <span className="font-mono font-black text-cyan-400 text-lg">
                  {coin.symbol?.slice(0, 2) || 'TK'}
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-black text-lg text-white tracking-wider">
                  ${coin.symbol}
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  {coin.name}
                </span>

                {/* Copy CA button */}
                <button
                  onClick={() => copyToClipboard(coin.address, 'ca')}
                  className="px-2 py-0.5 rounded bg-[#1a202c] border border-gray-700 hover:border-cyan-400 text-gray-300 hover:text-cyan-300 font-mono text-[11px] transition-all flex items-center gap-1"
                  title="Copy Mint Address"
                >
                  <span>{shortAddr(coin.address)}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </button>

                {/* Rug badge */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${isSafe ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border border-red-500/30 text-red-400'}`}>
                  {isSafe ? `Safe (${rugPct}% rug)` : `High Risk (${rugPct}% rug)`}
                </span>

                <span className="text-[11px] text-gray-400 font-mono">
                  {coin.ageMinutes ? `${Math.round(coin.ageMinutes >= 1440 ? coin.ageMinutes / 1440 : coin.ageMinutes)}${coin.ageMinutes >= 1440 ? 'd' : 'm'}` : 'New'}
                </span>
              </div>

              {/* Quick links & audit status */}
              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 font-mono">
                {coin.hasGenuineWebsite && coin.websiteUrl && (
                  <a
                    href={coin.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <path strokeWidth="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                    </svg>
                    <span>{coin.websiteDomain || 'Website'}</span>
                  </a>
                )}
                <a
                  href={`https://dexscreener.com/solana/${coin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors"
                >
                  DexScreener ?
                </a>
                <a
                  href={`https://gmgn.ai/sol/token/${coin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors"
                >
                  GMGN.AI ?
                </a>
                <a
                  href={`https://solscan.io/token/${coin.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-400 transition-colors"
                >
                  Solscan ?
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
          <div className="bg-cyan-500/20 border-b border-cyan-500/40 text-cyan-300 text-xs py-1.5 px-4 text-center font-mono animate-pulse">
            ? Copied {copiedItem.toUpperCase()} to clipboard!
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
              <span className="text-xs font-bold text-cyan-400">{(coin.totalFeesSol || 0).toFixed(2)} SOL</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Total Supply</span>
              <span className="text-xs font-bold text-white">1B</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Bonding Curve</span>
              <span className="text-xs font-bold text-purple-400">{(coin.bCurvePercent || 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase block">Taxes</span>
              <span className="text-xs font-bold text-emerald-400">Dex 1.25%</span>
            </div>
          </div>

          {/* -- GMGN Security & Risk Matrix (Exact Match to Picture 2) -- */}
          <div className="bg-[#11141e] border border-[#1e2536] rounded-xl p-4">
            <h4 className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Security & Risk Matrix</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Top 10</span>
                <span className="text-sm font-black text-rose-400 flex items-center justify-center gap-1">
                  <svg className="w-3 h-3 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{coin.top10Percent || '79.1%'}</span>
                </span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">DEV</span>
                <span className="text-sm font-black text-rose-400">
                  {coin.devHoldPercent || '78.8%'}
                </span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Holders</span>
                <span className="text-sm font-black text-white">
                  {coin.holdersCount || (coin.buys ? Math.round(coin.buys / 5) : 6)}
                </span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Snipers</span>
                <span className="text-sm font-black text-rose-400">
                  {coin.snipersPercent || '78.8%'}
                </span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Insiders</span>
                <span className="text-sm font-black text-emerald-400">0%</span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Phishing</span>
                <span className="text-sm font-black text-emerald-400">0%</span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Bundler</span>
                <span className="text-sm font-black text-emerald-400">{coin.bundlerRate ? `${(coin.bundlerRate * 100).toFixed(1)}%` : '0%'}</span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Dex Paid</span>
                <span className="text-sm font-black text-gray-300">{coin.dexPaid ? 'Paid' : 'Unpaid'}</span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">NoMint</span>
                <span className="text-sm font-black text-emerald-400 flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Verified</span>
                </span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">No Blacklist</span>
                <span className="text-sm font-black text-emerald-400 flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Clean</span>
                </span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Burnt</span>
                <span className="text-sm font-black text-orange-400 flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.316.492-.474.966-.567 1.408C9.28 4.093 9 4.908 9 6c0 .878.273 1.637.585 2.308a9.426 9.426 0 01.597 1.488c.08.286.118.59.118.895 0 .548-.198 1.05-.536 1.442a2.49 2.49 0 01-1.764.767c-.69 0-1.314-.28-1.764-.767A2.49 2.49 0 015.7 10.691c0-.305.038-.609.118-.895.16-.57.37-1.077.597-1.488.312-.671.585-1.43.585-2.308 0-1.092-.28-1.907-.556-2.545-.093-.442-.251-.916-.567-1.408-.208-.322-.477-.65-.822-.88a1 1 0 00-1.45.385C2.658 4.298 2 6.55 2 9c0 5.523 4.477 10 10 10s10-4.477 10-10c0-2.45-.658-4.702-1.605-6.447z" clipRule="evenodd" />
                  </svg>
                  <span>100%</span>
                </span>
              </div>

              <div className="bg-[#151926] p-2.5 rounded-lg border border-[#232b3e]">
                <span className="text-[10px] text-gray-400 block">Rug %</span>
                <span className={`text-sm font-black ${rugPct <= 15 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {rugPct}%
                </span>
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
            {/* PUMP Pool Info */}
            <div className="bg-[#11141e] border border-[#1e2536] rounded-xl p-4 font-mono">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2" />
                  </svg>
                  <span>PUMP Pool Info</span>
                </h4>
                <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1">
                  <span>{liqFormatted}</span>
                  <span className="text-gray-400 font-normal">({(coin.poolQuoteSol || (coin.liquidityK ? (coin.liquidityK * 1000 / 150).toFixed(1) : '84.16'))} SOL)</span>
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[#1c2232]">
                  <span className="text-gray-400">Pair Reserve</span>
                  <span className="text-white font-bold">209M / 1B (100%)</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[#1c2232]">
                  <span className="text-gray-400">SOL Reserve</span>
                  <span className="text-emerald-400 font-bold">{coin.poolQuoteSol ? coin.poolQuoteSol.toFixed(2) : '84.16'} / 0.001 (+&gt;99K%)</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">Pool Exchange</span>
                  <span className="text-purple-400 font-bold">{coin.dexId || 'Raydium / Pump'}</span>
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
                    onClick={() => copyToClipboard(coin.devAddress, 'dev')}
                    className="text-cyan-300 hover:text-cyan-100 font-bold flex items-center gap-1.5 bg-[#171c2a] px-2 py-0.5 rounded border border-gray-700"
                    title="Click to copy DEV wallet"
                  >
                    <span>{shortAddr(coin.devAddress)}</span>
                    <span className="text-[10px] text-purple-300">({(coin.devBalanceSol ?? 16).toFixed(1)} SOL)</span>
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                    </svg>
                  </button>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-[#1c2232]">
                  <span className="text-gray-400">Pre-Funding</span>
                  {coin.funderWallet ? (
                    <button
                      onClick={() => copyToClipboard(coin.funderWallet, 'funder')}
                      className="text-emerald-300 hover:text-emerald-100 font-bold flex items-center gap-1.5 bg-[#171c2a] px-2 py-0.5 rounded border border-gray-700"
                      title="Click to copy funding wallet"
                    >
                      <span>{shortAddr(coin.funderWallet)}</span>
                      <span className="text-cyan-400">+{coin.preFundAmountSol || 100} SOL</span>
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-gray-400">Self-Funded ({coin.devBalanceSol ? `${coin.devBalanceSol.toFixed(1)} SOL` : '35 SOL'})</span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-400">Historical Launches</span>
                  <span className="text-yellow-400 font-bold">{coin.devTotalLaunches || 1} token{coin.devTotalLaunches !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </div>

          {/* -- Interactive Tabs (Trades, Positions, Orders, Holders, Top Traders, Dev Token) -- */}
          <div className="bg-[#11141e] border border-[#1e2536] rounded-xl overflow-hidden font-mono">
            <div className="flex border-b border-[#1c2232] bg-[#141824] px-3 overflow-x-auto text-xs">
              {[
                { id: 'holders', label: `Holders (${coin.holdersCount || 6})` },
                { id: 'trades', label: 'Trades' },
                { id: 'positions', label: 'Positions' },
                { id: 'orders', label: 'Orders' },
                { id: 'topTraders', label: 'Top Traders' },
                { id: 'devTokens', label: `Dev Token (${coin.devTotalLaunches || 1})` },
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
                  {[
                    { rank: 1, holder: coin.devAddress || '4m45...wFnj', amount: '788,000,000', pct: '78.8%', isDev: true },
                    { rank: 2, holder: '6bZ7...8xPq', amount: '120,000,000', pct: '12.0%' },
                    { rank: 3, holder: '9wKm...3mLa', amount: '50,000,000', pct: '5.0%' },
                    { rank: 4, holder: '2eXt...0vWz', amount: '22,000,000', pct: '2.2%' },
                    { rank: 5, holder: '8hPn...5kTy', amount: '12,000,000', pct: '1.2%' },
                    { rank: 6, holder: '1qMn...9cZa', amount: '8,000,000', pct: '0.8%' },
                  ].map((h) => (
                    <div key={h.rank} className="grid grid-cols-3 items-center py-1.5 border-b border-[#171c2a] text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <span className="text-cyan-400 font-bold">#{h.rank}</span>
                        <span className="font-mono text-white">{shortAddr(h.holder)}</span>
                        {h.isDev && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] border border-purple-500/40">DEV</span>
                        )}
                      </div>
                      <span className="text-center text-gray-300">{h.amount}</span>
                      <span className="text-right font-bold text-cyan-300">{h.pct}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'trades' && (
                <div className="space-y-2 text-gray-300">
                  <div className="grid grid-cols-4 font-bold text-gray-400 border-b border-[#1e2536] pb-1.5 text-[11px]">
                    <span>Type</span>
                    <span>Price</span>
                    <span className="text-center">SOL</span>
                    <span className="text-right">Age</span>
                  </div>
                  {[
                    { type: 'BUY', price: priceFormatted, sol: '0.51 SOL', age: '1m ago', isBuy: true },
                    { type: 'BUY', price: priceFormatted, sol: '1.20 SOL', age: '3m ago', isBuy: true },
                    { type: 'SELL', price: priceFormatted, sol: '0.25 SOL', age: '5m ago', isBuy: false },
                    { type: 'BUY', price: priceFormatted, sol: '2.00 SOL', age: '8m ago', isBuy: true },
                  ].map((t, i) => (
                    <div key={i} className="grid grid-cols-4 items-center py-1.5 border-b border-[#171c2a]">
                      <span className={`font-black ${t.isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>{t.type}</span>
                      <span className="text-white">{t.price}</span>
                      <span className="text-center text-cyan-300 font-bold">{t.sol}</span>
                      <span className="text-right text-gray-400">{t.age}</span>
                    </div>
                  ))}
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
                    <span>Trader</span>
                    <span className="text-center">Total Volume</span>
                    <span className="text-right">Profit</span>
                  </div>
                  {[
                    { trader: '7vBx...1kPo', vol: '14.2 SOL', pnl: '+4.8 SOL' },
                    { trader: '3mKq...9xZa', vol: '9.5 SOL', pnl: '+2.1 SOL' },
                    { trader: '8zWp...4mNc', vol: '5.0 SOL', pnl: '+1.2 SOL' },
                  ].map((tr, idx) => (
                    <div key={idx} className="grid grid-cols-3 items-center py-1.5 border-b border-[#171c2a]">
                      <span className="text-white font-mono">{tr.trader}</span>
                      <span className="text-center text-gray-300">{tr.vol}</span>
                      <span className="text-right text-emerald-400 font-bold">{tr.pnl}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'devTokens' && (
                <div className="p-3 text-center text-gray-300 font-mono">
                  <span className="block font-bold text-white mb-1">Developer Historical Portfolio</span>
                  <span className="text-gray-400">Total Tokens Launched: <strong className="text-cyan-400">{coin.devTotalLaunches || 1}</strong></span>
                  <div className="mt-2 inline-block px-3 py-1 rounded bg-[#171c2a] border border-gray-700 text-xs">
                    Historical Avg ATH: <strong className="text-yellow-400">{coin.devAvgAthK ? `$${coin.devAvgAthK.toFixed(1)}K` : 'First Launch'}</strong>
                  </div>
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
                if (onBuy) onBuy(coin, tradeAmount);
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
