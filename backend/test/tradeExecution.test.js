import assert from 'assert';
import { tradeExecutionService, JITO_TIP_ACCOUNTS } from '../src/services/tradeExecution.service.js';

console.log('--- Starting Trade Execution & Jito MEV Bundle Tests ---');

async function runTests() {
  // ── Test 1: Live Tip Floor Retrieval & Caching ────────────────────────
  console.log('[Test 1] Testing Jito tip floor retrieval and caching...');
  const tipFloor = await tradeExecutionService.getTipFloor();
  assert(tipFloor != null, 'Tip floor data should not be null');
  assert(typeof tipFloor === 'object', 'Tip floor must be an object');
  console.log(`✓ [Test 1 Passed]: Tip floor fetched (p50: ${tipFloor.landed_tips_50th_percentile}, p99: ${tipFloor.landed_tips_99th_percentile}).`);

  // ── Test 2: Dynamic Tip Calculation ──────────────────────────────────
  console.log('[Test 2] Testing dynamic tip sizing for different trade sizes...');
  const tipSmall = await tradeExecutionService.calculateDynamicTip(0.05); // 0.05 SOL trade
  const tipMedium = await tradeExecutionService.calculateDynamicTip(0.5); // 0.5 SOL trade
  const tipLarge = await tradeExecutionService.calculateDynamicTip(2.0);  // 2.0 SOL trade

  assert(tipSmall.tipSol >= 0.00002, 'Small trade tip must be above minimum floor (0.00002 SOL)');
  assert(tipSmall.tipSol <= 0.05 * 0.05, 'Small trade tip must not exceed 5% of trade size');
  assert(tipMedium.tipSol >= tipSmall.tipSol, 'Medium trade tip must be >= small trade tip');
  assert(tipLarge.tipSol <= 0.01, 'Tip must be clamped at maximum cap 0.01 SOL');
  console.log(`✓ [Test 2 Passed]: Dynamic tip calculation passed (Small: ${tipSmall.tipSol.toFixed(6)} SOL, Medium: ${tipMedium.tipSol.toFixed(6)} SOL, Large: ${tipLarge.tipSol.toFixed(6)} SOL).`);

  // ── Test 3: Random Tip Account Selection ─────────────────────────────
  console.log('[Test 3] Verifying random tip account selection...');
  const tipAccount = tradeExecutionService.getRandomTipAccount();
  assert(tipAccount != null, 'Tip account must not be null');
  const base58 = tipAccount.toBase58();
  assert(JITO_TIP_ACCOUNTS.includes(base58), `Selected account ${base58} must be in the official Jito tip account whitelist`);
  console.log(`✓ [Test 3 Passed]: Whitelisted Jito tip account selected: ${base58}.`);

  console.log('\n✅ All Trade Execution & Jito MEV Tests Passed (3/3)!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
