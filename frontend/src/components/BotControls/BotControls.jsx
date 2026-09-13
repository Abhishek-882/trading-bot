import React, { useState } from 'react';
import { useBotStore } from '../../stores/botStore';
import { useBot } from '../../hooks/useBot';

export function BotControls() {
  const botConfig = useBotStore(s => s.botConfig);
  const updateBotConfig = useBotStore(s => s.updateBotConfig);
  const updateTP = useBotStore(s => s.updateTP);
  const sessionPubkey = useBotStore(s => s.sessionPubkey);
  const sessionBalance = useBotStore(s => s.sessionBalanceSol);
  const connectedWallet = useBotStore(s => s.connectedWallet);

  const { activateBot, deactivateBot, withdrawFunds, saveBotConfig } = useBot();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleActivate = async () => {
    if (!connectedWallet) {
      alert('Please connect your Phantom wallet first.');
      return;
    }
    setLoading(true);
    try {
      await activateBot();
    } catch (err) {
      alert(`Error activating bot: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    try {
      await deactivateBot();
    } catch (err) {
      alert(`Error deactivating bot: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!sessionPubkey || sessionBalance <= 0) {
      alert('No funds in session wallet to withdraw.');
      return;
    }
    if (!confirm(`Are you sure you want to withdraw ${sessionBalance.toFixed(4)} SOL back to your main wallet?`)) {
      return;
    }
    setLoading(true);
    try {
      await withdrawFunds();
      alert('Funds withdrawn successfully!');
    } catch (err) {
      alert(`Withdraw failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await saveBotConfig(botConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const copySessionKey = () => {
    if (sessionPubkey) {
      navigator.clipboard.writeText(sessionPubkey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 max-w-4xl min-w-0">
      <div className="mb-4 pb-3 border-b border-gmgn-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gmgn-text">Bot Trading Control Center</h1>
          <p className="text-xs text-gmgn-muted mt-0.5">
            Configure autonomous buying, delegated session authority, take-profit ladders, and duplicate prevention.
          </p>
        </div>

        {saveSuccess && (
          <span className="badge-green animate-pulse">✓ Settings Saved</span>
        )}
      </div>

      {/* ── Delegated Session Wallet Card ── */}
      <div className="gmgn-card mb-5 border-gmgn-border">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <span className="text-xs font-semibold text-gmgn-muted uppercase tracking-wider">
              Delegated Session Authority
            </span>
            <h2 className="text-base font-bold text-gmgn-text mt-0.5">
              Autonomous Bot Wallet
            </h2>
            <p className="text-xs text-gmgn-muted mt-1 max-w-xl">
              The bot executes trades using a dedicated, server-encrypted keypair so you never have to manually confirm popups. Fund this address with the SOL you want the bot to trade with.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-gmgn-muted block">Session Balance</span>
            <span className="text-xl font-mono font-bold text-gmgn-accent">
              {sessionBalance.toFixed(4)} SOL
            </span>
          </div>
        </div>

        {sessionPubkey ? (
          <div className="bg-[#101114] p-3 rounded-lg border border-gmgn-border mb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gmgn-muted font-medium">Deposit Address:</span>
                <span className="font-mono text-xs text-gmgn-accent select-all bg-[#1a1c23] px-2 py-1 rounded">
                  {sessionPubkey}
                </span>
                <button
                  onClick={copySessionKey}
                  className="gmgn-btn-secondary text-xs px-2.5 py-1"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleWithdraw}
                  disabled={loading || sessionBalance <= 0}
                  className="gmgn-btn-secondary text-xs hover:text-gmgn-yellow"
                >
                  Withdraw to Main
                </button>
                <button
                  onClick={handleDeactivate}
                  disabled={loading}
                  className="gmgn-btn-danger text-xs"
                >
                  Deactivate Session
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gmgn-muted mt-2">
              💡 Send SOL from your Phantom wallet to this address. The bot will automatically use these funds to buy top filtered coins.
            </p>
          </div>
        ) : (
          <div className="bg-[#101114] p-4 rounded-lg border border-dashed border-gmgn-border flex items-center justify-between">
            <div className="text-xs text-gmgn-muted">
              No session wallet active. Create a session wallet to enable 24/7 background autonomous execution.
            </div>
            <button
              onClick={handleActivate}
              disabled={loading || !connectedWallet}
              className="gmgn-btn-primary text-xs"
            >
              {loading ? 'Generating Keypair...' : 'Create Session Wallet'}
            </button>
          </div>
        )}
      </div>

      {/* ── Bot Configuration Settings ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* Buy Rules Card */}
        <div className="gmgn-card">
          <h3 className="text-sm font-semibold text-gmgn-text mb-3 pb-2 border-b border-gmgn-border flex items-center justify-between">
            <span>Buy Rules</span>
            <span className="badge-green">Solana Jupiter DEX</span>
          </h3>

          <div className="space-y-3">
            {/* Auto Buy Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gmgn-text block">Auto-Buy Enabled</span>
                <span className="text-[11px] text-gmgn-muted">Buy immediately when coin passes all filters</span>
              </div>
              <input
                type="checkbox"
                checked={botConfig.autoBuy}
                onChange={(e) => updateBotConfig({ autoBuy: e.target.checked })}
                className="w-4 h-4 accent-[#00d4aa] cursor-pointer"
              />
            </div>

            {/* Buy Amount */}
            <div>
              <label className="text-xs text-gmgn-muted block mb-1">Buy Amount per Coin (SOL)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={botConfig.buyAmountSol}
                  onChange={(e) => updateBotConfig({ buyAmountSol: parseFloat(e.target.value) || 0 })}
                  className="gmgn-input"
                />
                <span className="text-xs text-gmgn-muted font-medium w-12">SOL</span>
              </div>
            </div>

            {/* Max Concurrent Positions */}
            <div>
              <label className="text-xs text-gmgn-muted block mb-1">Max Active Positions</label>
              <input
                type="number"
                min="1"
                max="20"
                value={botConfig.maxPositions}
                onChange={(e) => updateBotConfig({ maxPositions: parseInt(e.target.value, 10) || 1 })}
                className="gmgn-input"
              />
            </div>

            {/* Slippage */}
            <div>
              <label className="text-xs text-gmgn-muted block mb-1">Max Slippage (BPS)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="50"
                  value={botConfig.slippageBps}
                  onChange={(e) => updateBotConfig({ slippageBps: parseInt(e.target.value, 10) || 500 })}
                  className="gmgn-input"
                />
                <span className="text-xs text-gmgn-muted font-medium w-12">
                  {((botConfig.slippageBps || 500) / 100).toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Smart Cluster Auto-Buy Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded bg-[#10141d] border border-purple-500/20">
              <div>
                <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                  <span>🎯</span>
                  Auto-Buy Smart Money Clusters
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Instantly sniper-buy when 2+ qualified smart wallets converge on a clean setup
                </span>
              </div>
              <input
                type="checkbox"
                checked={botConfig.autoBuySmartClusters || false}
                onChange={(e) => updateBotConfig({ autoBuySmartClusters: e.target.checked })}
                className="w-4 h-4 accent-purple-500 cursor-pointer"
              />
            </div>

            {/* AI Top Picks Auto-Buy Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded bg-[#10141d] border border-cyan-500/20">
              <div>
                <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                  <span>🧠</span>
                  Auto-Buy AI Top Picks
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Buy tokens passing the 2-Gate AI ensemble with calibrated score ≥ 0.85
                </span>
              </div>
              <input
                type="checkbox"
                checked={botConfig.autoBuyAIPicks || false}
                onChange={(e) => updateBotConfig({ autoBuyAIPicks: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Jito MEV & Anti-Sandwich Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded bg-[#10141d] border border-emerald-500/20">
              <div>
                <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                  <span>⚡</span>
                  Jito MEV Fast Landing (&lt;600ms)
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Private bundle submission with dynamic tip floor &amp; zero sandwich risk
                </span>
              </div>
              <input
                type="checkbox"
                checked={botConfig.useJito ?? true}
                onChange={(e) => updateBotConfig({ useJito: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Duplicate prevention indicator */}
            <div className="p-2.5 rounded bg-[#101114] border border-[#232630] flex items-center gap-2">
              <span className="text-gmgn-accent text-sm">🛡️</span>
              <span className="text-[11px] text-gmgn-text">
                <strong>Anti-Duplicate Lock:</strong> Permanent database guard guarantees the bot never buys the same token twice.
              </span>
            </div>
          </div>
        </div>

        {/* Take Profit & Exit Strategy Card */}
        <div className="gmgn-card">
          <h3 className="text-sm font-semibold text-gmgn-text mb-3 pb-2 border-b border-gmgn-border flex items-center justify-between">
            <span>Parts of Close (Take Profit)</span>
            <span className="text-xs text-gmgn-muted">Auto-Sell Ladder</span>
          </h3>

          <div className="space-y-3">
            {botConfig.tpLevels.map((tp, idx) => (
              <div key={idx} className="p-2.5 rounded bg-[#121318] border border-gmgn-border">
                <div className="flex items-center justify-between text-xs font-semibold mb-2 text-gmgn-text">
                  <span>Take Profit Stage {idx + 1}</span>
                  <span className="text-gmgn-accent">Sell {tp.closePct}% at +{tp.triggerPct}% gain</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gmgn-muted block mb-0.5">Gain Target (%)</label>
                    <input
                      type="number"
                      value={tp.triggerPct}
                      onChange={(e) => updateTP(idx, { triggerPct: parseFloat(e.target.value) || 0 })}
                      className="gmgn-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gmgn-muted block mb-0.5">Close Amount (%)</label>
                    <input
                      type="number"
                      value={tp.closePct}
                      onChange={(e) => updateTP(idx, { closePct: parseFloat(e.target.value) || 0 })}
                      className="gmgn-input text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Stop Loss */}
            <div>
              <label className="text-xs text-gmgn-muted block mb-1">Stop Loss Trigger (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={botConfig.stopLossPct}
                  onChange={(e) => updateBotConfig({ stopLossPct: parseFloat(e.target.value) || -50 })}
                  className="gmgn-input text-gmgn-red"
                />
                <span className="text-xs text-gmgn-muted font-medium w-12">% loss</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Save Button */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="gmgn-btn-primary px-6"
        >
          {loading ? 'Saving...' : 'Save Bot Settings'}
        </button>
      </div>
    </div>
  );
}
