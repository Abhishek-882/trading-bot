import React, { useState, useMemo, useEffect } from 'react';
import { useBotStore } from '../../stores/botStore';
import { CoinCard } from '../CoinCard/CoinCard';
import { MobileCoinCard } from './MobileCoinCard';
import { WatcherBadge } from '../Common/WatcherBadge';
import soundFX from '../../engine/soundFX';

// Domain Tiers & Classification (matching backend WebsiteVerifierService)
export const BEST_TLDS = ['.com', '.in', '.org', '.net', '.io', '.ai', '.co', '.app'];
export const SMALL_TLDS = [
  '.xyz', '.fun', '.top', '.site', '.online', '.tech', '.vip', '.cc', '.me', '.pw',
  '.cash', '.zone', '.space', '.live', '.pro', '.store', '.club', '.digital',
  '.network', '.finance', '.world', '.art', '.wiki', '.bio', '.link'
];
export const BLACKLIST_DOMAINS = [
  'pump.fun', 'letsbonk.fun', 'bonk.fun', 'four.meme', 'moonshot.cc',
  't.me', 'telegram.me', 'telegram.org', 'twitter.com', 'x.com',
  'discord.gg', 'discord.com', 'dexscreener.com', 'gmgn.ai', 'solscan.io',
  'solana.com', 'birdeye.so', 'dextools.io', 'github.com', 'medium.com',
  'reddit.com', 'youtube.com'
];

export const getCoinDomainDetails = (c) => {
  if (!c) return { hasWebsite: false, domain: null, tier: 'none', url: null };
  const url = c.websiteUrl || c.website || (Array.isArray(c.websites) ? (typeof c.websites[0] === 'string' ? c.websites[0] : c.websites[0]?.url) : null);
  if (!url || typeof url !== 'string') {
    return { hasWebsite: false, domain: null, tier: 'none', url: null };
  }
  try {
    let formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) formatted = 'https://' + formatted;
    const u = new URL(formatted);
    const domain = u.hostname.toLowerCase().replace(/^www\./, '');
    if (BLACKLIST_DOMAINS.some(bl => domain === bl || domain.endsWith('.' + bl) || domain.includes('pump.fun') || domain.includes('letsbonk') || domain.includes('four.meme'))) {
      return { hasWebsite: false, domain, tier: 'none', url: formatted };
    }
    let tier = 'other';
    if (BEST_TLDS.some(tld => domain.endsWith(tld))) tier = 'best';
    else if (SMALL_TLDS.some(tld => domain.endsWith(tld))) tier = 'small';
    return { hasWebsite: true, domain, tier, url: formatted };
  } catch {
    return { hasWebsite: false, domain: null, tier: 'none', url: null };
  }
};

export function RankingsTab({ onInspectCoin }) {
  const rankedCoins         = useBotStore(s => s.rankedCoins);
  const filters             = useBotStore(s => s.filters);
  const devFilters          = useBotStore(s => s.devFilters);
  const lastUpdated         = useBotStore(s => s.lastUpdated);
  const toggleMobileFilter  = useBotStore(s => s.toggleMobileFilter);
  const resetFilters        = useBotStore(s => s.resetFilters);
  const setFilter           = useBotStore(s => s.setFilter);
  const setDevFilter        = useBotStore(s => s.setDevFilter);
  const setToggleFilter     = useBotStore(s => s.setToggleFilter);
  const [search, setSearch] = useState('');
  const [selectedFilters, setSelectedFilters] = useState(new Set()); // Empty = 'all'
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [displayLimit, setDisplayLimit] = useState(40);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleFilter = (key) => {
    setSelectedFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedFilters(new Set());
  };

  const handleAllClick = () => {
    soundFX.playClick?.(1.0);
    clearAllFilters();
    // If 0 tokens matched or filters are active, clear all panel filters too so user gets all tokens
    if (activeFilteredCoins.length === 0 || activeFilterChips.length > 0) {
      resetFilters();
      setSearch('');
    }
  };

  const handleResetEverything = () => {
    soundFX.playChime?.();
    clearAllFilters();
    resetFilters();
    setSearch('');
  };

  const isAllMode = selectedFilters.size === 0;
  const isChecked = (key) => selectedFilters.has(key);

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

      // Strict Domain Tier & Genuine Website Filter
      const domainInfo = getCoinDomainDetails(c);
      const isGenuine = Boolean(c.hasGenuineWebsite || domainInfo.hasWebsite);
      const coinTier = (c.domainTier && c.domainTier !== 'none') ? c.domainTier : domainInfo.tier;

      if (filters.requireGenuineWebsite && (!isGenuine || coinTier === 'none')) {
        return false;
      }
      if (filters.domainTier && filters.domainTier !== 'none') {
        if (!isGenuine || coinTier === 'none') return false;
        if (filters.domainTier === 'best' && coinTier !== 'best') return false;
        if (filters.domainTier === 'small' && coinTier !== 'small') return false;
        if (filters.domainTier === 'all' && coinTier === 'none') return false;
      }

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

      // 6. GMGN Security Matrix Filters (User Uploaded Grid)
      if (filters.maxTop10Percent !== '' && filters.maxTop10Percent !== undefined && filters.maxTop10Percent !== null) {
        const maxVal = parseFloat(filters.maxTop10Percent);
        const coinTop10 = c.top10Percent != null
          ? parseFloat(c.top10Percent.replace('%', ''))
          : (c.top10Rate != null ? c.top10Rate * 100 : null);
        if (coinTop10 == null) return false;
        if (!isNaN(maxVal) && coinTop10 > maxVal) return false;
      }
      if (filters.maxDevHoldPercent !== '' && filters.maxDevHoldPercent !== undefined && filters.maxDevHoldPercent !== null) {
        const maxVal = parseFloat(filters.maxDevHoldPercent);
        const coinDevHold = c.devHoldPercent != null
          ? parseFloat(c.devHoldPercent.replace('%', ''))
          : (c.devHoldRate != null ? c.devHoldRate * 100 : null);
        if (coinDevHold == null && !c.isCTO) return false;
        if (!isNaN(maxVal) && (coinDevHold || 0) > maxVal) return false;
      }
      if (filters.minHolders !== '' && filters.minHolders !== undefined && filters.minHolders !== null) {
        const minVal = parseInt(filters.minHolders, 10);
        const coinHolders = parseInt(c.holdersCount || 0, 10);
        if (!isNaN(minVal) && coinHolders < minVal) return false;
      }
      if (filters.maxSnipersPercent !== '' && filters.maxSnipersPercent !== undefined && filters.maxSnipersPercent !== null) {
        const maxVal = parseFloat(filters.maxSnipersPercent);
        const coinSnipers = c.snipersPercent != null
          ? parseFloat(c.snipersPercent.replace('%', ''))
          : (c.snipersRate != null ? c.snipersRate * 100 : null);
        if (coinSnipers == null) return false;
        if (!isNaN(maxVal) && coinSnipers > maxVal) return false;
      }
      if (filters.maxInsidersPercent !== '' && filters.maxInsidersPercent !== undefined && filters.maxInsidersPercent !== null) {
        const maxVal = parseFloat(filters.maxInsidersPercent);
        const coinInsiders = c.insidersPercent != null
          ? parseFloat(c.insidersPercent.replace('%', ''))
          : (c.insidersRate != null ? c.insidersRate * 100 : null);
        if (coinInsiders == null) return false;
        if (!isNaN(maxVal) && coinInsiders > maxVal) return false;
      }
      if (filters.maxPhishingPercent !== '' && filters.maxPhishingPercent !== undefined && filters.maxPhishingPercent !== null) {
        const maxVal = parseFloat(filters.maxPhishingPercent);
        const coinPhish = c.phishingPercent != null
          ? parseFloat(c.phishingPercent.replace('%', ''))
          : (c.phishingRate != null ? c.phishingRate * 100 : null);
        if (coinPhish == null) return false;
        if (!isNaN(maxVal) && coinPhish > maxVal) return false;
      }
      if (filters.maxBundlerPercent !== '' && filters.maxBundlerPercent !== undefined && filters.maxBundlerPercent !== null) {
        const maxVal = parseFloat(filters.maxBundlerPercent);
        const coinBundler = c.bundlerPercent != null
          ? parseFloat(c.bundlerPercent.replace('%', ''))
          : (c.bundlerRate != null ? c.bundlerRate * 100 : null);
        if (coinBundler == null) return false;
        if (!isNaN(maxVal) && coinBundler > maxVal) return false;
      }
      if (filters.requireDexPaid) {
        if (!c.dexPaid) return false;
      }
      if (filters.requireNoMint) {
        if (c.noMint !== true) return false;
      }
      if (filters.requireNoBlacklist) {
        if (c.noBlacklist !== true) return false;
      }
      if (filters.minBurntPercent !== '' && filters.minBurntPercent !== undefined && filters.minBurntPercent !== null) {
        const minVal = parseFloat(filters.minBurntPercent);
        const coinBurnt = c.burntPercent != null
          ? parseFloat(c.burntPercent.replace('%', ''))
          : (c.burntRatio != null ? c.burntRatio * 100 : null);
        if (coinBurnt == null) return false;
        if (!isNaN(minVal) && coinBurnt < minVal) return false;
      }
      if (filters.maxRugPercent !== '' && filters.maxRugPercent !== undefined && filters.maxRugPercent !== null) {
        const maxVal = parseFloat(filters.maxRugPercent);
        const coinRug = parseFloat(c.rugPercentNum ?? c.devRugPercent ?? 0);
        if (!isNaN(maxVal) && coinRug > maxVal) return false;
      }

      return true;
    });
  }, [rankedCoins, filters, devFilters, search]);

  // Compute active filters list for display & quick removal
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (search.trim()) {
      chips.push({ id: 'search', label: `Search: "${search}"`, clear: () => setSearch('') });
    }
    // Metric ranges
    const metricLabels = {
      bCurve: 'B.Curve', age: 'Age', liquidity: 'Liquidity', mktCap: 'MKT Cap',
      volume: 'Volume', netBuy: 'Net Buy', txs: 'TXs', buys: 'Buys', sells: 'Sells',
      totalFees: 'Fees', pumpLiveAge: 'Pump Age'
    };
    Object.entries(metricLabels).forEach(([key, label]) => {
      const r = filters[key];
      if (r && (r.min !== '' || r.max !== '')) {
        let txt = label;
        if (r.min !== '' && r.max !== '') txt += `: ${r.min}-${r.max}`;
        else if (r.min !== '') txt += ` ≥ ${r.min}`;
        else if (r.max !== '') txt += ` ≤ ${r.max}`;
        chips.push({ id: key, label: txt, clear: () => { setFilter(key, 'min', ''); setFilter(key, 'max', ''); } });
      }
    });
    // Dev filters
    if (devFilters.minDevTotalUsd !== '') {
      chips.push({ id: 'minDevTotalUsd', label: `Dev ≥ $${devFilters.minDevTotalUsd}`, clear: () => setDevFilter('minDevTotalUsd', '') });
    }
    if (devFilters.maxRugPercent !== '') {
      chips.push({ id: 'maxRugPercent', label: `Max Rug ≤ ${devFilters.maxRugPercent}%`, clear: () => setDevFilter('maxRugPercent', '') });
    }
    // Advanced & Solscan
    if (filters.requirePreFunding) {
      chips.push({ id: 'preFund', label: `Pre-Fund ≥ ${filters.minPreFundSol || 5} SOL`, clear: () => setToggleFilter('requirePreFunding', false) });
    }
    if (filters.requireGenuineWebsite && (!filters.domainTier || filters.domainTier === 'none')) {
      chips.push({ id: 'genuineWeb', label: 'Genuine Website', clear: () => { setToggleFilter('requireGenuineWebsite', false); setToggleFilter('domainTier', 'none'); } });
    }
    if (filters.domainTier && filters.domainTier !== 'none') {
      const tierLabel = filters.domainTier === 'best'
        ? 'Domain: Best TLDs (.com, .org, .io...)'
        : filters.domainTier === 'small'
        ? 'Domain: Small TLDs (.xyz, .fun...)'
        : 'Domain: Any Genuine';
      chips.push({
        id: 'domainTier',
        label: tierLabel,
        clear: () => {
          setToggleFilter('domainTier', 'none');
          setToggleFilter('requireGenuineWebsite', false);
        }
      });
    }
    if (filters.requireBelowAvgAth) {
      chips.push({ id: 'belowAth', label: 'Below Avg ATH', clear: () => setToggleFilter('requireBelowAvgAth', false) });
    }
    if (filters.minAthProbability !== '') {
      chips.push({ id: 'minAthProb', label: `ATH Prob ≥ ${filters.minAthProbability}%`, clear: () => setToggleFilter('minAthProbability', '') });
    }
    if (filters.minWatchers !== '') {
      chips.push({ id: 'minWatchers', label: `Watchers ≥ ${filters.minWatchers}`, clear: () => setToggleFilter('minWatchers', '') });
    }
    // GMGN Security Matrix
    if (filters.requireNoMint) {
      chips.push({ id: 'noMint', label: 'NoMint Renounced', clear: () => setToggleFilter('requireNoMint', false) });
    }
    if (filters.requireNoBlacklist) {
      chips.push({ id: 'noBlacklist', label: 'No Blacklist', clear: () => setToggleFilter('requireNoBlacklist', false) });
    }
    if (filters.requireDexPaid) {
      chips.push({ id: 'dexPaid', label: 'Dex Paid Only', clear: () => setToggleFilter('requireDexPaid', false) });
    }
    if (filters.maxTop10Percent !== '') {
      chips.push({ id: 'maxTop10', label: `Top 10 ≤ ${filters.maxTop10Percent}%`, clear: () => setToggleFilter('maxTop10Percent', '') });
    }
    if (filters.maxDevHoldPercent !== '') {
      chips.push({ id: 'maxDevHold', label: `DEV Hold ≤ ${filters.maxDevHoldPercent}%`, clear: () => setToggleFilter('maxDevHoldPercent', '') });
    }
    if (filters.minHolders !== '') {
      chips.push({ id: 'minHolders', label: `Holders ≥ ${filters.minHolders}`, clear: () => setToggleFilter('minHolders', '') });
    }
    if (filters.maxSnipersPercent !== '') {
      chips.push({ id: 'maxSnipers', label: `Snipers ≤ ${filters.maxSnipersPercent}%`, clear: () => setToggleFilter('maxSnipersPercent', '') });
    }
    if (filters.maxInsidersPercent !== '') {
      chips.push({ id: 'maxInsiders', label: `Insiders ≤ ${filters.maxInsidersPercent}%`, clear: () => setToggleFilter('maxInsidersPercent', '') });
    }
    if (filters.maxPhishingPercent !== '') {
      chips.push({ id: 'maxPhishing', label: `Phishing ≤ ${filters.maxPhishingPercent}%`, clear: () => setToggleFilter('maxPhishingPercent', '') });
    }
    if (filters.maxBundlerPercent !== '') {
      chips.push({ id: 'maxBundler', label: `Bundler ≤ ${filters.maxBundlerPercent}%`, clear: () => setToggleFilter('maxBundlerPercent', '') });
    }
    if (filters.minBurntPercent !== '') {
      chips.push({ id: 'minBurnt', label: `Burnt ≥ ${filters.minBurntPercent}%`, clear: () => setToggleFilter('minBurntPercent', '') });
    }
    return chips;
  }, [filters, devFilters, search]);


  // Section: Top Searched (Priority 1: Dev Net Worth/SOL -> Priority 2: Watchers -> Priority 3: Volume/Swaps)
  const topSearchedCoins = useMemo(() => {
    return [...activeFilteredCoins]
      .sort((a, b) => {
        const valA = parseFloat(a.devTotalValueUsd ?? (a.devBalanceSol || 0) * 150);
        const valB = parseFloat(b.devTotalValueUsd ?? (b.devBalanceSol || 0) * 150);
        if (Math.abs(valB - valA) >= 50) return valB - valA;
        const watchA = a.watchersCount || 0;
        const watchB = b.watchersCount || 0;
        if (watchB !== watchA) return watchB - watchA;
        const volA = parseFloat(a.volumeK || 0);
        const volB = parseFloat(b.volumeK || 0);
        if (volB !== volA) return volB - volA;
        return (b.txs || 0) - (a.txs || 0);
      })
      .map((c, idx) => ({ ...c, sectionRank: idx + 1, section: 'top_searched' }));
  }, [activeFilteredCoins]);

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
          <h1 className="text-base sm:text-lg font-bold flex items-center gap-2">
            <span className="text-gradient-meme">Market Suggestions</span>
            <span className="text-xs font-normal text-gmgn-muted bg-gmgn-surface px-2 py-0.5 rounded border border-gmgn-border">
              {activeFilteredCoins.length} of {rankedCoins.length} match
            </span>
          </h1>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#16181c] border border-gmgn-border text-[11px] sm:text-xs text-gmgn-muted">
            <span className="relative flex h-2 w-2">
              <span className="live-ring absolute inline-flex h-full w-full rounded-full bg-gmgn-accent opacity-75" />
              <span className="live-dot relative inline-flex rounded-full h-2 w-2 bg-gmgn-accent" />
            </span>
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

      {/* ── Filter & Ranking Selector Pills (Toggleable & Uncheckable) ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-4 bg-[#14161d] p-1.5 rounded-xl border border-gmgn-border overflow-x-auto">
        {/* Reset / All Button */}
        <button
          type="button"
          onClick={handleAllClick}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all btn-press ${
            isAllMode
              ? 'bg-gmgn-surface text-white border border-gmgn-border shadow-sm'
              : 'text-gmgn-muted hover:text-white'
          }`}
          title="Show all ranking sections (Click to reset all filters)"
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
            isAllMode ? 'border-white/80 bg-white/20 text-white' : 'border-gray-500/50 text-transparent'
          }`}>
            ✓
          </span>
          <span>All ({activeFilteredCoins.length})</span>
        </button>

        {/* 1. Top Searched Ranking Filter (Priority 1: Dev Worth -> Priority 2: Viewers -> Priority 3: Volume) */}
        <button
          type="button"
          onClick={() => toggleFilter('top_searched')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            isChecked('top_searched')
              ? 'bg-[#2d1b12] text-orange-300 border border-orange-500/60 shadow-[0_0_12px_-2px_rgba(249,115,22,0.4)]'
              : 'text-gmgn-muted hover:text-orange-300 hover:bg-[#1a151b]'
          }`}
          title="Click to check or uncheck Top Searched filter"
        >
          {/* Checkbox box indicator */}
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
            isChecked('top_searched') ? 'border-orange-400 bg-orange-500/30 text-orange-200' : 'border-gray-600/60 text-transparent'
          }`}>
            ✓
          </span>
          {/* Flame / Search vector icon */}
          <svg className="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
          <span>Top Searched</span>
          <span className="text-[10px] bg-[#1e1518] px-1.5 py-0.2 rounded text-orange-300 font-mono font-bold">
            {topSearchedCoins.length}
          </span>
          <span className="text-[10px] text-orange-400/80 font-normal hidden md:inline">Dev Worth ➔ Viewers</span>
        </button>

        {/* 2. GMGN Most Watching Ranking Filter */}
        <button
          type="button"
          onClick={() => toggleFilter('most_watching')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            isChecked('most_watching')
              ? 'bg-[#221736] text-[#d8b4fe] border border-[#a855f7]/50 shadow-[0_0_12px_-3px_rgba(168,85,247,0.4)]'
              : 'text-gmgn-muted hover:text-[#d8b4fe] hover:bg-[#191523]'
          }`}
          title="Click to check or uncheck Most Watching filter"
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
            isChecked('most_watching') ? 'border-purple-400 bg-purple-500/30 text-purple-200' : 'border-gray-600/60 text-transparent'
          }`}>
            ✓
          </span>
          <svg className="w-3.5 h-3.5 text-[#c084fc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3" />
          </svg>
          <span>Most Watching</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-[#c084fc] font-mono font-bold">
            {mostWatchingCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal hidden md:inline">Viewers</span>
        </button>

        {/* 3. CTO (Community Takeover) Filter */}
        <button
          type="button"
          onClick={() => toggleFilter('cto')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            isChecked('cto')
              ? 'bg-[#0f241d] text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_-3px_rgba(16,185,129,0.4)]'
              : 'text-gmgn-muted hover:text-emerald-300 hover:bg-[#121c17]'
          }`}
          title="Click to check or uncheck CTO filter"
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
            isChecked('cto') ? 'border-emerald-400 bg-emerald-500/30 text-emerald-200' : 'border-gray-600/60 text-transparent'
          }`}>
            ✓
          </span>
          <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <circle cx="12" cy="11" r="2" fill="currentColor" fillOpacity="0.4" />
          </svg>
          <span>CTO</span>
          <span className="text-[10px] bg-[#14231b] px-1.5 py-0.2 rounded text-emerald-300 font-mono font-bold">
            {ctoCoins.length}
          </span>
          <span className="text-[10px] text-emerald-400/80 font-normal hidden md:inline">0% Rug</span>
        </button>

        {/* 4. Boosted Filter */}
        <button
          type="button"
          onClick={() => toggleFilter('boosted')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            isChecked('boosted')
              ? 'bg-[#291b10] text-amber-300 border border-amber-500/50 shadow-[0_0_12px_-3px_rgba(245,158,11,0.4)]'
              : 'text-gmgn-muted hover:text-amber-300 hover:bg-[#1a1512]'
          }`}
          title="Click to check or uncheck Boosted filter"
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
            isChecked('boosted') ? 'border-amber-400 bg-amber-500/30 text-amber-200' : 'border-gray-600/60 text-transparent'
          }`}>
            ✓
          </span>
          <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>Boosted</span>
          <span className="text-[10px] bg-[#211710] px-1.5 py-0.2 rounded text-amber-300 font-mono font-bold">
            {boostedCoins.length}
          </span>
          <span className="text-[10px] text-amber-400/80 font-normal hidden md:inline">Boosts</span>
        </button>

        {/* 5. Low Risk Filter (<20%) */}
        <button
          type="button"
          onClick={() => toggleFilter('low_risk')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            isChecked('low_risk')
              ? 'bg-[#f5c54220] text-gmgn-yellow border border-[#f5c54260] shadow-[0_0_12px_-3px_rgba(245,197,66,0.3)]'
              : 'text-gmgn-muted hover:text-gmgn-yellow hover:bg-[#1a1914]'
          }`}
          title="Click to check or uncheck Low Risk filter"
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
            isChecked('low_risk') ? 'border-yellow-400 bg-yellow-500/30 text-yellow-200' : 'border-gray-600/60 text-transparent'
          }`}>
            ✓
          </span>
          <svg className="w-3.5 h-3.5 text-gmgn-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Low Risk (&lt;20%)</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-gray-300">
            {lowRiskCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal hidden md:inline">Dev Net Worth</span>
        </button>

        {/* 6. High Profit Filter (≥20%) */}
        <button
          type="button"
          onClick={() => toggleFilter('high_risk')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            isChecked('high_risk')
              ? 'bg-[#00d4aa20] text-gmgn-accent border border-[#00d4aa60] shadow-[0_0_12px_-3px_rgba(0,212,170,0.3)]'
              : 'text-gmgn-muted hover:text-gmgn-accent hover:bg-[#121c1a]'
          }`}
          title="Click to check or uncheck High Profit filter"
        >
          <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
            isChecked('high_risk') ? 'border-[#00d4aa] bg-[#00d4aa]/30 text-[#00d4aa]' : 'border-gray-600/60 text-transparent'
          }`}>
            ✓
          </span>
          <svg className="w-3.5 h-3.5 text-gmgn-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>High Profit (≥20%)</span>
          <span className="text-[10px] bg-[#1a1d26] px-1.5 py-0.2 rounded text-gray-300">
            {highRiskCoins.length}
          </span>
          <span className="text-[10px] text-gray-400 font-normal hidden md:inline">Net Profit</span>
        </button>
      </div>

      {/* ── Active Filter Chips Bar (Instant visibility & quick removal) ── */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-[#141722] border border-[#232a3d]">
          <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1 mr-1">
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Active Filters ({activeFilterChips.length}):
          </span>
          {activeFilterChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
            >
              <span>{chip.label}</span>
              <button
                onClick={chip.clear}
                className="w-3.5 h-3.5 rounded-full hover:bg-cyan-500/30 flex items-center justify-center text-cyan-300 hover:text-white transition-colors"
                title="Remove this filter"
              >
                ✕
              </button>
            </span>
          ))}
          <button
            onClick={handleResetEverything}
            className="ml-auto text-xs text-rose-400 hover:text-rose-300 underline font-medium px-2 py-0.5 rounded hover:bg-rose-500/10 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}

      {/* ── Loading Skeleton State ── */}
      {rankedCoins.length === 0 && (
        <div className="p-8 rounded-2xl bg-[#131620] border border-[#232a3d] text-center flex flex-col items-center justify-center gap-3 my-6 animate-pulse">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 animate-spin flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          </div>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Connecting to GMGN Live Stream & DexScreener Engine...
          </h3>
          <p className="text-xs text-gray-400 max-w-md">
            Scanning 1,100+ Solana tokens, calculating Solscan pre-funding audits, and ranking by Dev Net Worth and audience watchers.
          </p>
        </div>
      )}

      {/* ── Zero Tokens Recovery State ── */}
      {rankedCoins.length > 0 && activeFilteredCoins.length === 0 && (
        <div className="p-8 rounded-2xl bg-[#151926] border border-[#2b354d] text-center flex flex-col items-center justify-center gap-3 my-6 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xl font-bold">
            !
          </div>
          <h3 className="text-base font-bold text-white">
            0 Tokens Match Current Filters
          </h3>
          <p className="text-xs text-gray-400 max-w-lg leading-relaxed">
            Your active filters or domain category are currently filtering out all <span className="text-white font-semibold">{rankedCoins.length}</span> discovered Solana meme tokens.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <button
              onClick={handleResetEverything}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-gray-950 font-bold text-xs hover:opacity-95 shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset All Filters (Show All {rankedCoins.length} Tokens)
            </button>
            <button
              onClick={() => {
                setToggleFilter('domainTier', 'none');
                setToggleFilter('requireGenuineWebsite', false);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#1d2232] border border-[#343e5c] text-xs text-cyan-300 hover:bg-[#252c40] transition-colors"
            >
              Clear Website / Domain Filter
            </button>
          </div>
        </div>
      )}

      {/* ── Content Area ──────────────────────────────────── */}
      <div className="space-y-6 overflow-y-auto pr-1 pb-16 lg:pb-6">
        {/* SECTION: Top Searched Tokens */}
        {isChecked('top_searched') && (
          <div className="section-enter">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#362114]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#2b170e] border border-orange-500/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Top Searched Tokens
                </h2>
                <span className="text-[11px] text-orange-300 bg-[#331c10] border border-orange-500/30 px-2 py-0.5 rounded font-mono font-medium">
                  Rank 1: Dev Net Worth ➔ Rank 2: Viewers (👁) ➔ Rank 3: Volume
                </span>
              </div>
              <span className="text-xs text-gmgn-muted font-mono">
                {topSearchedCoins.length} tokens
              </span>
            </div>

            {topSearchedCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No tokens currently match the Top Searched criteria.
              </div>
            ) : isMobile ? (
              <div>
                {topSearchedCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <MobileCoinCard coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {topSearchedCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <CoinCard coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION: Most Watching (Audience Interest) */}
        {isChecked('most_watching') && (
          <div className="section-enter">
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
            ) : isMobile ? (
              <div>
                {mostWatchingCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <MobileCoinCard coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {mostWatchingCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <CoinCard coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION: Community Takeovers (CTO) */}
        {isChecked('cto') && (
          <div className="section-enter">
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
            ) : isMobile ? (
              <div>
                {ctoCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <MobileCoinCard coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {ctoCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <CoinCard coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION: Top Boosted Tokens */}
        {isChecked('boosted') && (
          <div className="section-enter">
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
            ) : isMobile ? (
              <div>
                {boostedCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <MobileCoinCard coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {boostedCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <CoinCard coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 1: Low Risk (<20%) */}
        {(isAllMode || isChecked('low_risk')) && (
          <div className="section-enter">
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
              <span className="text-xs text-gmgn-muted font-mono">
                {lowRiskCoins.length} tokens
              </span>
            </div>

            {lowRiskCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No tokens with &lt;20% rug risk match current filter parameters.
              </div>
            ) : isMobile ? (
              <div>
                {lowRiskCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <MobileCoinCard coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {lowRiskCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <CoinCard coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  </div>
                ))}
              </div>
            )}

            {lowRiskCoins.length > displayLimit && (
              <div className="flex justify-center mt-3 mb-2">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 40)}
                  className="px-4 py-1.5 text-xs font-mono font-medium rounded-lg bg-[#141824] hover:bg-[#1e2436] border border-gmgn-border text-gmgn-accent hover:border-gmgn-accent transition-all cursor-pointer shadow-sm"
                >
                  Load More Low Risk Tokens ({displayLimit} of {lowRiskCoins.length}) ↓
                </button>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: High Profit (≥20% Risk) */}
        {(isAllMode || isChecked('high_risk')) && (
          <div className="section-enter">
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
              <span className="text-xs text-gmgn-muted font-mono">
                {highRiskCoins.length} tokens
              </span>
            </div>

            {highRiskCoins.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#14161c] border border-gmgn-border text-center text-xs text-gmgn-muted">
                No high-risk / degen tokens currently pass active filters.
              </div>
            ) : isMobile ? (
              <div>
                {highRiskCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <MobileCoinCard coin={coin} index={idx} onInspect={onInspectCoin} onSelect={onInspectCoin} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                {highRiskCoins.slice(0, displayLimit).map((coin, idx) => (
                  <div key={coin.address || idx} className="coin-list-item">
                    <CoinCard coin={coin} rank={idx + 1} onInspect={onInspectCoin} />
                  </div>
                ))}
              </div>
            )}

            {highRiskCoins.length > displayLimit && (
              <div className="flex justify-center mt-3 mb-2">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 40)}
                  className="px-4 py-1.5 text-xs font-mono font-medium rounded-lg bg-[#141824] hover:bg-[#1e2436] border border-gmgn-border text-gmgn-accent hover:border-gmgn-accent transition-all cursor-pointer shadow-sm"
                >
                  Load More High Profit Tokens ({displayLimit} of {highRiskCoins.length}) ↓
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RankingsTab;
