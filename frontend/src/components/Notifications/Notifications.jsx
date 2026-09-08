import React from 'react';
import { useBotStore } from '../../stores/botStore';

export function Notifications() {
  const notifications = useBotStore(s => s.notifications);
  const clearNotifications = useBotStore(s => s.clearNotifications);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <div className="flex justify-end pointer-events-auto">
        <button
          onClick={clearNotifications}
          className="text-[10px] text-gmgn-muted hover:text-gmgn-text bg-[#16181c] px-2 py-0.5 rounded border border-gmgn-border mb-1"
        >
          Clear alerts
        </button>
      </div>

      {notifications.slice(0, 5).map((item) => {
        let border = 'border-gmgn-accent';
        if (item.type === 'warning') border = 'border-gmgn-yellow';
        if (item.type === 'danger') border = 'border-gmgn-red';

        return (
          <div
            key={item.id}
            className={`pointer-events-auto bg-[#16181c] border ${border} rounded-lg p-3 shadow-xl flex items-start gap-2.5 coin-enter`}
          >
            <span className="text-sm">
              {item.type === 'success' ? '🚀' : item.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gmgn-text font-medium">{item.text}</p>
              {item.tx && (
                <a
                  href={`https://solscan.io/tx/${item.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-gmgn-accent hover:underline block mt-0.5 font-mono truncate"
                >
                  View tx: {item.tx.slice(0, 16)}...
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
