import React, { useState } from 'react';

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

export function CoinCard({ coin, rank }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = (e) => {
    e.stopPropagation();
    if (coin.address) {
      navigator.clipboard.writeText(coin.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyDevAddress = (e) => {
    e.stopPropagation();
    if (coin.devAddress) {
      navigator.clipboard.writeText(coin.devAddress);
      alert(`Copied dev address: ${coin.devAddress}`);
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

  return (
    <div className="gmgn-card hover:border-gmgn-accent transition-all duration-200 coin-enter relative overflow-hidden group">
      {/* Top row: Rank, Symbol, Name, Score, Badges */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <span className="text-gmgn-accent font-bold text-base w-7 text-center">
            #{coin.sectionRank || rank || coin.rank || '-'}
          </span>
          <div className="w-8 h-8 rounded-full bg-[#20222a] flex items-center justify-center font-bold text-xs text-gmgn-accent border border-gmgn-border overflow-hidden">
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
            </div>
          </div>
        </div>

        {/* Right side: Section & Risk Badges */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${rugBadgeClass}`}>
              {rugText} ({rugPct.toFixed(0)}% rug)
            </span>
            <div className="bg-[#20222a] border border-gmgn-border px-2 py-0.5 rounded text-xs">
              <span className="text-gmgn-muted text-[10px] mr-1">Score</span>
              <span className="font-bold text-gmgn-accent">{coin.score ?? 0}</span>
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

      {/* Dev Wallet info row */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#22252e] text-gmgn-muted">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px]">Dev:</span>
          <button
            onClick={copyDevAddress}
            className="text-gmgn-text hover:text-gmgn-accent transition-colors font-mono text-[11px]"
            title="Click to copy full dev address"
          >
            {shortDev}
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
            className="text-[11px] text-gmgn-accent hover:underline flex items-center gap-0.5"
          >
            DexScreener ↗
          </a>
          <a
            href={`https://gmgn.ai/sol/token/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gmgn-muted hover:text-gmgn-accent hover:underline flex items-center gap-0.5"
          >
            GMGN ↗
          </a>
          <a
            href={`https://solscan.io/token/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gmgn-muted hover:text-white"
          >
            Solscan ↗
          </a>
        </div>
      </div>
    </div>
  );
}
