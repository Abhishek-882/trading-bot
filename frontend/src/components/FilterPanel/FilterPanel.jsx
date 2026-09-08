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

export function FilterPanel({ onApply, onSave, onReset }) {
  const filters    = useBotStore(s => s.filters);
  const devFilters = useBotStore(s => s.devFilters);
  const setDevFilter = useBotStore(s => s.setDevFilter);
  const resetFilters = useBotStore(s => s.resetFilters);
  const presets    = useBotStore(s => s.presets);
  const setAllFilters = useBotStore(s => s.setAllFilters);

  const handleReset = () => { resetFilters(); onReset?.(); };

  return (
    <div className="gmgn-card flex flex-col gap-3 w-80 sm:w-[325px] shrink-0 border border-gmgn-border">
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
