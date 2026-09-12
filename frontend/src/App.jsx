import React, { useState, useEffect } from 'react';
import { useBotStore } from './stores/botStore';
import { useBot } from './hooks/useBot';
import { FilterPanel } from './components/FilterPanel/FilterPanel';
import { RankingsTab } from './components/RankingsTab/RankingsTab';
import { BotControls } from './components/BotControls/BotControls';
import { TradesTab } from './components/TradesTab/TradesTab';
import { WalletConnector } from './components/WalletConnector/WalletConnector';
import { Notifications } from './components/Notifications/Notifications';
import { api } from './api/client';
import motionPipeline from './engine/motionPipeline';
import soundFX from './engine/soundFX';
import { ThreeCore } from './components/3D/ThreeCore';
import { TelemetryHUD } from './components/HUD/TelemetryHUD';
import { BreakoutGemsReel } from './components/BreakoutGems/BreakoutGemsReel';
import { TokenInspectionModal } from './components/TokenInspection/TokenInspectionModal';
import { GmgnCoinDetailsModal } from './components/CoinDetails/GmgnCoinDetailsModal';

export default function App() {
  const activeTab = useBotStore((s) => s.activeTab);
  const setActiveTab = useBotStore((s) => s.setActiveTab);
  const filters = useBotStore((s) => s.filters);
  const devFilters = useBotStore((s) => s.devFilters);
  const connectedWallet = useBotStore((s) => s.connectedWallet);
  const setPresets = useBotStore((s) => s.setPresets);
  const addNotification = useBotStore((s) => s.addNotification);
  const isMobileFilterOpen = useBotStore((s) => s.isMobileFilterOpen);
  const setIsMobileFilterOpen = useBotStore((s) => s.setIsMobileFilterOpen);
  const toggleMobileFilter = useBotStore((s) => s.toggleMobileFilter);

  // Initialize bot hook (handles WebSocket connection & wallet sync)
  useBot();

  // 3D Museum Turntable Inspection Modal state
  const [inspectedCoin, setInspectedCoin] = useState(null);

  // Filter preset dialog state
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  // ── Initialize 5-Phase Motion, Physics & Hardware Interrupt Loop ──
  useEffect(() => {
    motionPipeline.init();
    return () => {
      motionPipeline.destroy();
    };
  }, []);

  const handleTabChange = (tab) => {
    soundFX.playClick(1.05);
    setActiveTab(tab);
  };

  const handleApplyFilters = async () => {
    soundFX.playClick(1.2);
    try {
      await api.setFilters({ wallet: connectedWallet, filters, devFilters });
      addNotification({ type: 'info', text: 'Filters applied! Polling updated tokens...' });
    } catch (err) {
      alert(`Error applying filters: ${err.message}`);
    }
  };

  const handleSavePresetPrompt = () => {
    soundFX.playClick(1.0);
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
      soundFX.playClick(1.2);
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
      soundFX.playChime();
      addNotification({ type: 'success', text: `Preset "${presetName}" saved successfully!` });
    } catch (err) {
      alert(`Failed to save preset: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gmgn-bg text-gmgn-text flex flex-col relative overflow-x-hidden">
      {/* ── Phase 5: GPU Three.js Sacred Geometry Background Canvas ── */}
      <ThreeCore />

      {/* ── ALCHE Studio Cyber-Editorial Telemetry Gimbal HUD ── */}
      <TelemetryHUD />

      {/* ── Top Navigation Header ── */}
      <header className="border-b border-gmgn-border bg-[#101114]/90 backdrop-blur-md sticky top-0 z-30 px-5 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden border border-cyan-500/40 shadow-lg shadow-cyan-500/20 bg-[#0e131b] flex items-center justify-center shrink-0">
              <img src="/mascot.jpg" alt="GMGN Bot" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-wide text-white">GMGN Trading Bot</span>
                <span className="badge-green text-[10px] font-mono tracking-wider">LIVE TELEMETRY</span>
              </div>
              <span className="text-[11px] text-gray-400 block font-mono">
                Institutional Solana Sniper &amp; Dev Audit
              </span>
            </div>
          </div>

          {/* Wallet Connector */}
          <WalletConnector />
        </div>
      </header>

      {/* ── Sub Navigation Tabs ── */}
      <div className="border-b border-gmgn-border bg-[#131418]/90 backdrop-blur-md px-5 relative z-20">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          <button
            onClick={() => handleTabChange('suggestions')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'suggestions' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            Current Suggestions
          </button>
          <button
            onClick={() => handleTabChange('bot')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'bot' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            Bot Controls
          </button>
          <button
            onClick={() => handleTabChange('trades')}
            className={`py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'trades' ? 'tab-active' : 'tab-inactive'
            }`}
          >
            Trade History
          </button>
        </div>
      </div>

      {/* ── Breakout Velocity Reel Carousel (Vertical-to-Horizontal Momentum) ── */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-5 pt-4 relative z-10">
        <BreakoutGemsReel onInspectCoin={setInspectedCoin} />
      </div>

      {/* ── Main Layout Body ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-5 items-start relative z-10">
        {/* Left Side: Desktop Filter Panel (hidden on mobile/tablet, visible on lg) */}
        <div className="hidden lg:block shrink-0">
          <FilterPanel
            onApply={handleApplyFilters}
            onSave={handleSavePresetPrompt}
            onReset={() => {
              soundFX.playClick(0.9);
              addNotification({ type: 'info', text: 'Filters reset to defaults.' });
            }}
          />
        </div>

        {/* Mobile Filter Drawer (Slide-out bottom sheet for mobile viewports) */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/80 backdrop-blur-sm transition-opacity">
            <div
              className="fixed inset-0"
              onClick={() => setIsMobileFilterOpen(false)}
            />
            <div className="relative z-10 bg-[#0c1018] border-t border-[#26334d] rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col">
              {/* Drawer Drag Handle */}
              <div className="w-12 h-1.5 bg-[#2d3a52] rounded-full mx-auto mb-3 shrink-0" />
              <div className="flex items-center justify-between pb-2 border-b border-[#1e2738] mb-3">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  Trading Filters & Presets
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="w-8 h-8 rounded-lg bg-[#182030] hover:bg-[#25324d] text-slate-300 flex items-center justify-center text-sm font-bold active:scale-95 transition-all"
                >
                  ✕
                </button>
              </div>
              <FilterPanel
                isMobileDrawer
                onApply={() => {
                  handleApplyFilters();
                  setIsMobileFilterOpen(false);
                }}
                onSave={handleSavePresetPrompt}
                onReset={() => {
                  soundFX.playClick(0.9);
                  addNotification({ type: 'info', text: 'Filters reset to defaults.' });
                }}
              />
            </div>
          </div>
        )}

        {/* Right Side: Tab Contents */}
        <div className="flex-1 w-full min-w-0">
          {activeTab === 'suggestions' && (
            <RankingsTab onInspectCoin={setInspectedCoin} />
          )}
          {activeTab === 'bot' && <BotControls />}
          {activeTab === 'trades' && <TradesTab />}
        </div>
      </main>

      {/* ── GMGN Institutional Coin Details & Security Matrix Studio ── */}
      {inspectedCoin && (
        <GmgnCoinDetailsModal
          coin={inspectedCoin}
          onClose={() => setInspectedCoin(null)}
          onBuy={async (coinToBuy, solAmount) => {
            if (!connectedWallet) {
              addNotification({ type: 'warning', text: 'Please connect your Solana wallet first!' });
              return;
            }
            try {
              soundFX.playTradeSuccess();
              addNotification({ type: 'info', text: `Initiating buy for ${solAmount} SOL of $${coinToBuy.symbol}...` });
              await api.executeTrade({
                userWallet: connectedWallet,
                tokenAddress: coinToBuy.address,
                amountSol: parseFloat(solAmount),
                action: 'BUY',
              });
              addNotification({ type: 'success', text: `Successfully bought $${coinToBuy.symbol}!` });
            } catch (err) {
              addNotification({ type: 'error', text: `Trade failed: ${err.message}` });
            }
          }}
        />
      )}

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
                  onClick={() => {
                    soundFX.playClick(0.9);
                    setSavingPreset(false);
                  }}
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
