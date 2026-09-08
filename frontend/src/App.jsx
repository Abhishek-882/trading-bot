import React, { useState } from 'react';
import { useBotStore } from './stores/botStore';
import { useBot } from './hooks/useBot';
import { FilterPanel } from './components/FilterPanel/FilterPanel';
import { RankingsTab } from './components/RankingsTab/RankingsTab';
import { BotControls } from './components/BotControls/BotControls';
import { TradesTab } from './components/TradesTab/TradesTab';
import { WalletConnector } from './components/WalletConnector/WalletConnector';
import { Notifications } from './components/Notifications/Notifications';
import { api } from './api/client';

export default function App() {
  const activeTab = useBotStore(s => s.activeTab);
  const setActiveTab = useBotStore(s => s.setActiveTab);
  const filters = useBotStore(s => s.filters);
  const devFilters = useBotStore(s => s.devFilters);
  const connectedWallet = useBotStore(s => s.connectedWallet);
  const setPresets = useBotStore(s => s.setPresets);
  const addNotification = useBotStore(s => s.addNotification);

  // Initialize bot hook (handles WebSocket connection & wallet sync)
  useBot();

  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleApplyFilters = async () => {
    try {
      await api.setFilters({ wallet: connectedWallet, filters, devFilters });
      addNotification({ type: 'info', text: 'Filters applied! Polling updated tokens...' });
    } catch (err) {
      alert(`Error applying filters: ${err.message}`);
    }
  };

  const handleSavePresetPrompt = () => {
    if (!connectedWallet) {
      alert('Please connect your wallet first to save filter presets.');
      return;
    }
    setSavingPreset(true);
  };

  const handleConfirmSavePreset = async (e) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    try {
      await api.savePreset({
        wallet: connectedWallet,
        name: presetName.trim(),
        filters,
        devFilters,
      });
      const presets = await api.getPresets(connectedWallet);
      setPresets(presets);
      setSavingPreset(false);
      setPresetName('');
      addNotification({ type: 'success', text: `Preset "${presetName}" saved successfully!` });
    } catch (err) {
      alert(`Failed to save preset: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gmgn-bg text-gmgn-text flex flex-col">
      {/* ── Top Navigation Header ── */}
      <header className="border-b border-gmgn-border bg-[#101114] sticky top-0 z-30 px-5 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-gmgn-accent to-emerald-400 flex items-center justify-center font-black text-black text-base shadow-lg shadow-gmgn-accent/20">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide text-gmgn-text">GMGN BOT</span>
                <span className="badge-green text-[10px]">SOLANA AUTOPILOT</span>
              </div>
              <span className="text-[11px] text-gmgn-muted block">
                Meme Coin Sniper & Rug Guard
              </span>
            </div>
          </div>

          {/* Wallet Connector */}
          <WalletConnector />
        </div>
      </header>

      {/* ── Sub Navigation Tabs ── */}
      <div className="border-b border-gmgn-border bg-[#131418] px-5">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'suggestions' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            Current Suggestions
          </button>
          <button
            onClick={() => setActiveTab('bot')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'bot' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            Bot Controls
          </button>
          <button
            onClick={() => setActiveTab('trades')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'trades' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            Trade History
          </button>
        </div>
      </div>

      {/* ── Main Layout Body ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-5 flex flex-col md:flex-row gap-5 items-start">
        {/* Left Side: Filter Panel (matches user screenshot) */}
        <FilterPanel
          onApply={handleApplyFilters}
          onSave={handleSavePresetPrompt}
          onReset={() => addNotification({ type: 'info', text: 'Filters reset to defaults.' })}
        />

        {/* Right Side: Tab Contents */}
        <div className="flex-1 w-full min-w-0">
          {activeTab === 'suggestions' && <RankingsTab />}
          {activeTab === 'bot' && <BotControls />}
          {activeTab === 'trades' && <TradesTab />}
        </div>
      </main>

      {/* ── Preset Modal ── */}
      {savingPreset && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="gmgn-card max-w-sm w-full border-gmgn-border">
            <h3 className="text-sm font-bold text-gmgn-text mb-1">Save Filter Preset</h3>
            <p className="text-xs text-gmgn-muted mb-3">
              Save your current 11-field coin filter & dev safety threshold for 1-click loading.
            </p>
            <form onSubmit={handleConfirmSavePreset}>
              <input
                type="text"
                placeholder="e.g. Low MC Gem Hunter"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                autoFocus
                className="gmgn-input text-xs mb-3"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setSavingPreset(false)}
                  className="gmgn-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gmgn-btn-primary text-xs"
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Real-time Toast Notifications ── */}
      <Notifications />
    </div>
  );
}
