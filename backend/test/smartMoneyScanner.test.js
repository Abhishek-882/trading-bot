import assert from 'assert';
import { initializeDB, saveSmartWallet, getSmartWallets, toggleStarSmartWallet, saveClusterEvent, getClusterEvents } from '../src/db/database.js';
import { SmartMoneyScannerService } from '../src/services/smartMoneyScanner.service.js';
import { excelExporter } from '../src/services/excelExporter.service.js';

console.log('--- Starting Smart Money Scanner & Cluster Radar Unit Tests ---');

async function runTests() {
  await initializeDB();

  // ── Test 1: Database Persistence & Querying ──────────────────────────
  console.log('[Test 1] Testing smart wallet saving, ranking, and star toggling...');
  const walletA = {
    wallet_address: 'SmartWallet111111111111111111111111111111111',
    score: 88,
    win_rate_7d: 75.5,
    win_rate_30d: 72.0,
    realized_pnl_usd: 125000,
    unrealized_pnl_usd: 15000,
    total_trades: 42,
    tokens_traded_count: 5,
    early_entry_count: 4,
    avg_entry_mcap_usd: 180000,
    is_starred: false,
    tags: ['smart_money', 'whale'],
  };

  const walletB = {
    wallet_address: 'SmartWallet222222222222222222222222222222222',
    score: 95,
    win_rate_7d: 82.0,
    win_rate_30d: 80.5,
    realized_pnl_usd: 340000,
    unrealized_pnl_usd: 45000,
    total_trades: 58,
    tokens_traded_count: 8,
    early_entry_count: 7,
    avg_entry_mcap_usd: 95000,
    is_starred: true,
    tags: ['smart_money', 'early_alpha'],
  };

  await saveSmartWallet(walletA);
  await saveSmartWallet(walletB);

  const allWallets = await getSmartWallets();
  assert(allWallets.length >= 2, 'Should retrieve at least 2 saved wallets');
  
  // WalletB has score 95, WalletA has score 88 -> WalletB should come before WalletA
  const idxB = allWallets.findIndex(w => w.wallet_address === walletB.wallet_address);
  const idxA = allWallets.findIndex(w => w.wallet_address === walletA.wallet_address);
  assert(idxB < idxA, 'Higher score wallet must rank ahead');

  // Test star toggling
  const toggled = await toggleStarSmartWallet(walletA.wallet_address);
  assert.strictEqual(toggled.is_starred, true, 'WalletA star status should toggle to true');
  const toggledBack = await toggleStarSmartWallet(walletA.wallet_address);
  assert.strictEqual(toggledBack.is_starred, false, 'WalletA star status should toggle back to false');
  console.log('✓ [Test 1 Passed]: Smart wallet database persistence and star toggling verified.');

  // ── Test 2: Qualification & Veto Gate Verification ────────────────────
  console.log('[Test 2] Testing qualification gates, tag vetoes, and caliber scoring...');
  const scanner = new SmartMoneyScannerService();

  // Test cluster detection and toxic cabal divergence
  const testWallets = [
    {
      wallet_address: 'KOLTraderAddress1111111111111111111111111111',
      score: 70,
      win_rate_7d: 65,
      realized_pnl_usd: 50000,
      tags: ['kol'],
      tokenDetails: [
        {
          tokenAddress: 'PumpCoin111111111111111111111111111111111111',
          tokenSymbol: 'PUMP',
          entryMcap: 120000,
          isOpenOrClose: 0, // KOL is BUYING
        },
      ],
    },
    {
      wallet_address: 'SmartMoneyAddress22222222222222222222222222222',
      score: 92,
      win_rate_7d: 80,
      realized_pnl_usd: 150000,
      tags: ['smart_money'],
      tokenDetails: [
        {
          tokenAddress: 'PumpCoin111111111111111111111111111111111111',
          tokenSymbol: 'PUMP',
          entryMcap: 85000,
          isOpenOrClose: 1, // Smart Money is SELLING/CLOSING
        },
      ],
    },
  ];

  const clusters = scanner.detectTokenClusters(testWallets, [
    { address: 'PumpCoin111111111111111111111111111111111111', symbol: 'PUMP', name: 'Pump Coin', mcap: 150000 },
  ]);

  assert.strictEqual(clusters.length, 1, 'Should detect 1 cluster where 2 wallets converged');
  assert.strictEqual(clusters[0].is_cabal_divergence, true, 'Toxic Cabal Divergence must be flagged true when KOL buys and smart money sells');
  assert(clusters[0].confidence_score <= 60, 'Confidence score must be penalized when cabal divergence is detected');
  console.log('✓ [Test 2 Passed]: Cluster convergence and Toxic Cabal Divergence detection verified.');

  // ── Test 3: Excel Exporter Multi-Sheet Workbook ───────────────────────
  console.log('[Test 3] Generating multi-sheet Excel spreadsheet with styles...');
  // Save a clean cluster event for sheet 2
  await saveClusterEvent({
    token_address: 'SolTokenClean1111111111111111111111111111111',
    token_name: 'Alpha Token',
    token_symbol: 'ALPHA',
    cluster_count: 3,
    smart_wallets: [
      { wallet_address: 'W1', score: 90, win_rate: 75, entry_mcap: 100000 },
      { wallet_address: 'W2', score: 85, win_rate: 68, entry_mcap: 150000 },
      { wallet_address: 'W3', score: 92, win_rate: 80, entry_mcap: 120000 },
    ],
    average_entry_mcap: 123333,
    confidence_score: 95,
    is_cabal_divergence: false,
  });

  const buffer = await excelExporter.generateWorkbookBuffer();
  assert(Buffer.isBuffer(buffer), 'Output must be a Node.js Buffer');
  assert(buffer.length > 5000, `Excel file buffer should be non-trivial (got ${buffer.length} bytes)`);
  console.log(`✓ [Test 3 Passed]: Multi-sheet Excel workbook generated successfully (${(buffer.length / 1024).toFixed(1)} KB).`);

  console.log('\n✅ All Smart Money Scanner & Cluster Radar Tests Passed (3/3)!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
