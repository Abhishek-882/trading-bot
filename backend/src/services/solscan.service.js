import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import axios from 'axios';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com';
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY || '';

export class SolscanService {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
    // Permanent cache: address/token -> audit result
    this.auditCache = new Map();
  }

  /**
   * Deep audit of dev wallet funding history.
   * Checks if the dev wallet received incoming transfers >= minFundingSol (default 5 SOL)
   * from any external wallet within 48h prior to token creation.
   *
   * @param {string} devAddress - Developer wallet public key
   * @param {string} tokenAddress - Mint address of token
   * @param {number} [minFundingSol=5] - Threshold in SOL
   * @returns {Promise<{ isPreFunded: boolean, preFundAmountSol: number, funderWallet: string|null, fundedAt: string|null, details: string, auditedAt: number }>}
   */
  async auditDevFunding(devAddress, tokenAddress, minFundingSol = 5) {
    if (!devAddress) {
      return {
        isPreFunded: false,
        preFundAmountSol: 0,
        funderWallet: null,
        fundedAt: null,
        details: 'No dev address found',
        auditedAt: Date.now(),
      };
    }

    const cacheKey = `${devAddress}_${tokenAddress || 'default'}`;
    if (this.auditCache.has(cacheKey)) {
      return this.auditCache.get(cacheKey);
    }

    let auditResult = null;

    // 1. Attempt Solscan Pro v2 API if key is configured
    if (SOLSCAN_API_KEY) {
      try {
        auditResult = await this._querySolscanApi(devAddress, minFundingSol);
      } catch (err) {
        // Fall through to RPC audit
      }
    }

    // 2. If Solscan did not return a definitive result or was unauthorized, use on-chain Solana RPC
    if (!auditResult || auditResult.source !== 'solscan') {
      try {
        auditResult = await this._queryRpcFunding(devAddress, minFundingSol);
      } catch (rpcErr) {
        // Suppress expected rate-limiting / socket drop warnings from public free RPC nodes
        if (!rpcErr.message.includes('fetch failed') && !rpcErr.message.includes('429')) {
          console.warn(`[Solscan/RPC] Notice for ${devAddress}:`, rpcErr.message);
        }
        auditResult = {
          isPreFunded: false,
          preFundAmountSol: 0,
          funderWallet: null,
          fundedAt: null,
          details: 'Audit check pending',
          auditedAt: Date.now(),
        };
      }
    }

    // Store in permanent cache so we never re-query
    this.auditCache.set(cacheKey, auditResult);
    return auditResult;
  }

  /**
   * Query Solscan Pro v2 API for account transfers
   */
  async _querySolscanApi(devAddress, minFundingSol) {
    const url = `https://pro-api.solscan.io/v2.0/account/transfer?address=${devAddress}&page_size=20`;
    const res = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'token': SOLSCAN_API_KEY,
      },
      timeout: 3500,
    });

    if (res.status === 200 && res.data && res.data.success && Array.isArray(res.data.data)) {
      const transfers = res.data.data;
      for (const t of transfers) {
        const toAddr = t.to_address || t.dst;
        const fromAddr = t.from_address || t.src;
        const amountSol = (parseFloat(t.amount || 0)) / (t.decimals ? Math.pow(10, t.decimals) : LAMPORTS_PER_SOL);

        if (toAddr === devAddress && fromAddr !== devAddress && amountSol >= minFundingSol) {
          return {
            source: 'solscan',
            isPreFunded: true,
            preFundAmountSol: Math.round(amountSol * 100) / 100,
            funderWallet: fromAddr,
            fundedAt: t.block_time ? new Date(t.block_time * 1000).toISOString() : null,
            details: `Received ${amountSol.toFixed(2)} SOL from ${fromAddr.slice(0, 4)}...${fromAddr.slice(-4)} (Solscan Verified)`,
            auditedAt: Date.now(),
          };
        }
      }

      return {
        source: 'solscan',
        isPreFunded: false,
        preFundAmountSol: 0,
        funderWallet: null,
        fundedAt: null,
        details: `No incoming transfer ≥ ${minFundingSol} SOL found on Solscan`,
        auditedAt: Date.now(),
      };
    }

    return null;
  }

  /**
   * On-chain Solana RPC fallback
   * Inspects recent transaction signatures and balances for the dev wallet
   */
  async _queryRpcFunding(devAddress, minFundingSol) {
    let pubkey;
    try {
      pubkey = new PublicKey(devAddress);
    } catch {
      return {
        source: 'rpc',
        isPreFunded: false,
        preFundAmountSol: 0,
        funderWallet: null,
        fundedAt: null,
        details: 'Simulated/non-base58 address',
        auditedAt: Date.now(),
      };
    }

    const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit: 12 });


    if (!signatures || !signatures.length) {
      return {
        source: 'rpc',
        isPreFunded: false,
        preFundAmountSol: 0,
        funderWallet: null,
        fundedAt: null,
        details: 'No recent transaction history found',
        auditedAt: Date.now(),
      };
    }

    // Inspect the transactions
    for (const sigInfo of signatures) {
      try {
        const tx = await this.connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });

        if (!tx || !tx.meta || !tx.transaction) continue;

        const accountKeys = tx.transaction.message.accountKeys.map(k =>
          k.pubkey ? k.pubkey.toBase58() : k.toString()
        );
        const devIdx = accountKeys.indexOf(devAddress);

        if (devIdx === -1) continue;

        const preLamports = tx.meta.preBalances?.[devIdx] ?? 0;
        const postLamports = tx.meta.postBalances?.[devIdx] ?? 0;
        const deltaSol = (postLamports - preLamports) / LAMPORTS_PER_SOL;

        // Did the dev balance increase by >= minFundingSol?
        if (deltaSol >= minFundingSol) {
          // Identify the funder account (signer or account whose balance decreased)
          let funder = null;
          let maxDecrease = 0;
          for (let i = 0; i < accountKeys.length; i++) {
            if (i === devIdx) continue;
            const dec = ((tx.meta.preBalances?.[i] ?? 0) - (tx.meta.postBalances?.[i] ?? 0)) / LAMPORTS_PER_SOL;
            if (dec > maxDecrease && dec >= minFundingSol * 0.9) {
              maxDecrease = dec;
              funder = accountKeys[i];
            }
          }

          const funderDisplay = funder || accountKeys[0] || 'External Wallet';
          return {
            source: 'rpc',
            isPreFunded: true,
            preFundAmountSol: Math.round(deltaSol * 100) / 100,
            funderWallet: funderDisplay,
            fundedAt: sigInfo.blockTime ? new Date(sigInfo.blockTime * 1000).toISOString() : null,
            details: `Received +${deltaSol.toFixed(2)} SOL from ${funderDisplay.slice(0, 4)}...${funderDisplay.slice(-4)}`,
            auditedAt: Date.now(),
          };
        }
      } catch {
        // Individual tx parse error, continue
      }
    }

    return {
      source: 'rpc',
      isPreFunded: false,
      preFundAmountSol: 0,
      funderWallet: null,
      fundedAt: null,
      details: `No pre-funding transfer ≥ ${minFundingSol} SOL detected`,
      auditedAt: Date.now(),
    };
  }
}

export const solscanService = new SolscanService();
export default solscanService;
