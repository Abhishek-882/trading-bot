import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { useState, useEffect, useCallback } from 'react';

export function useWallet() {
  const { publicKey, connected, wallet, disconnect, sendTransaction } = useSolanaWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const address = publicKey ? publicKey.toBase58() : null;

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !connection) {
      setBalance(0);
      return;
    }
    try {
      setLoading(true);
      const lamports = await connection.getBalance(publicKey, 'confirmed');
      setBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('[WALLET] Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    fetchBalance();
    const id = setInterval(fetchBalance, 15000);
    return () => clearInterval(id);
  }, [fetchBalance]);

  const shortAddress = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '';

  return {
    publicKey,
    address,
    shortAddress,
    connected,
    wallet,
    balance,
    loading,
    disconnect,
    sendTransaction,
    refreshBalance: fetchBalance,
  };
}
