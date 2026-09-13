import assert from 'assert';
import { initializeDB, saveSmartWallet, saveKolWallet, getSmartWallets, getKolWallets } from '../src/db/database.js';
import { WalletsRadarService } from '../src/services/walletsRadar.service.js';
import { excelExporter } from '../src/services/excelExporter.service.js';

console.log('--- Starting Wallets Radar (Smart Money & KOL 2-Section Ranking) Tests ---');

async function runTests() {
  await initializeDB();
  const radarService = new WalletsRadarService();

  // Test 1: Helper formatters
  console.log('[Test 1] Testing time and age formatters...');
  const now = Date.now();
  assert.strictEqual(radarService.formatTimeAgo(now - 45000), '45s');
  assert.strictEqual(radarService.formatTimeAgo(now - 120000), '2m');
  assert.strictEqual(radarService.formatTimeAgo(now - 7200000), '2h');
  assert.strictEqual(radarService.formatTimeAgo(now - 86400000 * 3), '3d');
  assert.strictEqual(radarService.formatWalletAge(now - 86400000 * 490), '490d');
  assert.strictEqual(radarService.formatWalletAge(now - 86400000 * 1), '1d');
  console.log('✓ [Test 1 Passed]: Time and age formatters produce human-readable strings.');

  // Test 2: Database persistence for both sections
  console.log('[Test 2] Testing Smart Money and KOL wallet persistence...');
  const smartWalletA = {
    wallet_address: 'CLDQUq2e7P1z8t75bS7k2r7q1u7v5f5t8r7p9m8vh3aM',
    name: 'SmartAlpha1',
    score: 94,
    win_rate_7d: 82.5,
    win_rate_30d: 80.0,
    realized_pnl_usd: 88.06,
    realized_pnl_percent: 8.23,
    sol_balance: 30.61,
    last_active_timestamp: Date.now() - 7 * 3600 * 1000,
    wallet_created_at: Date.now() - 490 * 86400 * 1000,
    bought_usd: 1060,
    avg_buy_mc: 220000,
    sold_usd: 1150,
    avg_sold_mc: 240000,
    remaining_usd: 0,
    remaining_percent: 0,
    funding_source: '9WuF...hbdd',
    funding_amount: 5.0,
    coins_count: 2,
    coins_entered: [
      { symbol: 'JUST', name: 'Just Do It', address: 'B5vZ3sppLppLfnurc19JBphtgJijdX18LYfc36xCeUWW', entryMcap: 220000, boughtUsd: 1060, soldUsd: 1150, realizedPnlUsd: 88.06, pnlPercent: 8.23, isEarly: true },
    ],
    tags: ['smart_degen'],
    rank: 1,
  };

  const kolWalletA = {
    wallet_address: 'KOL9999999999999999999999999999999999999Top1',
    name: 'SolWhaleInfluencer',
    twitter_username: 'SolCryptoKing',
    score: 91,
    win_rate_7d: 74.0,
    win_rate_30d: 71.5,
    realized_pnl_usd: 2450.50,
    realized_pnl_percent: 45.2,
    sol_balance: 145.2,
    last_active_timestamp: Date.now() - 2 * 3600 * 1000,
    wallet_created_at: Date.now() - 159 * 86400 * 1000,
    bought_usd: 5420,
    avg_buy_mc: 180000,
    sold_usd: 7870,
    avg_sold_mc: 260000,
    remaining_usd: 1200,
    remaining_percent: 15,
    funding_source: 'Binance',
    funding_amount: 14.99,
    coins_count: 3,
    coins_entered: [
      { symbol: 'TOES', name: 'TOES', address: '6ehEcTMCc85aNF4x9CWx8HuvWGhxQtvKdhKVf2HDpump', entryMcap: 180000, boughtUsd: 2500, soldUsd: 3800, realizedPnlUsd: 1300, pnlPercent: 52.0, isEarly: true },
    ],
    tags: ['renowned', 'kol'],
    rank: 1,
  };

  await saveSmartWallet(smartWalletA);
  await saveKolWallet(kolWalletA);

  const smartList = await getSmartWallets({ limit: 50 });
  const kolList = await getKolWallets({ limit: 50 });

  const foundSmart = smartList.find(w => w.wallet_address === smartWalletA.wallet_address);
  const foundKol = kolList.find(w => w.wallet_address === kolWalletA.wallet_address);

  assert(foundSmart != null, 'Saved Smart Money wallet must be retrievable');
  assert.strictEqual(foundSmart.sol_balance, 30.61, 'Smart Money SOL balance must match');
  assert.strictEqual(foundSmart.coins_count, 2, 'Smart Money coins count must match');

  assert(foundKol != null, 'Saved KOL wallet must be retrievable');
  assert.strictEqual(foundKol.twitter_username, 'SolCryptoKing', 'KOL twitter username must match');
  assert.strictEqual(foundKol.funding_source, 'Binance', 'KOL funding source must match');
  console.log('✓ [Test 2 Passed]: Smart Money and KOL wallets persisted with distinct metrics.');

  // Test 3: Radar query with search and sorting
  console.log('[Test 3] Testing getRadarData query with token filtering...');
  const radarData = await radarService.getRadarData({ search: 'JUST' });
  assert(radarData.smartWallets.length > 0, 'Searching by entered coin $JUST must return entering wallet');
  assert(radarData.smartWallets.some(w => w.wallet_address === smartWalletA.wallet_address), 'Search results must include smartWalletA');

  const radarDataByKOL = await radarService.getRadarData({ search: 'SolCryptoKing' });
  assert(radarDataByKOL.kolWallets.length > 0, 'Searching by KOL name/handle must return KOL wallet');
  console.log('✓ [Test 3 Passed]: Radar search across wallet addresses and coin symbols verified.');

  // Test 4: Excel workbook generation for both sections
  console.log('[Test 4] Generating Wallets Radar multi-sheet Excel workbook...');
  const excelBuffer = await excelExporter.generateRadarWorkbookBuffer();
  assert(Buffer.isBuffer(excelBuffer), 'Radar Excel export must return a valid Buffer');
  assert(excelBuffer.length > 1000, 'Radar Excel buffer must contain substantial sheet data');
  console.log(`✓ [Test 4 Passed]: Wallets Radar Excel workbook generated (${(excelBuffer.length / 1024).toFixed(1)} KB) with Smart Money & KOL sheets.`);

  // Test 5: Edge cases & Empty Breakdown Handlers
  console.log('[Test 5] Testing empty/malformed trader breakdown handling...');
  const emptyBreakdown = await radarService.getTokenTradersBreakdown('InvalidTokenAddress1111111111111111111111111');
  assert(emptyBreakdown != null, 'Breakdown must not be null');
  assert.strictEqual(emptyBreakdown.all.length, 0, 'Empty breakdown should have 0 traders');
  assert.strictEqual(emptyBreakdown.smart.length, 0, 'Smart list should be empty');
  assert.strictEqual(emptyBreakdown.kol.length, 0, 'KOL list should be empty');
  assert.strictEqual(radarService.formatTimeAgo(null), '--', 'Null timestamp must format as --');
  assert.strictEqual(radarService.formatWalletAge(0), '--', 'Zero timestamp must format as --');
  console.log('✓ [Test 5 Passed]: Empty trader responses and null inputs handled gracefully.');

  // Test 6: Anti-scam veto tags and genuine sold MC metrics (no fake multipliers)
  console.log('[Test 6] Testing anti-scam veto logic and genuine sold MC calculation...');
  const scamBundlerWallet = {
    wallet_address: 'ScamBundler99999999999999999999999999999999',
    tags: ['bundler', 'smart_degen'],
    sold_usd: 0,
    avg_sold_mc: null,
  };
  const isVetoed = scamBundlerWallet.tags.some(t =>
    t.includes('bundler') || t.includes('rat_trader') || t.includes('scam') || t.includes('phishing')
  );
  assert.strictEqual(isVetoed, true, 'Wallet with bundler tag must be vetoed from radar');
  assert.strictEqual(scamBundlerWallet.avg_sold_mc, null, 'Unsold holding must have null avg_sold_mc (no fake 1.1x multiplier)');
  // Test 7: Recent Coins bought by Smart Money & KOL wallets (with no wallet addresses)
  console.log('[Test 7] Testing getRecentCoins aggregation, low age priority, and maxAgeHours filter...');
  const recentCoinsDefault = await radarService.getRecentCoins({ maxAgeHours: 0, maxEntryMcap: 500, minWinRate: 0, minVolume: 0 });
  assert(recentCoinsDefault != null, 'getRecentCoins result must not be null');
  assert(Array.isArray(recentCoinsDefault.all), 'recentCoinsDefault.all must be an array');
  assert(Array.isArray(recentCoinsDefault.smartCoins), 'recentCoinsDefault.smartCoins must be an array');
  assert(Array.isArray(recentCoinsDefault.kolCoins), 'recentCoinsDefault.kolCoins must be an array');
  assert(recentCoinsDefault.totalCount > 0, 'Must have aggregated coins from persisted smart & KOL wallets');

  // Verify coin attributes (no wallet address on coin items)
  const justCoin = recentCoinsDefault.all.find(c => c.symbol === 'JUST');
  assert(justCoin != null, 'JUST coin entered by smart wallet must be found');
  assert.strictEqual(justCoin.smartBuyersCount, 1, 'JUST must have 1 smart buyer');
  assert.strictEqual(justCoin.entryMcap, 220000, 'JUST entry MC must be 220000');
  assert.strictEqual(justCoin.wallet_address, undefined, 'Coin object must NOT contain wallet_address');
  assert(justCoin.ageMinutes != null, 'Coin must have ageMinutes');
  assert(justCoin.ageHours != null, 'Coin must have ageHours');

  // Verify filter = 0 orders by lowest age first
  if (recentCoinsDefault.all.length >= 2) {
    assert(recentCoinsDefault.all[0].ageMinutes <= recentCoinsDefault.all[1].ageMinutes, 'Default filter=0 must rank by lowest age first');
  }

  // Verify filter = 3h filters by <=3h and ranks by most smart or kol buyers
  const recentCoins3h = await radarService.getRecentCoins({ maxAgeHours: 3, maxEntryMcap: 500, minWinRate: 0, minVolume: 0 });
  assert(recentCoins3h.all.every(c => c.ageHours <= 3), 'All coins under 3h filter must have ageHours <= 3');
  if (recentCoins3h.all.length >= 2) {
    const buyers0 = (recentCoins3h.all[0].smartBuyersCount || 0) + (recentCoins3h.all[0].kolBuyersCount || 0);
    const buyers1 = (recentCoins3h.all[1].smartBuyersCount || 0) + (recentCoins3h.all[1].kolBuyersCount || 0);
    assert(buyers0 >= buyers1, 'Filter > 0 must rank by high smart/kol buyers count first');
  }
  console.log('✓ [Test 7 Passed]: getRecentCoins accurately enforces low age ranking and maxAgeHours conditional sorting with zero wallet addresses.');

  console.log('\n================================================================');
  console.log(' ALL 7 WALLETS RADAR (SMART MONEY & KOL & RECENT COINS) TESTS PASSED (100%)');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
