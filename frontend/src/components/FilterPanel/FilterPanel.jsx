import { useBotStore } from '../../stores/botStore';

// Filter field definitions matching the screenshot exactly
const FIELDS = [
  { key: 'bCurve',      label: 'B. Curve',      unitMin: '%',   unitMax: '%'   },
  { key: 'age',         label: 'Age',            unitMin: 'min', unitMax: 'min' },
  { key: 'liquidity',   label: 'Liquidity',      unitMin: 'K',   unitMax: 'K'   },
  { key: 'mktCap',      label: 'MKT Cap',        unitMin: 'K',   unitMax: 'K'   },
  { key: 'volume',      label: 'Volume',         unitMin: 'K',   unitMax: 'K'   },
  { key: 'netBuy',      label: 'Net Buy',        unitMin: 'K',   unitMax: 'K'   },
  { key: 'txs',         label: 'TXs',            unitMin: '',    unitMax: ''    },
  { key: 'buys',        label: 'Buys',           unitMin: '',    unitMax: ''    },
  { key: 'sells',       label: 'Sells',          unitMin: '',    unitMax: ''    },
  { key: 'totalFees',   label: 'Total Fees',     unitMin: 'SOL', unitMax: 'SOL' },
  { key: 'pumpLiveAge', label: 'Pump Live Age',  unitMin: 'min', unitMax: 'min' },
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
  const setDevFilter = useBotStore(s => s.setDevFilter);
  const setToggleFilter = useBotStore(s => s.setToggleFilter);
  const resetFilters = useBotStore(s => s.resetFilters);

  const presets    = useBotStore(s => s.presets);
  const setAllFilters = useBotStore(s => s.setAllFilters);

  const handleReset = () => { resetFilters(); onReset?.(); };

  return (
    <div className={`gmgn-card flex flex-col gap-3 ${isMobileDrawer ? 'w-full shadow-none border-0 p-1 bg-transparent' : 'w-80 sm:w-[325px] shrink-0 border border-gmgn-border'}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-gmgn-border">
        <h2 className="text-gmgn-text font-bold text-sm">Filters</h2>
        <button onClick={handleReset} className="text-gmgn-muted text-xs hover:text-gmgn-red transition-colors">
          Reset
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
