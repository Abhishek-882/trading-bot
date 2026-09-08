import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBotStore } from '../stores/botStore';
import { connectWS, disconnectWS, wsSend, api } from '../api/client';

/**
 * useBot — wires up WebSocket, auto-syncs wallet identity,
 * and exposes bot control actions.
 */
export function useBot() {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  const setRankedCoins    = useBotStore(s => s.setRankedCoins);
  const addNotification   = useBotStore(s => s.addNotification);
  const setTrades         = useBotStore(s => s.setTrades);
  const setSessionBalance = useBotStore(s => s.setSessionBalance);
  const setSessionPubkey  = useBotStore(s => s.setSessionPubkey);
  const sessionPubkey     = useBotStore(s => s.sessionPubkey);
  const botConfig         = useBotStore(s => s.botConfig);
  const filters           = useBotStore(s => s.filters);
  const devFilters        = useBotStore(s => s.devFilters);

  const onMessage = useRef(null);

  // ── WebSocket ───────────────────────────────────────────────────
  useEffect(() => {
    onMessage.current = (msg) => {
      if (msg.type === 'ranked_coins') {
        setRankedCoins(msg.data || []);
      }
      if (msg.type === 'auto_buy' && msg.wallet === walletAddress) {
        addNotification({
          type: 'success',
          text: `🤖 Auto-bought ${msg.coin}`,
          tx:   msg.txSignature,
        });
      }
    };

    connectWS(onMessage.current);

    // Identify this wallet to backend
    if (walletAddress) {
      wsSend({ type: 'identify', wallet: walletAddress });
    }

    return () => disconnectWS(onMessage.current);
  }, [walletAddress]);

  // ── Push filter changes to backend via WS ───────────────────────
  useEffect(() => {
    wsSend({ type: 'set_filters', filters, devFilters });
  }, [filters, devFilters]);

  // ── Refresh session balance ─────────────────────────────────────
  useEffect(() => {
    if (!walletAddress || !sessionPubkey) return;
    const refresh = async () => {
      try {
        const { balanceSol } = await api.getSessionBalance(walletAddress);
        setSessionBalance(balanceSol);
      } catch { /* ignore */ }
    };
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [walletAddress, sessionPubkey]);

  // ── Load trades when wallet connects ───────────────────────────
  useEffect(() => {
    if (!walletAddress) return;
    api.getTrades(walletAddress).then(setTrades).catch(() => {});
  }, [walletAddress]);

  // ── Actions ─────────────────────────────────────────────────────

  async function activateBot() {
    if (!walletAddress) throw new Error('Connect wallet first');
    const { sessionPubkey: pk } = await api.createSession({
      userWallet: walletAddress,
      botConfig,
    });
    setSessionPubkey(pk);
    addNotification({ type: 'info', text: `Session wallet created: ${pk.slice(0,8)}...` });
    return pk;
  }

  async function deactivateBot() {
    if (!walletAddress) return;
    await api.deactivateSession(walletAddress);
    setSessionPubkey(null);
    setSessionBalance(0);
    addNotification({ type: 'warning', text: 'Bot deactivated' });
  }

  async function withdrawFunds() {
    if (!walletAddress) return;
    const result = await api.withdrawSession(walletAddress);
    setSessionBalance(0);
    setSessionPubkey(null);
    addNotification({ type: 'success', text: `Withdrew ${result.amountSol.toFixed(4)} SOL back to your wallet` });
    return result;
  }

  async function saveBotConfig(config) {
    if (!walletAddress) return;
    await api.updateBotConfig({ userWallet: walletAddress, botConfig: config });
  }

  return { activateBot, deactivateBot, withdrawFunds, saveBotConfig, walletAddress };
}
