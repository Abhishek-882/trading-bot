import axios from 'axios';
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

export const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

export const JITO_BLOCK_ENGINES = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
];

export class TradeExecutionService {
  constructor() {
    this.tipFloorCache = null;
    this.tipFloorCacheTime = 0;
    this.tipCacheTtlMs = 10000; // 10 seconds
  }

  /**
   * Fetches real-time Jito tip floor from official endpoint with caching
   */
  async getTipFloor() {
    const now = Date.now();
    if (this.tipFloorCache && (now - this.tipFloorCacheTime < this.tipCacheTtlMs)) {
      return this.tipFloorCache;
    }

    try {
      const res = await axios.get('https://bundles.jito.wtf/api/v1/bundles/tip_floor', { timeout: 3000 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        this.tipFloorCache = res.data[0];
        this.tipFloorCacheTime = now;
        return this.tipFloorCache;
      }
    } catch (err) {
      console.warn('[Trade Execution] Tip floor fetch warning:', err.message);
    }

    return this.tipFloorCache || {
      landed_tips_50th_percentile: 0.000005,
      landed_tips_95th_percentile: 0.00005,
      landed_tips_99th_percentile: 0.0001,
    };
  }

  /**
   * Computes dynamic Jito tip sized to network congestion & trade size
   */
  async calculateDynamicTip(tradeSizeSol = 0.1) {
    const floor = await this.getTipFloor();
    const p95 = floor.landed_tips_95th_percentile || 0.00005;
    const p99 = floor.landed_tips_99th_percentile || 0.0001;

    // Minimum floor 0.00002 SOL; max cap is 5% of trade size or 0.01 SOL
    const maxTip = Math.min(0.01, tradeSizeSol * 0.05);
    const recommended = Math.max(0.00002, Math.min(maxTip, p99 * 1.15));

    return {
      tipSol: recommended,
      tipLamports: Math.floor(recommended * LAMPORTS_PER_SOL),
      p95,
      p99,
    };
  }

  /**
   * Returns a random official Jito tip recipient account
   */
  getRandomTipAccount() {
    const idx = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
    return new PublicKey(JITO_TIP_ACCOUNTS[idx]);
  }

  /**
   * Executes a signed versioned transaction either through Jito bundle or standard RPC
   */
  async execute({ connection, tx, keypair, tradeSizeSol = 0.1, useJito = true }) {
    const t0 = Date.now();

    if (useJito) {
      try {
        const { tipSol, tipLamports } = await this.calculateDynamicTip(tradeSizeSol);
        const tipAccount = this.getRandomTipAccount();

        // Build Jito tip transaction
        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        const tipInstruction = SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: tipAccount,
          lamports: tipLamports,
        });

        const tipMsg = new TransactionMessage({
          payerKey: keypair.publicKey,
          recentBlockhash: latestBlockhash.blockhash,
          instructions: [tipInstruction],
        }).compileToV0Message();

        const tipTx = new VersionedTransaction(tipMsg);
        tipTx.sign([keypair]);

        // Bundle contains user swap tx followed by Jito tip tx
        const bundleTxs = [
          Buffer.from(tx.serialize()).toString('base64'),
          Buffer.from(tipTx.serialize()).toString('base64'),
        ];

        // Submit to Jito Block Engine
        const engineUrl = JITO_BLOCK_ENGINES[Math.floor(Math.random() * JITO_BLOCK_ENGINES.length)];
        const res = await axios.post(
          engineUrl,
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'sendBundle',
            params: [bundleTxs],
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000,
          }
        );

        const bundleId = res.data?.result;
        if (bundleId) {
          const elapsed = Date.now() - t0;
          console.log(`[Trade Execution] ⚡ Jito bundle submitted in ${elapsed}ms (Bundle ID: ${bundleId.slice(0, 12)}..., tip: ${tipSol.toFixed(6)} SOL)`);

          // Confirm main transaction signature
          const rawSig = tx.signatures[0];
          const bs58 = (await import('bs58')).default;
          const sig = bs58.encode(rawSig);

          // Background confirmation check
          connection.confirmTransaction(
            { signature: sig, blockhash: latestBlockhash.blockhash, lastValidBlockHeight: latestBlockhash.lastValidBlockHeight },
            'confirmed'
          ).catch(() => {});

          return {
            success: true,
            method: 'jito_bundle',
            txSignature: sig,
            bundleId,
            tipSol,
            latencyMs: elapsed,
          };
        }
      } catch (jitoErr) {
        console.warn(`[Trade Execution] Jito bundle failed (${jitoErr.message}), immediately falling back to standard RPC in 0ms...`);
      }
    }

    // ── Resilient Fallback: Standard RPC ──────────────────────────────
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    const elapsed = Date.now() - t0;
    console.log(`[Trade Execution] Standard RPC landed in ${elapsed}ms (tx: ${sig.slice(0, 12)}...)`);

    connection.confirmTransaction(sig, 'confirmed').catch(() => {});

    return {
      success: true,
      method: 'standard_rpc',
      txSignature: sig,
      latencyMs: elapsed,
    };
  }
}

export const tradeExecutionService = new TradeExecutionService();
