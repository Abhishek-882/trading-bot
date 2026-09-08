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
    <div className="flex items-center gap-2 py-2 border-b border-gmgn-border last:border-0">
      {/* Label */}
      <span className="text-gmgn-muted text-sm w-28 shrink-0">{field.label}</span>

      {/* Min input */}
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          placeholder="Min"
          value={val.min}
          onChange={e => setFilter(field.key, 'min', e.target.value)}
          className="gmgn-input text-center"
        />
        {field.unitMin && (
          <span className="text-gmgn-muted text-xs w-7 shrink-0">{field.unitMin}</span>
        )}
      </div>

      {/* Max input */}
      <div className="flex items-center gap-1 flex-1">
        <input
          type="number"
          placeholder="Max"
          value={val.max}
          onChange={e => setFilter(field.key, 'max', e.target.value)}
          className="gmgn-input text-center"
        />
        {field.unitMax && (
          <span className="text-gmgn-muted text-xs w-7 shrink-0">{field.unitMax}</span>
        )}
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
    <div className="gmgn-card flex flex-col gap-3 w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-gmgn-text font-semibold text-sm">Filters</h2>
        <button onClick={handleReset} className="text-gmgn-muted text-xs hover:text-gmgn-red transition-colors">
          Reset
        </button>
      </div>

      {/* Coin filters — exact match to screenshot */}
      <div>
        {FIELDS.map(f => <FilterRow key={f.key} field={f} />)}
      </div>

      {/* ── Dev Safety Filter ─────────────────────────── */}
      <div className="border-t border-gmgn-border pt-3">
        <p className="text-gmgn-muted text-xs font-semibold uppercase tracking-wider mb-2">
          Dev Safety Filter
        </p>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-gmgn-muted text-sm w-28 shrink-0">Min Dev SOL</span>
          <div className="flex items-center gap-1 flex-1">
            <input
              type="number"
              placeholder="e.g. 0.5"
              value={devFilters.minDevBalanceSol}
              onChange={e => setDevFilter('minDevBalanceSol', e.target.value)}
              className="gmgn-input text-center"
            />
            <span className="text-gmgn-muted text-xs w-7">SOL</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gmgn-muted text-sm w-28 shrink-0">Max Rug %</span>
          <div className="flex items-center gap-1 flex-1">
            <input
              type="number"
              placeholder="e.g. 20"
              value={devFilters.maxRugPercent}
              onChange={e => setDevFilter('maxRugPercent', e.target.value)}
              className="gmgn-input text-center"
            />
            <span className="text-gmgn-muted text-xs w-7">%</span>
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
                className="text-left text-sm text-gmgn-text hover:text-gmgn-accent px-2 py-1 rounded hover:bg-gmgn-border transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button onClick={onApply} className="gmgn-btn-primary flex-1">Apply</button>
        <button onClick={onSave}  className="gmgn-btn-secondary flex-1">Save Preset</button>
      </div>
    </div>
  );
}
