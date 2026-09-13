import { useBotStore } from '../../stores/botStore';
import soundFX from '../../engine/soundFX';

// Filter field definitions matching the GMGN trench layout + Smart Money & KOL filters
const FIELDS = [
  { key: 'bCurve',       label: 'B. Curve',       unitMin: '%',   unitMax: '%'   },
  { key: 'age',          label: 'Age',             unitMin: 'min', unitMax: 'min' },
  { key: 'liquidity',    label: 'Liquidity',       unitMin: 'K',   unitMax: 'K'   },
  { key: 'mktCap',       label: 'MKT Cap',         unitMin: 'K',   unitMax: 'K'   },
  { key: 'volume',       label: 'Volume',          unitMin: 'K',   unitMax: 'K'   },
  { key: 'netBuy',       label: 'Net Buy',         unitMin: 'K',   unitMax: 'K'   },
  { key: 'txs',          label: 'TXs',             unitMin: '',    unitMax: ''    },
  { key: 'buys',         label: 'Buys',            unitMin: '',    unitMax: ''    },
  { key: 'sells',        label: 'Sells',           unitMin: '',    unitMax: ''    },
  { key: 'totalFees',    label: 'Total Fees',      unitMin: 'SOL', unitMax: 'SOL' },
  { key: 'pumpLiveAge',  label: 'Pump Live Age',   unitMin: 'min', unitMax: 'min' },
  { key: 'smartWallets', label: '🧠 Smart Wallets', unitMin: '',   unitMax: ''    },
  { key: 'smartWinRate', label: '🎯 Smart WinRate', unitMin: '%',  unitMax: '%'   },
  { key: 'kolWallets',   label: '⭐ KOL Wallets',   unitMin: '',   unitMax: ''    },
];

function FilterRow({ field }) {
  const setFilter = useBotStore(s => s.setFilter);
  const filters   = useBotStore(s => s.filters);
  const val       = filters[field.key] || { min: '', max: '' };

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#20222a] last:border-0 gap-2">
      {/* Label */}
      <span className="text-xs text-gray-300 font-medium w-24 shrink-0 truncate">
        {field.label}
      </span>

      {/* Min & Max inputs */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Min */}
        <div className="relative flex-1 min-w-0">
          <input
            type="number"
            placeholder="Min"
            value={val.min}
            onChange={e => setFilter(field.key, 'min', e.target.value)}
            className={`w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 text-xs text-white font-mono font-semibold placeholder:text-gray-500 placeholder:font-normal focus:outline-none focus:border-gmgn-accent ${
              field.unitMin ? 'pr-6' : ''
            }`}
          />
          {field.unitMin && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">
              {field.unitMin}
            </span>
          )}
        </div>

        {/* Max */}
        <div className="relative flex-1 min-w-0">
          <input
            type="number"
            placeholder="Max"
            value={val.max}
            onChange={e => setFilter(field.key, 'max', e.target.value)}
            className={`w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 text-xs text-white font-mono font-semibold placeholder:text-gray-500 placeholder:font-normal focus:outline-none focus:border-gmgn-accent ${
              field.unitMax ? 'pr-6' : ''
            }`}
          />
          {field.unitMax && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">
              {field.unitMax}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function FilterPanel({ onApply, onSave, onReset, isMobileDrawer = false }) {
  const filters    = useBotStore(s => s.filters);
  const devFilters = useBotStore(s => s.devFilters);
  const setFilter  = useBotStore(s => s.setFilter);
  const setDevFilter = useBotStore(s => s.setDevFilter);
  const setToggleFilter = useBotStore(s => s.setToggleFilter);
  const resetFilters = useBotStore(s => s.resetFilters);

  const presets    = useBotStore(s => s.presets);
  const setAllFilters = useBotStore(s => s.setAllFilters);

  const handleReset = () => { resetFilters(); onReset?.(); };

  const isPresetActive = filters.mktCap?.max === '500' && filters.smartWinRate?.min === '60' && filters.smartWallets?.min === '1';

  return (
    <div className={`gmgn-card flex flex-col gap-3 ${isMobileDrawer ? 'w-full shadow-none border-0 p-1 bg-transparent' : 'w-80 sm:w-[325px] shrink-0 border border-gmgn-border'}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-gmgn-border">
        <h2 className="text-gmgn-text font-bold text-sm">Filters</h2>
        <button onClick={handleReset} className="text-gmgn-muted text-xs hover:text-gmgn-red transition-colors">
          Reset
        </button>
      </div>

      {/* ── 1-Click Fast Presets Strip ── */}
      <div className="bg-[#141824] p-2 rounded-lg border border-[#232d42] space-y-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
          Alpha Quick Filter
        </span>
        <button
          type="button"
          onClick={() => {
            soundFX.playClick(1.15);
            if (isPresetActive) {
              setFilter('mktCap', 'max', '');
              setFilter('smartWinRate', 'min', '');
              setFilter('smartWallets', 'min', '');
            } else {
              setFilter('mktCap', 'max', '500');
              setFilter('smartWinRate', 'min', '60');
              setFilter('smartWallets', 'min', '1');
            }
          }}
          className={`w-full py-1.5 px-2.5 rounded text-xs font-bold font-mono transition-all flex items-center justify-between border ${
            isPresetActive
              ? 'bg-gradient-to-r from-cyan-600/30 to-purple-600/30 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20'
              : 'bg-[#181d2a] border-[#2a344a] text-gray-300 hover:text-white hover:border-cyan-500/50'
          }`}
        >
          <span className="flex items-center gap-1.5 truncate">
            <span>🎯</span>
            <span className="truncate">&lt;$500k MC & 60%+ WR</span>
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
            isPresetActive
              ? 'bg-cyan-400 text-black'
              : 'bg-gray-800 text-gray-400'
          }`}>
            {isPresetActive ? 'ACTIVE' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Coin filters — matching GMGN trench layout */}
      <div className="space-y-0.5">
        {FIELDS.map(f => <FilterRow key={f.key} field={f} />)}
      </div>

      {/* ── Dev Safety Filter ─────────────────────────── */}
      <div className="border-t border-gmgn-border pt-3">
        <p className="text-gmgn-muted text-xs font-semibold uppercase tracking-wider mb-0.5">
          Dev Safety Filter
        </p>
        <p className="text-[11px] text-gmgn-muted mb-2 leading-tight">
          Dev net worth: SOL + token holdings combined
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-300 font-medium w-24 shrink-0">Min Net Worth</span>
            <div className="relative flex-1 min-w-0">
              <input
                type="number"
                placeholder="e.g. 500"
                value={devFilters.minDevTotalUsd}
                onChange={e => setDevFilter('minDevTotalUsd', e.target.value)}
                className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-9 text-xs text-white font-mono font-semibold placeholder:text-gray-500 placeholder:font-normal focus:outline-none focus:border-gmgn-accent"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">
                USD
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-300 font-medium w-24 shrink-0">Max Rug %</span>
            <div className="relative flex-1 min-w-0">
              <input
                type="number"
                placeholder="e.g. 20"
                value={devFilters.maxRugPercent}
                onChange={e => setDevFilter('maxRugPercent', e.target.value)}
                className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 placeholder:font-normal focus:outline-none focus:border-gmgn-accent"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Advanced On-Chain Intelligence (Solscan & ATH) ────── */}
      <div className="border-t border-gmgn-border pt-3">
        <p className="text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Solscan &amp; ATH Intelligence</span>
        </p>
        <p className="text-[11px] text-gmgn-muted mb-2 leading-tight">
          Deep wallet inflow audit &amp; ATH trajectory benchmarks
        </p>

        <div className="space-y-2">
          {/* Pre-funding toggle & SOL amount input */}
          <div className="p-2 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex flex-col pr-2">
                <span className="text-xs text-gray-200 font-medium">Require Dev Pre-Funding</span>
                <span className="text-[10px] text-gray-400">
                  Dev received ≥ {filters.minPreFundSol || '5'} SOL from external wallet
                </span>
              </div>
              <input
                type="checkbox"
                checked={!!filters.requirePreFunding}
                onChange={e => setToggleFilter('requirePreFunding', e.target.checked)}
                className="w-4 h-4 rounded accent-gmgn-accent cursor-pointer"
              />
            </label>

            {/* Configurable input for minimum pre-fund SOL amount */}
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#222736]">
              <span className="text-[11px] text-gray-300 font-mono">Min Pre-Fund</span>
              <div className="relative w-28 shrink-0">
                <input
                  type="number"
                  placeholder="5"
                  step="0.5"
                  min="0.1"
                  value={filters.minPreFundSol ?? '5'}
                  onChange={e => {
                    setToggleFilter('minPreFundSol', e.target.value);
                  }}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-9 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-cyan-400"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-cyan-400 font-mono font-bold pointer-events-none select-none">
                  SOL
                </span>
              </div>
            </div>
          </div>

          {/* Genuine website toggle */}
          <label className="flex items-center justify-between cursor-pointer p-1.5 rounded bg-[#161820] hover:bg-[#1c1f2a] border border-[#262b3a] transition-colors">
            <div className="flex flex-col pr-2">
              <span className="text-xs text-gray-200 font-medium">Require Genuine Website</span>
              <span className="text-[10px] text-gray-400">Verified live independent domain (no t.me)</span>
            </div>
            <input
              type="checkbox"
              checked={!!filters.requireGenuineWebsite}
              onChange={e => {
                setToggleFilter('requireGenuineWebsite', e.target.checked);
                if (!e.target.checked) {
                  setToggleFilter('domainTier', 'none');
                }
              }}
              className="w-4 h-4 rounded accent-gmgn-accent cursor-pointer"
            />
          </label>

          {/* Domain Tier Selection */}
          <div className="flex flex-col gap-1 p-2 rounded bg-[#161820] border border-[#262b3a]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-200 font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeWidth="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                <span>Domain Category</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold">
                {filters.domainTier === 'best' ? 'Best TLDs' : filters.domainTier === 'small' ? 'Small TLDs' : 'All TLDs'}
              </span>
            </div>
            <select
              value={filters.domainTier || 'none'}
              onChange={e => {
                const val = e.target.value;
                setToggleFilter('domainTier', val);
                setToggleFilter('requireGenuineWebsite', val !== 'none');
              }}
              className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400 cursor-pointer mt-1"
            >
              <option value="none">Any / No Domain Filter</option>
              <option value="all">Any Genuine Independent Website</option>
              <option value="best">Best Domains (.com, .in, .org, .io, .ai, .app)</option>
              <option value="small">Small Domains (.xyz, .fun, .top, .site, .online)</option>
            </select>
          </div>

          {/* Below historical ATH toggle */}
          <label className="flex items-center justify-between cursor-pointer p-1.5 rounded bg-[#161820] hover:bg-[#1c1f2a] border border-[#262b3a] transition-colors">
            <div className="flex flex-col pr-2">
              <span className="text-xs text-gray-200 font-medium">Below Historical Avg ATH</span>
              <span className="text-[10px] text-gray-400">Current MCap &lt; dev past tokens average ATH</span>
            </div>
            <input
              type="checkbox"
              checked={!!filters.requireBelowAvgAth}
              onChange={e => setToggleFilter('requireBelowAvgAth', e.target.checked)}
              className="w-4 h-4 rounded accent-gmgn-accent cursor-pointer"
            />
          </label>

          {/* Min ATH Probability slider / input */}
          <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-[#161820] border border-[#262b3a]">
            <div className="flex flex-col">
              <span className="text-xs text-gray-200 font-medium">Min ATH Probability</span>
              <span className="text-[10px] text-gray-400">Estimated chance to hit benchmark</span>
            </div>
            <div className="relative w-24 shrink-0">
              <input
                type="number"
                placeholder="e.g. 60"
                min="0"
                max="100"
                value={filters.minAthProbability ?? ''}
                onChange={e => setToggleFilter('minAthProbability', e.target.value)}
                className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 placeholder:font-normal focus:outline-none focus:border-gmgn-accent"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">
                %
              </span>
            </div>
          </div>

          {/* GMGN Most Watching / Min Watchers Filter */}
          <div className="flex items-center justify-between gap-2 p-2 rounded bg-[#19142b] border border-[#a855f7]/30">
            <div className="flex flex-col">
              <span className="text-xs text-purple-200 font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#c084fc]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Min GMGN Watchers</span>
              </span>
              <span className="text-[10px] text-purple-400/80">Require ≥ active audience count</span>
            </div>
            <div className="relative w-24 shrink-0">
              <input
                type="number"
                placeholder="e.g. 50"
                min="0"
                value={filters.minWatchers ?? ''}
                onChange={e => setToggleFilter('minWatchers', e.target.value)}
                className="w-full bg-[#120d21] border border-[#a855f7]/40 rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-purple-400/40 focus:outline-none focus:border-purple-400"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-purple-400 pointer-events-none select-none">
                👁
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── GMGN Security Matrix Filters (Exact Parity) ────── */}
      <div className="border-t border-gmgn-border pt-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>GMGN Security Matrix</span>
          </p>
          <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono border border-emerald-500/20">
            Safety Floor
          </span>
        </div>
        <p className="text-[11px] text-gmgn-muted mb-2.5 leading-tight">
          Strict holder structure, mint renouncement &amp; sniper limits
        </p>

        <div className="space-y-2">
          {/* Quick Authority & Dex Toggles */}
          <div className="grid grid-cols-1 gap-1.5 p-2 rounded bg-[#151923] border border-[#232a3d]">
            {/* Require NoMint */}
            <label className="flex items-center justify-between cursor-pointer py-0.5">
              <span className="text-xs text-gray-200 flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[9px] font-bold">✓</span>
                <span>Require NoMint (Renounced)</span>
              </span>
              <input
                type="checkbox"
                checked={!!filters.requireNoMint}
                onChange={e => setToggleFilter('requireNoMint', e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-400 cursor-pointer"
              />
            </label>

            {/* Require No Blacklist */}
            <label className="flex items-center justify-between cursor-pointer py-0.5 border-t border-[#1f2538] pt-1.5">
              <span className="text-xs text-gray-200 flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-[9px] font-bold">✓</span>
                <span>Require No Blacklist (Clean)</span>
              </span>
              <input
                type="checkbox"
                checked={!!filters.requireNoBlacklist}
                onChange={e => setToggleFilter('requireNoBlacklist', e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-400 cursor-pointer"
              />
            </label>

            {/* Require Dex Paid Only */}
            <label className="flex items-center justify-between cursor-pointer py-0.5 border-t border-[#1f2538] pt-1.5">
              <span className="text-xs text-gray-200 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L9.5 8.5 2 9.5 7.5 15 5.5 22 12 18.5 18.5 22 16.5 15 22 9.5 14.5 8.5 12 2z"/>
                </svg>
                <span>Dex Paid Only (Paid Orders)</span>
              </span>
              <input
                type="checkbox"
                checked={!!filters.requireDexPaid}
                onChange={e => setToggleFilter('requireDexPaid', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-400 cursor-pointer"
              />
            </label>
          </div>

          {/* Row 1 Metrics: Top 10 & DEV Max */}
          <div className="grid grid-cols-2 gap-2">
            {/* Top 10 Max % */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1">
                <span>Top 10 Max</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 30"
                  min="0"
                  max="100"
                  value={filters.maxTop10Percent ?? ''}
                  onChange={e => setToggleFilter('maxTop10Percent', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
              </div>
            </div>

            {/* DEV Hold Max % */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1">
                <span className="text-emerald-400">👨‍🍳</span>
                <span>DEV Max</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 5"
                  min="0"
                  max="100"
                  value={filters.maxDevHoldPercent ?? ''}
                  onChange={e => setToggleFilter('maxDevHoldPercent', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
              </div>
            </div>
          </div>

          {/* Row 2 Metrics: Min Holders & Max Snipers */}
          <div className="grid grid-cols-2 gap-2">
            {/* Min Holders */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1">
                <svg className="w-3 h-3 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <span>Min Holders</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 100"
                  min="1"
                  value={filters.minHolders ?? ''}
                  onChange={e => setToggleFilter('minHolders', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Max Snipers % */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1">
                <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2v20M2 12h20" />
                </svg>
                <span>Snipers Max</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 5"
                  min="0"
                  max="100"
                  value={filters.maxSnipersPercent ?? ''}
                  onChange={e => setToggleFilter('maxSnipersPercent', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
              </div>
            </div>
          </div>

          {/* Row 3 Metrics: Insiders Max & Phishing Max */}
          <div className="grid grid-cols-2 gap-2">
            {/* Max Insiders % */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate">
                Insiders Max
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 10"
                  min="0"
                  max="100"
                  value={filters.maxInsidersPercent ?? ''}
                  onChange={e => setToggleFilter('maxInsidersPercent', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-rose-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
              </div>
            </div>

            {/* Max Phishing % */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate">
                Phishing Max
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 5"
                  min="0"
                  max="100"
                  value={filters.maxPhishingPercent ?? ''}
                  onChange={e => setToggleFilter('maxPhishingPercent', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-rose-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
              </div>
            </div>
          </div>

          {/* Row 4 Metrics: Bundler Max & Min Burnt */}
          <div className="grid grid-cols-2 gap-2">
            {/* Max Bundler % */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate">
                Bundler Max
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 5"
                  min="0"
                  max="100"
                  value={filters.maxBundlerPercent ?? ''}
                  onChange={e => setToggleFilter('maxBundlerPercent', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
              </div>
            </div>

            {/* Min Burnt % */}
            <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
              <span className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1">
                <span>🔥</span>
                <span>Burnt Min</span>
              </span>
              <div className="relative">
                <input
                  type="number"
                  placeholder="e.g. 100"
                  min="0"
                  max="100"
                  value={filters.minBurntPercent ?? ''}
                  onChange={e => setToggleFilter('minBurntPercent', e.target.value)}
                  className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Smart Money & Alpha Wallets Filter ─────────────────── */}
      <div className="border-t border-gmgn-border pt-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <span>🧠</span>
            <span>Smart Money Intelligence</span>
          </p>
          <button
            type="button"
            onClick={() => {
              const nextState = !filters.smartMoneyEarlyOnly;
              setToggleFilter('smartMoneyEarlyOnly', nextState);
              if (nextState) {
                setFilter('mktCap', 'max', '500');
                setToggleFilter('minSmartMoneyCount', '1');
                setToggleFilter('minSmartWinRate', '60');
              }
            }}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
              filters.smartMoneyEarlyOnly
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-[#181a22] text-gray-400 border-[#2d3240] hover:text-emerald-300'
            }`}
          >
            {filters.smartMoneyEarlyOnly ? '✓ <$500k & 60%+ WR ON' : '🎯 1-Click Early Preset'}
          </button>
        </div>
        <p className="text-[11px] text-gmgn-muted mb-2 leading-tight">
          Early entry (&lt;$500k MCap) &amp; 60%+ win rate smart wallets
        </p>

        <div className="grid grid-cols-2 gap-2">
          {/* Min Smart Money Count */}
          <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
            <span className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1">
              <span>🧠</span>
              <span>Min Smart</span>
            </span>
            <div className="relative">
              <input
                type="number"
                placeholder="e.g. 1"
                min="0"
                value={filters.minSmartMoneyCount ?? ''}
                onChange={e => setToggleFilter('minSmartMoneyCount', e.target.value)}
                className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">wallets</span>
            </div>
          </div>

          {/* Min Win Rate % */}
          <div className="p-1.5 rounded bg-[#161820] border border-[#262b3a] flex flex-col gap-1">
            <span className="text-[11px] text-gray-300 font-medium truncate flex items-center gap-1">
              <span>🎯</span>
              <span>Min Win Rate</span>
            </span>
            <div className="relative">
              <input
                type="number"
                placeholder="e.g. 60"
                min="0"
                max="100"
                value={filters.minSmartWinRate ?? ''}
                onChange={e => setToggleFilter('minSmartWinRate', e.target.value)}
                className="w-full bg-[#181a22] border border-[#2d3240] rounded px-2 py-1 pr-6 text-xs text-white font-mono font-semibold placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none select-none">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div className="border-t border-gmgn-border pt-3">
          <p className="text-gmgn-muted text-xs font-semibold uppercase tracking-wider mb-2">Saved Presets</p>
          <div className="flex flex-col gap-1">
            {presets.map(p => (
              <button
                key={p.id}
                onClick={() => setAllFilters(p.filters, p.dev_filters)}
                className="text-left text-xs text-gmgn-text hover:text-gmgn-accent px-2 py-1 rounded hover:bg-gmgn-border transition-colors truncate"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button onClick={onApply} className="gmgn-btn-primary flex-1 text-xs py-2">Apply</button>
        <button onClick={onSave}  className="gmgn-btn-secondary flex-1 text-xs py-2">Save Preset</button>
      </div>
    </div>
  );
}
