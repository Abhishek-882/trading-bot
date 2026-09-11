import './polyfills.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { clusterApiUrl } from '@solana/web3.js';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import '@solana/wallet-adapter-react-ui/styles.css';

const endpoint = clusterApiUrl('mainnet-beta');
const wallets  = [new PhantomWalletAdapter()];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <App />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
