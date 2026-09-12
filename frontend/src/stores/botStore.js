import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_FILTERS = {
  bCurve:      { min: '', max: '' },
  age:         { min: '', max: '' },
  liquidity:   { min: '', max: '' },
  mktCap:      { min: '', max: '' },
  volume:      { min: '', max: '' },
  netBuy:      { min: '', max: '' },
  txs:         { min: '', max: '' },
  buys:        { min: '', max: '' },
  sells:       { min: '', max: '' },
  totalFees:   { min: '', max: '' },
  pumpLiveAge: { min: '', max: '' },
  requirePreFunding:      false, // Dev must have received >= minPreFundSol before creation
  minPreFundSol:          '5',   // Min SOL received from external wallet (customizable)
  requireGenuineWebsite:  false, // Token must have verified independent domain
  requireBelowAvgAth:     false, // Current mktCap must be below historical avg ATH
  minAthProbability:      '',    // Minimum ATH reach probability % (e.g. 60)
  minWatchers:            '',    // GMGN Watcher count threshold (e.g. 50, 100)
};

const DEFAULT_DEV_FILTERS = {
  minDevTotalUsd: '',   // Minimum dev total portfolio value (SOL + all tokens) in USD
  maxRugPercent:  '',
};


const DEFAULT_BOT_CONFIG = {
  autoBuy:       false,
  buyAmountSol:  0.1,
  maxPositions:  5,
  slippageBps:   500,
  stopLossPct:   -50,
  tpLevels: [
    { triggerPct: 100, closePct: 50  },
    { triggerPct: 200, closePct: 30  },
    { triggerPct: 500, closePct: 20  },
  ],
};

export const useBotStore = create(
  persist(
    (set, get) => ({
      // ── Coins ─────────────────────────────────────────────────────
      rankedCoins:   [],
      lastUpdated:   null,
      setRankedCoins: (coins) => set({ rankedCoins: coins, lastUpdated: Date.now() }),

      // ── Filters ───────────────────────────────────────────────────
      filters:    DEFAULT_FILTERS,
      devFilters: DEFAULT_DEV_FILTERS,
      setFilter:     (field, bound, value) => set(s => ({
        filters: { ...s.filters, [field]: { ...s.filters[field], [bound]: value } }
      })),
      setDevFilter:  (field, value) => set(s => ({
        devFilters: { ...s.devFilters, [field]: value }
      })),
      setToggleFilter: (field, value) => set(s => ({
        filters: { ...s.filters, [field]: value }
      })),
      resetFilters:  () => set({ filters: DEFAULT_FILTERS, devFilters: DEFAULT_DEV_FILTERS }),
      setAllFilters: (filters, devFilters) => set({ filters, devFilters }),

      // Saved presets
      presets: [],
      setPresets: (presets) => set({ presets }),

      // Active tab
      activeTab: 'suggestions', // 'suggestions' | 'trades' | 'bot'
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Ranking sort mode: 'default' | 'watchers' | 'net_worth' | 'volume'
      rankingSort: 'default',
      setRankingSort: (sort) => set({ rankingSort: sort }),

      // Mobile drawer state
      isMobileFilterOpen: false,
      setIsMobileFilterOpen: (isOpen) => set({ isMobileFilterOpen: isOpen }),
      toggleMobileFilter: () => set(s => ({ isMobileFilterOpen: !s.isMobileFilterOpen })),

      // ── Wallet ────────────────────────────────────────────────────
      connectedWallet: null,
      setConnectedWallet: (wallet) => set({ connectedWallet: wallet }),

      // ── Session Wallet ────────────────────────────────────────────
      sessionPubkey:    null,
      sessionBalanceSol: 0,
      setSessionPubkey:   (pk)  => set({ sessionPubkey: pk }),
      setSessionBalance:  (bal) => set({ sessionBalanceSol: bal }),

      // ── Bot Config ────────────────────────────────────────────────
      botConfig: DEFAULT_BOT_CONFIG,
      setBotConfig: (config) => set({ botConfig: config }),
      updateBotConfig: (patch) => set(s => ({ botConfig: { ...s.botConfig, ...patch } })),
      updateTP: (idx, patch) => set(s => {
        const tpLevels = [...s.botConfig.tpLevels];
        tpLevels[idx] = { ...tpLevels[idx], ...patch };
        return { botConfig: { ...s.botConfig, tpLevels } };
      }),

      // ── Trade History ─────────────────────────────────────────────
      trades: [],
      setTrades: (trades) => set({ trades }),

      // ── Live Notifications ────────────────────────────────────────
      notifications: [],
      addNotification: (notif) => set(s => ({
        notifications: [{ ...notif, id: Date.now() }, ...s.notifications].slice(0, 20),
      })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'gmgn-bot-store',
      partialize: (s) => ({
        filters:    s.filters,
        devFilters: s.devFilters,
        botConfig:  s.botConfig,
        sessionPubkey: s.sessionPubkey,
      }),
    }
  )
);
