import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { useBotStore } from '../../stores/botStore';

export function WalletConnector() {
  const { setVisible }    = useWalletModal();
  const { publicKey, disconnect, connected, wallet } = useWallet();
  const { connection }    = useConnection();
  const setConnected      = useBotStore(s => s.setConnectedWallet);
  const sessionPubkey     = useBotStore(s => s.sessionPubkey);
  const sessionBalance    = useBotStore(s => s.sessionBalanceSol);
  const [solBal, setSolBal] = useState(0);

  const address = publicKey?.toBase58();
  const short   = address ? `${address.slice(0,4)}...${address.slice(-4)}` : null;

  // Sync wallet address to store
  useEffect(() => {
    setConnected(address || null);
  }, [address]);

  // Fetch main wallet SOL balance
  useEffect(() => {
    if (!publicKey) return;
    connection.getBalance(publicKey).then(b => setSolBal(b / LAMPORTS_PER_SOL)).catch(() => {});
    const id = setInterval(() => {
      connection.getBalance(publicKey).then(b => setSolBal(b / LAMPORTS_PER_SOL)).catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, [publicKey, connection]);

  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="gmgn-btn-primary flex items-center gap-2"
      >
        <span>🔗</span> Connect Wallet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Session wallet indicator */}
      {sessionPubkey && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gmgn-accent bg-opacity-10 border border-gmgn-accent border-opacity-30">
          <span className="live-dot w-2 h-2 rounded-full bg-gmgn-accent shrink-0" />
          <span className="text-gmgn-accent text-xs font-medium">
            Bot Active · {sessionBalance.toFixed(3)} SOL
          </span>
        </div>
      )}

      {/* Main wallet */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gmgn-surface border border-gmgn-border">
        {/* Wallet icon */}
        <img
          src={wallet?.adapter?.icon || ''}
          alt=""
          className="w-4 h-4 rounded"
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div className="flex flex-col leading-tight">
          <span className="text-gmgn-text text-xs font-medium">{short}</span>
          <span className="text-gmgn-muted text-xs">{solBal.toFixed(3)} SOL</span>
        </div>
        <button
          onClick={disconnect}
          title="Disconnect"
          className="text-gmgn-muted hover:text-gmgn-red text-xs ml-1 transition-colors"
        >✕</button>
      </div>
    </div>
  );
}
