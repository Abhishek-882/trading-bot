import React from 'react';
import { useBotStore } from '../../stores/botStore';

export function TradesTab() {
  const trades = useBotStore(s => s.trades);
  const connectedWallet = useBotStore(s => s.connectedWallet);

  return (
    <div className="flex-1 max-w-5xl min-w-0">
      <div className="mb-4 pb-3 border-b border-gmgn-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gmgn-text">Trade History & Positions</h1>
          <p className="text-xs text-gmgn-muted mt-0.5">
            Real-time record of all automated purchases, transaction signatures, and take-profit executions.
          </p>
        </div>
        <span className="text-xs text-gmgn-muted bg-gmgn-surface px-2.5 py-1 rounded border border-gmgn-border">
          {trades.length} Total Trades
        </span>
      </div>

      {!connectedWallet ? (
        <div className="gmgn-card py-16 text-center text-xs text-gmgn-muted">
          Connect your wallet to inspect active positions and past trades.
        </div>
      ) : trades.length === 0 ? (
        <div className="gmgn-card py-16 text-center">
          <div className="text-3xl mb-2">📜</div>
          <h3 className="text-sm font-semibold text-gmgn-text mb-1">No trades executed yet</h3>
          <p className="text-xs text-gmgn-muted max-w-md mx-auto">
            Once you activate the bot and top up your session wallet, trades will execute automatically when tokens match your filter rules.
          </p>
        </div>
      ) : (
        <div className="gmgn-card p-0 overflow-hidden border border-gmgn-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gmgn-border bg-[#121318] text-gmgn-muted text-[11px] uppercase tracking-wider font-semibold">
                  <th className="p-3">Token</th>
                  <th className="p-3">Buy Price</th>
                  <th className="p-3">Amount (SOL)</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Take Profit</th>
                  <th className="p-3">Executed At</th>
                  <th className="p-3 text-right">Transaction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gmgn-border">
                {trades.map((trade) => {
                  const shortCoin = trade.coin_address
                    ? `${trade.coin_address.slice(0, 4)}...${trade.coin_address.slice(-4)}`
                    : '';
                  const shortSig = trade.tx_signature
                    ? `${trade.tx_signature.slice(0, 6)}...${trade.tx_signature.slice(-4)}`
                    : 'N/A';

                  return (
                    <tr key={trade.id} className="hover:bg-[#15171d] transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gmgn-text">{trade.coin_symbol}</span>
                          <span className="text-[10px] text-gmgn-muted font-mono">{shortCoin}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-gmgn-text">
                        {trade.buy_price_sol ? parseFloat(trade.buy_price_sol).toFixed(6) : '-'} SOL
                      </td>
                      <td className="p-3 font-mono font-semibold text-gmgn-accent">
                        {trade.amount_sol ? parseFloat(trade.amount_sol).toFixed(3) : '-'} SOL
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          trade.status === 'closed'
                            ? 'bg-gmgn-muted bg-opacity-20 text-gmgn-muted'
                            : 'bg-gmgn-accent bg-opacity-20 text-gmgn-accent'
                        }`}>
                          {trade.status || 'open'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${trade.tp1_hit ? 'bg-gmgn-green text-black font-bold' : 'bg-[#22252e] text-gmgn-muted'}`}>
                            TP1
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${trade.tp2_hit ? 'bg-gmgn-green text-black font-bold' : 'bg-[#22252e] text-gmgn-muted'}`}>
                            TP2
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] ${trade.tp3_hit ? 'bg-gmgn-green text-black font-bold' : 'bg-[#22252e] text-gmgn-muted'}`}>
                            TP3
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-gmgn-muted font-mono text-[11px]">
                        {trade.created_at ? new Date(trade.created_at).toLocaleTimeString() : '-'}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {trade.tx_signature ? (
                          <a
                            href={`https://solscan.io/tx/${trade.tx_signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gmgn-accent hover:underline text-[11px]"
                          >
                            {shortSig} ↗
                          </a>
                        ) : (
                          <span className="text-gmgn-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
