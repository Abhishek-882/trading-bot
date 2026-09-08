import React, { useState } from 'react';

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
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-gmgn-accent font-bold text-base w-6 text-center">
            #{rank || coin.rank || '-'}
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
            <div className="flex items-center gap-1.5 text-xs text-gmgn-muted mt-0.5">
              <span>{shortCoin}</span>
              <button
                onClick={copyAddress}
                className="hover:text-gmgn-accent transition-colors text-[10px] px-1 py-0.2 bg-[#20222a] rounded"
                title="Copy token mint"
              >
                {copied ? '✓' : 'copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Score & Risk Badge */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${rugBadgeClass}`}>
              {rugText} ({rugPct.toFixed(0)}% rug)
            </span>
            <div className="bg-[#20222a] border border-gmgn-border px-2 py-0.5 rounded text-xs">
              <span className="text-gmgn-muted text-[10px] mr-1">Score</span>
              <span className="font-bold text-gmgn-accent">{coin.score ?? 0}</span>
            </div>
          </div>
          <span className="text-xs text-gmgn-text font-mono mt-1">
            ${coin.price ? coin.price.toFixed(6) : '0.000000'}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2 bg-[#121317] p-2.5 rounded-lg text-xs mb-3 border border-[#22252e]">
        <div>
          <span className="text-gmgn-muted block text-[10px]">MKT Cap</span>
          <span className="font-medium text-gmgn-text">${(coin.mktCapK ?? 0).toFixed(1)}K</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Liquidity</span>
          <span className="font-medium text-gmgn-text">${(coin.liquidityK ?? 0).toFixed(1)}K</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Volume</span>
          <span className="font-medium text-gmgn-text">${(coin.volumeK ?? 0).toFixed(1)}K</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Net Buy</span>
          <span className={`font-medium ${(coin.netBuyK ?? 0) >= 0 ? 'text-gmgn-green' : 'text-gmgn-red'}`}>
            {(coin.netBuyK ?? 0) >= 0 ? '+' : ''}{(coin.netBuyK ?? 0).toFixed(1)}K
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
          <span className="font-medium text-gmgn-text">{coin.txs ?? 0} ({coin.buys ?? 0}/{coin.sells ?? 0})</span>
        </div>
        <div>
          <span className="text-gmgn-muted block text-[10px]">Fees</span>
          <span className="font-medium text-gmgn-text">{(coin.totalFeesSol ?? 0).toFixed(2)} SOL</span>
        </div>
      </div>

      {/* Dev Wallet info row */}
      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#22252e] text-gmgn-muted">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">Dev:</span>
          <button
            onClick={copyDevAddress}
            className="text-gmgn-text hover:text-gmgn-accent transition-colors font-mono"
            title="Click to copy full dev address"
          >
            {shortDev}
          </button>
          <span className="text-[11px] bg-[#1e2028] px-1.5 py-0.2 rounded text-gmgn-yellow">
            {(coin.devBalanceSol ?? 0).toFixed(2)} SOL
          </span>
          {coin.devTotalLaunches !== null && (
            <span className="text-[10px] text-gmgn-muted">
              ({coin.devTotalLaunches} launches)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`https://gmgn.ai/sol/token/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gmgn-accent hover:underline flex items-center gap-0.5"
          >
            GMGN ↗
          </a>
          <a
            href={`https://solscan.io/token/${coin.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gmgn-muted hover:text-gmgn-text"
          >
            Solscan ↗
          </a>
        </div>
      </div>
    </div>
  );
}
