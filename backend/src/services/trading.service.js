import axios from 'axios';
import { Connection, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { recordTrade, hasBought, updateTradeTP } from '../db/database.js';
import { SessionWalletService } from './sessionWallet.service.js';

const JUPITER_API = process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';
const RPC_URL     = process.env.SOLANA_RPC_URL   || 'https://api.mainnet-beta.solana.com';
const SOL_MINT    = 'So11111111111111111111111111111111111111112';

export class TradingService {
  constructor() {
    this.connection     = new Connection(RPC_URL, 'confirmed');
    this.sessionService = new SessionWalletService();
  }

  /**
   * AUTO-BUY: fully autonomous swap using the session keypair.
   * No wallet popup — the session keypair signs everything.
   *
   * @param {object} p
   * @param {string} p.userWallet     - User's main Phantom wallet (for dedup & DB)
   * @param {string} p.tokenAddress   - Token mint to buy
   * @param {string} p.coinName
   * @param {string} p.coinSymbol
   * @param {number} p.amountSol      - SOL to spend from session wallet
   * @param {number} p.slippageBps    - Slippage (default 500 = 5%)
   */
  async autoBuy({ userWallet, tokenAddress, coinName, coinSymbol, amountSol, slippageBps = 500 }) {
    // ── 1. Duplicate guard ─────────────────────────────────────────
    if (await hasBought(tokenAddress, userWallet)) {
      throw new Error(`SKIP: already bought ${coinSymbol} for ${userWallet.slice(0,8)}`);
    }

    // ── 2. Get session keypair ─────────────────────────────────────
    const keypair      = await this.sessionService.getKeypair(userWallet);
    const sessionPubkey= keypair.publicKey.toBase58();

    // ── 3. Check session balance ───────────────────────────────────
    const balLamports  = await this.connection.getBalance(keypair.publicKey);
    const balSol       = balLamports / LAMPORTS_PER_SOL;
    if (balSol < amountSol + 0.005) {
      throw new Error(`Insufficient session balance: ${balSol.toFixed(4)} SOL (need ${amountSol + 0.005})`);
    }

    // ── 4. Jupiter quote ───────────────────────────────────────────
    const quoteRes = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint:   SOL_MINT,
        outputMint:  tokenAddress,
        amount:      Math.floor(amountSol * LAMPORTS_PER_SOL),
        slippageBps,
        onlyDirectRoutes: false,
      },
    });
    const quote = quoteRes.data;
    if (!quote?.outAmount) throw new Error('Jupiter: no valid route found');

    // ── 5. Build swap transaction ──────────────────────────────────
    const swapRes = await axios.post(`${JUPITER_API}/swap`, {
      quoteResponse:    quote,
      userPublicKey:    sessionPubkey,   // session wallet pays
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    });

    const { swapTransaction } = swapRes.data;
    if (!swapTransaction) throw new Error('Jupiter: swap build failed');

    // ── 6. Deserialize + sign with session keypair ─────────────────
    const txBuf = Buffer.from(swapTransaction, 'base64');
    const tx    = VersionedTransaction.deserialize(txBuf);
    tx.sign([keypair]);

    // ── 7. Send & confirm ──────────────────────────────────────────
    const sig = await this.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    await this.connection.confirmTransaction(sig, 'confirmed');

    // ── 8. Record in DB ───────────────────────────────────────────
    const buyPrice = amountSol / (parseInt(quote.outAmount) || 1);
    const trade = await recordTrade({
      coin_address:   tokenAddress,
      coin_name:      coinName,
      coin_symbol:    coinSymbol,
      buy_price_sol:  buyPrice,
      amount_sol:     amountSol,
      wallet_address: userWallet,
      session_pubkey: sessionPubkey,
      tx_signature:   sig,
    });

    console.log(`[BOT] ✅ AUTO-BUY ${coinSymbol} | ${amountSol} SOL | tx: ${sig.slice(0,12)}...`);
    return { success: true, txSignature: sig, tradeId: trade.id, outAmount: quote.outAmount };
  }

  /**
   * AUTO-SELL: sell a portion of tokens from session wallet.
   * Used by take-profit monitor.
   */
  async autoSell({ userWallet, tokenAddress, tokenAmount, tradeId, tpLevel, slippageBps = 500 }) {
    const keypair       = await this.sessionService.getKeypair(userWallet);
    const sessionPubkey = keypair.publicKey.toBase58();

    const quoteRes = await axios.get(`${JUPITER_API}/quote`, {
      params: {
        inputMint:  tokenAddress,
        outputMint: SOL_MINT,
        amount:     tokenAmount.toString(),
        slippageBps,
      },
    });
    const quote = quoteRes.data;
    if (!quote?.outAmount) throw new Error('Jupiter sell: no route');

    const swapRes = await axios.post(`${JUPITER_API}/swap`, {
      quoteResponse:    quote,
      userPublicKey:    sessionPubkey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    });

    const txBuf = Buffer.from(swapRes.data.swapTransaction, 'base64');
    const tx    = VersionedTransaction.deserialize(txBuf);
    tx.sign([keypair]);

    const sig = await this.connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
    await this.connection.confirmTransaction(sig, 'confirmed');

    if (tradeId && tpLevel) await updateTradeTP(tradeId, tpLevel);
    console.log(`[BOT] 📤 AUTO-SELL TP${tpLevel} | tx: ${sig.slice(0,12)}...`);
    return { success: true, txSignature: sig, outAmountSol: parseInt(quote.outAmount) / LAMPORTS_PER_SOL };
  }
}
