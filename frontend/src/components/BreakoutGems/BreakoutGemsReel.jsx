import React, { useRef, useState } from 'react';
import { motionEngine } from '../../engine/motionPipeline';
import { sound } from '../../engine/soundFX';
import { useBotStore } from '../../stores/botStore';

const formatMcap = (k) => {
  if (!k || isNaN(k)) return '$0K';
  if (k >= 1000000) return `$${(k / 1000000).toFixed(2)}B`;
  if (k >= 1000) return `$${(k / 1000).toFixed(1)}M`;
  return `$${k.toFixed(1)}K`;
};

const formatNetBuy = (k) => {
  if (!k || isNaN(k)) return '+0K';
  const prefix = k >= 0 ? '+' : '';
  const abs = Math.abs(k);
  if (abs >= 1000000) return `${prefix}${(k / 1000000).toFixed(2)}B`;
  if (abs >= 1000) return `${prefix}${(k / 1000).toFixed(1)}M`;
  return `${prefix}${k.toFixed(1)}K`;
};

export function BreakoutGemsReel({ coins, onInspectCoin, onSelectCoin }) {
  const trackRef = useRef(null);
  const [dragState, setDragState] = useState({ isDragging: false, startX: 0, scrollLeft: 0 });
  const storeCoins = useBotStore(s => s.rankedCoins);
  const activeCoins = coins || storeCoins || [];

  // Filter top 12 breakout gems (high volume / score / net buy)
  const breakoutGems = activeCoins
    .filter(c => (c.mktCapK || 0) >= 30 || (c.score || 0) >= 70 || (c.netBuyK || 0) > 20)
    .slice(0, 12);

  if (!breakoutGems.length) return null;

  const handlePointerDown = (e) => {
    const pageX = e.pageX ?? (e.touches && e.touches[0]?.pageX) ?? 0;
    setDragState({
      isDragging: true,
      startX: pageX - (trackRef.current?.offsetLeft || 0),
      scrollLeft: trackRef.current?.scrollLeft || 0,
    });
  };

  const handlePointerMove = (e) => {
    if (!dragState.isDragging || !trackRef.current) return;
    e.preventDefault();
    const pageX = e.pageX ?? (e.touches && e.touches[0]?.pageX) ?? 0;
    const x = pageX - (trackRef.current.offsetLeft || 0);
    const walk = (x - dragState.startX) * 1.5;
    trackRef.current.scrollLeft = dragState.scrollLeft - walk;
  };

  const handlePointerUp = () => {
    setDragState(prev => ({ ...prev, isDragging: false }));
  };

  const handleGemClick = (coin) => {
    sound.playHoloPing();
    const handler = onInspectCoin || onSelectCoin;
    if (handler) handler(coin);
  };

  return (
    <div className="mb-4 bg-[#111319] border border-[#212634] rounded-2xl p-3 shadow-lg relative overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="flex items-center gap-2">
          <span className="text-base animate-pulse">🔥</span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Breakout Gems Reel
          </h2>
          <span className="text-[10px] text-gmgn-accent bg-gmgn-accent/10 border border-gmgn-accent/30 px-2 py-0.5 rounded-full font-mono">
            Top Breakout Momentum · Live Audit
          </span>
        </div>
        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
          Scroll down or drag sideways
        </span>
      </div>

      {/* Horizontal Scroll Track */}
      <div
        ref={trackRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        className="flex gap-3 overflow-x-auto no-scrollbar scroll-smooth cursor-grab active:cursor-grabbing pb-1 select-none"
        style={{ contain: 'layout paint' }}
      >
        {breakoutGems.map((coin, idx) => (
          <div
            key={coin.address || idx}
            onClick={() => handleGemClick(coin)}
            className="flex-shrink-0 w-52 bg-[#171922] hover:bg-[#1d212d] border border-[#262c3b] hover:border-gmgn-accent rounded-xl p-2.5 transition-all duration-200 transform hover:-translate-y-1 hover:shadow-xl group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#202533] flex items-center justify-center font-bold text-xs text-gmgn-accent border border-[#2c3345] overflow-hidden">
                  {coin.logo ? (
                    <img src={coin.logo} alt={coin.symbol} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    (coin.symbol || '?').slice(0, 3)
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-gmgn-accent transition-colors">
                    {coin.symbol}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate max-w-[90px]">
                    {coin.name}
                  </div>
                </div>
              </div>

              <div className="bg-[#12141a] px-1.5 py-0.5 rounded text-[10px] font-bold text-gmgn-yellow border border-[#222736]">
                ★ {coin.score || 85}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px] bg-[#101217] p-1.5 rounded-lg border border-[#1e222e]">
              <div>
                <span className="text-gray-500 block text-[9px]">MKT CAP</span>
                <span className="font-bold text-gray-200">{formatMcap(coin.mktCapK)}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block text-[9px]">NET BUY</span>
                <span className={`font-bold ${(coin.netBuyK ?? 0) >= 0 ? 'text-gmgn-green' : 'text-gmgn-red'}`}>
                  {formatNetBuy(coin.netBuyK)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] text-gray-400 mt-1.5 px-0.5">
              <span>{coin.txs ?? 0} TXs</span>
              <span className="text-gmgn-accent group-hover:underline font-semibold">Audit & Trade ↗</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
