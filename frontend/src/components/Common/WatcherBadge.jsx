import React from 'react';

/**
 * WatcherBadge — GMGN 1:1 Parity Audience Engagement Metric
 * Displays the bespoke vector eye reticle and real-time watcher count.
 * Features an organic breathing luminescent pulse when viewers are actively spiking.
 */
export function WatcherBadge({ count = 0, delta = 0, size = 'sm', className = '', showLabel = false }) {
  const num = typeof count === 'number' ? count : parseInt(count || 0, 10);
  const formattedCount = num >= 1000000 
    ? `${(num / 1000000).toFixed(1)}M`
    : num >= 1000
    ? `${(num / 1000).toFixed(1)}K`
    : num.toLocaleString();

  const isHot = num >= 100 || delta >= 5;
  const isSurging = delta >= 10;

  const sizeClasses = size === 'xs'
    ? 'text-[10px] px-1 py-0.2 gap-0.5'
    : size === 'md'
    ? 'text-xs px-2 py-0.5 gap-1.5'
    : 'text-[11px] px-1.5 py-0.5 gap-1';

  return (
    <div
      className={`inline-flex items-center font-mono font-bold rounded tracking-tight transition-all duration-300 select-none group relative ${
        isHot
          ? 'bg-[#1b1530] text-[#c084fc] border border-[#a855f7]/40 shadow-[0_0_12px_-3px_rgba(168,85,247,0.35)]'
          : 'bg-[#131722] text-[#9d8ba7] border border-[#2b2438] hover:border-[#a855f7]/30 hover:text-[#d8b4fe]'
      } ${sizeClasses} ${className}`}
      title={`Live GMGN Watchers: ${num.toLocaleString()} traders active${delta > 0 ? ` (+${delta} surging)` : ''}`}
    >
      {/* Bespoke GMGN Vector Eye SVG Icon */}
      <svg
        className={`shrink-0 transition-transform duration-300 group-hover:scale-110 ${
          size === 'xs' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'
        } ${isHot ? 'text-[#c084fc]' : 'text-[#8b7a99]'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Eye Contour */}
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
        {/* Iris & Pupil */}
        <circle cx="12" cy="12" r="3.2" fill={isHot ? 'currentColor' : 'none'} fillOpacity={isHot ? '0.3' : '0'} />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        {/* Organic Shimmer Reflection */}
        {isHot && (
          <circle cx="13.2" cy="10.8" r="0.6" fill="#ffffff" />
        )}
      </svg>

      {/* Numerical Count */}
      <span className="leading-none">{formattedCount}</span>

      {showLabel && (
        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-sans font-medium ml-0.5">
          watching
        </span>
      )}

      {/* Real-time Surge Pulse Dot */}
      {isSurging && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500" />
        </span>
      )}
    </div>
  );
}

export default WatcherBadge;
