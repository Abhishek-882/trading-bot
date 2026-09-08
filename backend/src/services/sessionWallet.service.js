import { Keypair, Connection, PublicKey, Transaction,
         SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import crypto from 'crypto';
import { saveSessionWallet, getSessionWallet, deactivateSession } from '../db/database.js';

const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_SECRET || 'REPLACE_WITH_32_CHAR_SECRET_KEY!!';
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

/**
 * SessionWalletService — manages bot-controlled session keypairs.
 *
 * Flow:
 *  1. User clicks "Activate Bot" in frontend.
 *  2. Frontend generates a session keypair + sends pubkey to backend.
 *  3. Backend encrypts & stores the private key.
 *  4. User transfers SOL from their Phantom wallet to the session wallet.
 *  5. Bot uses the session keypair to buy/sell autonomously.
 *  6. User can withdraw remaining SOL back anytime.
 */
export class SessionWalletService {
  constructor() {
    this.connection = new Connection(RPC_URL, 'confirmed');
  }

  /**
   * Create a new session wallet for a user.
   * Returns the session public key (user must fund this address).
   */
  async createSession(userWallet, botConfig = {}) {
    // Generate fresh Solana keypair
    const keypair = Keypair.generate();
    const pubkey  = keypair.publicKey.toBase58();
    const privkey = bs58.encode(keypair.secretKey);

    // Encrypt the private key before storing
    const encryptedPrivkey = this._encrypt(privkey);

    await saveSessionWallet({
      userWallet,
      sessionPubkey:    pubkey,
      encryptedPrivkey,
      botConfig,
    });

    console.log(`[SESSION] Created session wallet for ${userWallet.slice(0,8)}... → ${pubkey.slice(0,8)}...`);
    return { sessionPubkey: pubkey };
  }

  /**
   * Reconstruct the session Keypair for signing.
   */
  async getKeypair(userWallet) {
    const session = await getSessionWallet(userWallet);
    if (!session) throw new Error(`No active session for wallet ${userWallet}`);
    const privkey = this._decrypt(session.encrypted_privkey);
    const secretKey = bs58.decode(privkey);
    return Keypair.fromSecretKey(secretKey);
  }

  /**
   * Get the session wallet's current SOL balance.
   */
  async getSessionBalance(userWallet) {
    const session = await getSessionWallet(userWallet);
    if (!session) return 0;
    const lamports = await this.connection.getBalance(new PublicKey(session.session_pubkey));
    return lamports / LAMPORTS_PER_SOL;
  }

  /**
   * Build a "withdraw all" transaction: session wallet → user main wallet.
   * Signed by session keypair (bot-side), so no Phantom needed.
   */
  async withdrawAll(userWallet) {
    const keypair  = await this.getKeypair(userWallet);
    const balance  = await this.connection.getBalance(keypair.publicKey);
    if (balance === 0) throw new Error('Session wallet has no SOL to withdraw');

    // Leave a tiny amount for transaction fees
    const fee     = 5000; // ~0.000005 SOL
    const amount  = balance - fee;
    if (amount <= 0) throw new Error('Insufficient balance after fees');

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey:   new PublicKey(userWallet),
        lamports:   amount,
      })
    );

    const sig = await sendAndConfirmTransaction(this.connection, tx, [keypair]);
    await deactivateSession(userWallet);
    console.log(`[SESSION] Withdrew ${amount / LAMPORTS_PER_SOL} SOL back to ${userWallet.slice(0,8)}...`);
    return { signature: sig, amountSol: amount / LAMPORTS_PER_SOL };
  }

  /**
   * Deactivate a session (stop auto-buy, mark inactive in DB).
   */
  async deactivate(userWallet) {
    await deactivateSession(userWallet);
    console.log(`[SESSION] Deactivated session for ${userWallet.slice(0,8)}...`);
  }

  // ── Encryption helpers ──────────────────────────────────────────

  _encrypt(text) {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv  = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  _decrypt(encryptedText) {
    const [ivHex, encrypted] = encryptedText.split(':');
    const key  = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv   = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
