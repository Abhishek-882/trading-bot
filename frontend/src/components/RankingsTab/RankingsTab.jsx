import React, { useState, useMemo } from 'react';
import { useBotStore } from '../../stores/botStore';
import { CoinCard } from '../CoinCard/CoinCard';
import { MobileCoinCard } from './MobileCoinCard';
import { WatcherBadge } from '../Common/WatcherBadge';

export function RankingsTab({ onInspectCoin }) {
  const rankedCoins         = useBotStore(s => s.rankedCoins);
  const filters             = useBotStore(s => s.filters);
  const devFilters          = useBotStore(s => s.devFilters);
  const lastUpdated         = useBotStore(s => s.lastUpdated);
  const toggleMobileFilter  = useBotStore(s => s.toggleMobileFilter);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'most_watching' | 'low_risk' | 'high_risk'

  const timeAgo = lastUpdated
    ? `${Math.max(1, Math.round((Date.now() - lastUpdated) / 1000))}s ago`
    : 'connecting...';

  // Helper to test if a value falls within a min/max range
  const inRange = (value, range) => {
    if (!range) return true;
    const { min, max } = range;
    const num = parseFloat(value ?? 0);

    if (min !== '' && min !== null && min !== undefined) {
      const minVal = parseFloat(min);
      if (!isNaN(minVal) && num < minVal) return false;
    }
    if (max !== '' && max !== null && max !== undefined) {
      const maxVal = parseFloat(max);
      if (!isNaN(maxVal) && num > maxVal) return false;
    }
    return true;
  };

  // Real-time instant filtering matching FilterPanel inputs
  const activeFilteredCoins = useMemo(() => {
    return rankedCoins.filter(c => {
      // 1. Text Search (Symbol, Name, Mint Address)
      if (search) {
        const q = search.toLowerCase();
        const matches =
          (c.symbol && c.symbol.toLowerCase().includes(q)) ||
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // 2. Metric range filters (all 11 metrics from FilterPanel)
      if (!inRange(c.bCurvePercent,  filters.bCurve))      return false;
      if (!inRange(c.ageMinutes,     filters.age))         return false;
      if (!inRange(c.liquidityK,     filters.liquidity))   return false;
      if (!inRange(c.mktCapK,        filters.mktCap))      return false;
      if (!inRange(c.volumeK,        filters.volume))      return false;
      if (!inRange(c.netBuyK,        filters.netBuy))      return false;
      if (!inRange(c.txs,            filters.txs))         return false;
      if (!inRange(c.buys,           filters.buys))        return false;
      if (!inRange(c.sells,          filters.sells))       return false;
      if (!inRange(c.totalFeesSol,   filters.totalFees))   return false;
      if (!inRange(c.pumpLiveAgeMin, filters.pumpLiveAge)) return false;

      // 3. Dev Safety Filters (Min Net Worth & Max Rug %)
      if (devFilters.minDevTotalUsd !== '' && devFilters.minDevTotalUsd !== undefined) {
        const minUsd = parseFloat(devFilters.minDevTotalUsd);
        const devVal = parseFloat(c.devTotalValueUsd ?? (c.devBalanceSol || 0) * 150);
        if (!isNaN(minUsd) && devVal < minUsd) return false;
      }
      if (devFilters.maxRugPercent !== '' && devFilters.maxRugPercent !== undefined) {
        const maxRug = parseFloat(devFilters.maxRugPercent);
        const devRug = parseFloat(c.devRugPercent ?? 0);
        if (!isNaN(maxRug) && devRug > maxRug) return false;
      }

      // 4. Advanced Intelligence Filters (Solscan Pre-Funding, Website, ATH)
      if (filters.requirePreFunding) {
        if (!c.isPreFunded) return false;
        const minSol = parseFloat(filters.minPreFundSol || 5);
        if (!isNaN(minSol) && (c.preFundAmountSol || 0) < minSol && (c.devBalanceSol || 0) < minSol) return false;
      }
      if (filters.requireGenuineWebsite && !c.hasGenuineWebsite) return false;
      if (filters.requireBelowAvgAth && !c.isBelowAvgAth) return false;
      if (filters.minAthProbability !== '' && filters.minAthProbability !== undefined && filters.minAthProbability !== null) {
        const minP = parseFloat(filters.minAthProbability);
        if (!isNaN(minP) && (c.athReachProbability || 0) < minP) return false;
      }

      // 5. GMGN Min Watchers Filter
      if (filters.minWatchers !== '' && filters.minWatchers !== undefined && filters.minWatchers !== null) {
        const minW = parseInt(filters.minWatchers, 10);
        if (!isNaN(minW) && (c.watchersCount || 0) < minW) return false;
      }

      return true;
    });
  }, [rankedCoins, filters, devFilters, search]);

  // Section: Most Watching (Audience popularity sorted descending)
  const mostWatchingCoins = useMemo(() => {
    return [...activeFilteredCoins]
      .sort((a, b) => (b.watchersCount || 0) - (a.watchersCount || 0))
      .map((c, idx) => ({ ...c, sectionRank: idx + 1, section: 'most_watching' }));
  }, [activeFilteredCoins]);

  // Section: Community Takeovers (CTO - Decentralized, 0% Dev Rug Risk)
  const ctoCoins = useMemo(() => {
    return activeFilteredCoins
      .filter(c => c.isCTO || c.ctoClaimDate || (c.devRugPercent === 0 && (c.liquidityK || 0) > 15 && c.isDevVerified))
      .sort((a, b) => (b.liquidityK || 0) - (a.liquidityK || 0))
      .map((c, idx) => ({ ...c, sectionRank: idx + 1, section: 'cto' }));
  }, [activeFilteredCoins]);

  // Section: Boosted (Top DexScreener Promotional Boosts)
  const boostedCoins = useMemo(() => {
    return [...activeFilteredCoins]
      .filter(c => (c.activeBoosts || 0) > 0 || (c.dexPaid && (c.volumeK || 0) > 100))
      .sort((a, b) => (b.activeBoosts || 0) - (a.activeBoosts || 0))
      .map((c, idx) => ({ ...c, sectionRank: idx + 1, section: 'boosted' }));
  }, [activeFilteredCoins]);

  // Section 1: Low Risk (<20% Rug Risk → Ranked strictly by Dev Net Money)
  const lowRiskCoins = useMemo(() => {
    return activeFilteredCoins
      .filter(c => (c.devRugPercent ?? 0) < 20)
      .sort((a, b) => {
        const moneyA = parseFloat(a.devTotalValueUsd ?? (a.devBalanceSol || 0) * 150);
        const moneyB = parseFloat(b.devTotalValueUsd ?? (b.devBalanceSol || 0) * 150);
        return moneyB - moneyA;
      })
      .map((c, idx) => ({ ...c, sectionRank: idx + 1, section: 'low_risk' }));
  }, [activeFilteredCoins]);

  // Section 2: High Risk (≥20% Rug Risk → Ranked strictly by Net Profit)
  const highRiskCoins = useMemo(() => {
    return activeFilteredCoins
      .filter(c => (c.devRugPercent ?? 0) >= 20)
      .sort((a, b) => {
        const profitA = parseFloat(a.netBuyK ?? 0);
        const profitB = parseFloat(b.netBuyK ?? 0);
        if (profitB !== profitA) return profitB - profitA;
        return (b.volumeK || 0) - (a.volumeK || 0);
      })
      .map((c, idx) => ({ ...c, sectionRank: idx + 1, section: 'high_risk' }));
  }, [activeFilteredCoins]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Tab Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-gmgn-border">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-base sm:text-lg font-bold text-gmgn-text flex items-center gap-2">
            Market Suggestions
            <span className="text-xs font-normal text-gmgn-muted bg-gmgn-surface px-2 py-0.5 rounded border border-gmgn-border">
              {activeFilteredCoins.length} of {rankedCoins.length} match
            </span>
          </h1>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#16181c] border border-gmgn-border text-[11px] sm:text-xs text-gmgn-muted">
            <span className="live-dot w-2 h-2 rounded-full bg-gmgn-accent" />
            <span>Polls 30s · {timeAgo}</span>
          </div>

          {/* Mobile Filter Drawer Button */}
          <button
            type="button"
            onClick={toggleMobileFilter}
            className="lg:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1429] hover:bg-[#251c3d] border border-purple-500/40 text-purple-300 text-xs font-semibold active:scale-95 transition-all shadow-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search symbol, name, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="gmgn-input text-xs w-full"
          />
        </div>
      </div>

      {/* ── Section Selector Tabs ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4 bg-[#14161d] p-1 rounded-xl border border-gmgn-border overflow-x-auto">
        <button
          onClick={() => setActiveSection('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSection === 'all'
              ? 'bg-gmgn-surface text-white border border-gmgn-border shadow-sm'
              : 'text-gmgn-muted hover:text-white'
          }`}
        >
          All ({activeFilteredCoins.length})
        </button>

        {/* GMGN Most Watching Ranking Tab */}
        <button
          onClick={() => setActiveSection('most_watching')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSection === 'most_watching'
              ? 'bg-[#221736] text-[#d8b4fe] border border-[#a855f7]/50 shadow-[0_0_12px_-3px_rgba(168,85,247,0.4)]'
              : 'text-gmgn-muted hover:text-[#d8b4fe]'
          }`}
        >
          {/* Custom Vector Eye SVG */}
          <svg className="w-3.5 h-3.5 text-[#c084fc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3" />
          </svg>
          <span>Most Watching</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-[#c084fc] font-mono font-bold">
            {mostWatchingCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">Ranked by Viewers</span>
        </button>

        {/* CTO (Community Takeover) Tab */}
        <button
          onClick={() => setActiveSection('cto')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSection === 'cto'
              ? 'bg-[#0f241d] text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_-3px_rgba(16,185,129,0.4)]'
              : 'text-gmgn-muted hover:text-emerald-300'
          }`}
        >
          {/* Custom Vector Community Shield SVG */}
          <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <circle cx="12" cy="11" r="2" fill="currentColor" fillOpacity="0.4" />
          </svg>
          <span>CTO</span>
          <span className="text-[10px] bg-[#14231b] px-1.5 py-0.2 rounded text-emerald-300 font-mono font-bold">
            {ctoCoins.length}
          </span>
          <span className="text-[10px] text-emerald-400/80 font-normal hidden sm:inline">0% Dev Rug</span>
        </button>

        {/* Boosted Tab */}
        <button
          onClick={() => setActiveSection('boosted')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSection === 'boosted'
              ? 'bg-[#291b10] text-amber-300 border border-amber-500/50 shadow-[0_0_12px_-3px_rgba(245,158,11,0.4)]'
              : 'text-gmgn-muted hover:text-amber-300'
          }`}
        >
          {/* Custom Vector Boost Energy Bolt SVG */}
          <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>Boosted</span>
          <span className="text-[10px] bg-[#211710] px-1.5 py-0.2 rounded text-amber-300 font-mono font-bold">
            {boostedCoins.length}
          </span>
          <span className="text-[10px] text-amber-400/80 font-normal hidden sm:inline">Dex Boosts</span>
        </button>

        {/* Low Risk Tab */}
        <button
          onClick={() => setActiveSection('low_risk')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSection === 'low_risk'
              ? 'bg-[#f5c54220] text-gmgn-yellow border border-[#f5c54250]'
              : 'text-gmgn-muted hover:text-gmgn-yellow'
          }`}
        >
          {/* Custom Vector Shield SVG */}
          <svg className="w-3.5 h-3.5 text-gmgn-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Low Risk (&lt;20%)</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-gray-300">
            {lowRiskCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">Dev Net Money</span>
        </button>

        {/* High Risk Tab */}
        <button
          onClick={() => setActiveSection('high_risk')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeSection === 'high_risk'
              ? 'bg-[#00d4aa20] text-gmgn-accent border border-[#00d4aa50]'
              : 'text-gmgn-muted hover:text-gmgn-accent'
          }`}
        >
          {/* Custom Vector Lightning SVG */}
          <svg className="w-3.5 h-3.5 text-gmgn-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>High Profit (≥20%)</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-gray-300">
            {highRiskCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">Net Profit</span>
        </button>
      </div>

      {/* ── Content Area ──────────────────────────────────── */}
      <div className="space-y-6 overflow-y-auto pr-1 pb-16 lg:pb-6">
        {/* SECTION: Most Watching (Audience Interest) */}
        {activeSection === 'most_watching' && (
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#291e3b]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#25193d] border border-[#a855f7]/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#c084fc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-white">
                  Most Watching Tokens
                </h2>
                <span className="text-[11px] text-[#c084fc] bg-[#2d1b4d] border border-[#a855f7]/30 px-2 py-0.5 rounded font-mono font-medium">
                  Ranked by Active GMGN Viewers
                </span>
              </div>
              <span className="text-xs text-gmgn-muted font-mono">
                {mostWatchingCoins.length} tokens
              </span>
            </div>

            {mostWatchingCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No tokens match the active watcher criteria.
              </div>
            ) : (
              <>
                {/* Mobile View: High-density touch cards */}
                <div className="block md:hidden">
                  {mostWatchingCoins.map((coin, idx) => (
                    <MobileCoinCard key={coin.address || idx} coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  ))}
                </div>

                {/* Desktop View: Grid layout */}
                <div className="hidden md:grid md:grid-cols-1 xl:grid-cols-2 gap-3.5">
                  {mostWatchingCoins.map((coin, idx) => (
                    <CoinCard key={coin.address || idx} coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SECTION: Community Takeovers (CTO) */}
        {activeSection === 'cto' && (
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1c3327]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#10291e] border border-emerald-500/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <circle cx="12" cy="11" r="2" fill="currentColor" fillOpacity="0.4" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-white">
                  Community Takeovers (CTO)
                </h2>
                <span className="text-[11px] text-emerald-300 bg-[#122e22] border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-medium">
                  0% Dev Rug Risk · Community Governed
                </span>
              </div>
              <span className="text-xs text-gmgn-muted font-mono">
                {ctoCoins.length} tokens
              </span>
            </div>

            {ctoCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No Community Takeover (CTO) tokens currently detected on Solana.
              </div>
            ) : (
              <>
                <div className="block md:hidden">
                  {ctoCoins.map((coin, idx) => (
                    <MobileCoinCard key={coin.address || idx} coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  ))}
                </div>
                <div className="hidden md:grid md:grid-cols-1 xl:grid-cols-2 gap-3.5">
                  {ctoCoins.map((coin, idx) => (
                    <CoinCard key={coin.address || idx} coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SECTION: Top Boosted Tokens */}
        {activeSection === 'boosted' && (
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#362514]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#2b1c0e] border border-amber-500/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-white">
                  Top DexScreener Boosted Tokens
                </h2>
                <span className="text-[11px] text-amber-300 bg-[#362210] border border-amber-500/30 px-2 py-0.5 rounded font-mono font-medium">
                  Ranked by Active Promotional Boosts
                </span>
              </div>
              <span className="text-xs text-gmgn-muted font-mono">
                {boostedCoins.length} tokens
              </span>
            </div>

            {boostedCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No boosted tokens match active filter criteria.
              </div>
            ) : (
              <>
                <div className="block md:hidden">
                  {boostedCoins.map((coin, idx) => (
                    <MobileCoinCard key={coin.address || idx} coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  ))}
                </div>
                <div className="hidden md:grid md:grid-cols-1 xl:grid-cols-2 gap-3.5">
                  {boostedCoins.map((coin, idx) => (
                    <CoinCard key={coin.address || idx} coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SECTION 1: Low Risk (<20%) */}
        {(activeSection === 'all' || activeSection === 'low_risk') && (
          <div>
            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-[#222530]">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gmgn-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <h2 className="text-sm font-bold text-gmgn-text">
                  Section 1: Low Risk (&lt;20% Risk)
                </h2>
                <span className="text-[11px] text-gmgn-yellow bg-[#f5c54215] px-2 py-0.5 rounded font-mono font-medium">
                  Ranked by Dev Net Money
                </span>
              </div>
              <span className="text-xs text-gmgn-muted">
                {lowRiskCoins.length} tokens
              </span>
            </div>

            {lowRiskCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No tokens with &lt;20% rug risk match current filter parameters.
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="block md:hidden">
                  {lowRiskCoins.map((coin, idx) => (
                    <MobileCoinCard key={coin.address || idx} coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:grid md:grid-cols-1 xl:grid-cols-2 gap-3.5">
                  {lowRiskCoins.map((coin, idx) => (
                    <CoinCard key={coin.address || idx} coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* SECTION 2: High Profit (≥20% Risk) */}
        {(activeSection === 'all' || activeSection === 'high_risk') && (
          <div>
            <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-[#222530]">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gmgn-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <h2 className="text-sm font-bold text-gmgn-text">
                  Section 2: High Profit (≥20% Risk)
                </h2>
                <span className="text-[11px] text-gmgn-accent bg-[#00d4aa15] px-2 py-0.5 rounded font-mono font-medium">
                  Ranked by Net Profit / Net Buy
                </span>
              </div>
              <span className="text-xs text-gmgn-muted">
                {highRiskCoins.length} tokens
              </span>
            </div>

            {highRiskCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No high-risk / degen tokens currently pass active filters.
              </div>
            ) : (
              <>
                {/* Mobile View */}
                <div className="block md:hidden">
                  {highRiskCoins.map((coin, idx) => (
                    <MobileCoinCard key={coin.address || idx} coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  ))}
                </div>

                {/* Desktop View */}
                <div className="hidden md:grid md:grid-cols-1 xl:grid-cols-2 gap-3.5">
                  {highRiskCoins.map((coin, idx) => (
                    <CoinCard key={coin.address || idx} coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RankingsTab;
