import React, { useState, useEffect } from 'react';
import { useBotStore } from '../../stores/botStore';

function ToastItem({ item, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start slow exit fade-out at 3.5s
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3500);

    // Completely remove after exit animation finishes (3.5s + 0.65s = 4.15s)
    const removeTimer = setTimeout(() => {
      onDismiss();
    }, 4150);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [onDismiss]);

  const handleManualDismiss = () => {
    setIsExiting(true);
    setTimeout(onDismiss, 400);
  };

  let border = 'border-gmgn-accent/60';
  let barColor = 'bg-gmgn-accent';
  let icon = 'ℹ️';

  if (item.type === 'success') {
    border = 'border-emerald-500/60';
    barColor = 'bg-emerald-400';
    icon = '🚀';
  } else if (item.type === 'warning') {
    border = 'border-amber-500/60';
    barColor = 'bg-amber-400';
    icon = '⚠️';
  } else if (item.type === 'danger') {
    border = 'border-rose-500/60';
    barColor = 'bg-rose-400';
    icon = '🚨';
  }

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden bg-[#14161f]/95 backdrop-blur-md border ${border} rounded-xl p-3 shadow-2xl flex items-start gap-2.5 transition-all ${
        isExiting ? 'toast-exit' : 'toast-enter'
      }`}
    >
      <span className="text-sm shrink-0 select-none mt-0.5">{icon}</span>

      <div className="flex-1 min-w-0 pr-4">
        <p className="text-xs text-white font-medium leading-snug">{item.text}</p>
        {item.tx && (
          <a
            href={`https://solscan.io/tx/${item.tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-cyan-400 hover:underline block mt-1 font-mono truncate"
          >
            View tx: {item.tx.slice(0, 16)}...
          </a>
        )}
      </div>

      {/* Manual close button */}
      <button
        onClick={handleManualDismiss}
        className="text-gray-400 hover:text-white p-0.5 rounded transition-colors text-xs shrink-0 select-none cursor-pointer"
        title="Dismiss alert"
      >
        ✕
      </button>

      {/* Subtle bottom progress bar countdown */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/40">
        <div className={`h-full ${barColor} toast-bar`} />
      </div>
    </div>
  );
}

export function Notifications() {
  const notifications = useBotStore(s => s.notifications);
  const removeNotification = useBotStore(s => s.removeNotification);
  const clearNotifications = useBotStore(s => s.clearNotifications);

  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-full pointer-events-none">
      {notifications.length > 2 && (
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={clearNotifications}
            className="text-[10px] text-gray-400 hover:text-white bg-[#14161f]/90 hover:bg-[#1c202d] px-2 py-0.5 rounded border border-gmgn-border transition-colors mb-0.5"
          >
            Clear all alerts
          </button>
        </div>
      )}

      {notifications.slice(0, 4).map((item) => (
        <ToastItem
          key={item.id}
          item={item}
          onDismiss={() => removeNotification(item.id)}
        />
      ))}
    </div>
  );
}
