import assert from 'assert';
import { DexScreenerService } from '../src/services/dexscreener.service.js';
import { GMGNService } from '../src/services/gmgn.service.js';

console.log('--- Starting DexScreener 13-Endpoint Synergy & Risk Neutralization Tests ---');

async function runTests() {
  const dexscreener = new DexScreenerService();
  const gmgn = new GMGNService();

  // -------------------------------------------------------------
  // Test 1: Service Maps & Initialization
  // -------------------------------------------------------------
  console.log('[Test 1] Verifying DexScreenerService maps & cache initialization...');
  assert(dexscreener.endpointCache instanceof Map, 'endpointCache is Map');
  assert(dexscreener.ctoMap instanceof Map, 'ctoMap is Map');
  assert(dexscreener.boostsMap instanceof Map, 'boostsMap is Map');
  assert(dexscreener.adsMap instanceof Map, 'adsMap is Map');
  console.log('✓ [Test 1 Passed]: All 4 in-memory caches and index maps initialized.');

  // -------------------------------------------------------------
  // Test 2: Inflow Discovery & Narrative Endpoints (1-6, 12, 13)
  // -------------------------------------------------------------
  console.log('[Test 2] Testing Token Profiles, Boosts, Ads, CTO, and Metas endpoints...');
  
  // Endpoint 1: Latest Profiles
  const profiles = await dexscreener.fetchLatestTokenProfiles();
  assert(Array.isArray(profiles), 'fetchLatestTokenProfiles returns Array');
  console.log(`  -> Endpoint 1 (/token-profiles/latest/v1): ${profiles.length} profiles discovered`);

  // Endpoint 2: Recent Updates
  const recent = await dexscreener.fetchRecentTokenProfiles();
  assert(Array.isArray(recent), 'fetchRecentTokenProfiles returns Array');
  console.log(`  -> Endpoint 2 (/token-profiles/recent-updates/v1): ${recent.length} recent updates`);

  // Endpoint 3: Community Takeovers (CTO)
  const ctoList = await dexscreener.fetchCommunityTakeovers();
  assert(Array.isArray(ctoList), 'fetchCommunityTakeovers returns Array');
  console.log(`  -> Endpoint 3 (/community-takeovers/latest/v1): ${ctoList.length} CTOs found, ctoMap size: ${dexscreener.ctoMap.size}`);

  // Endpoint 4: Latest Ads
  const adsList = await dexscreener.fetchLatestAds();
  assert(Array.isArray(adsList), 'fetchLatestAds returns Array');
  console.log(`  -> Endpoint 4 (/ads/latest/v1): ${adsList.length} active ads found, adsMap size: ${dexscreener.adsMap.size}`);

  // Endpoint 5 & 6: Latest & Top Boosts
  const latestBoosts = await dexscreener.fetchLatestBoosts();
  assert(Array.isArray(latestBoosts), 'fetchLatestBoosts returns Array');
  const topBoosts = await dexscreener.fetchTopBoosts();
  assert(Array.isArray(topBoosts), 'fetchTopBoosts returns Array');
  console.log(`  -> Endpoints 5 & 6 (/token-boosts): ${latestBoosts.length} latest, ${topBoosts.length} top boosts, boostsMap size: ${dexscreener.boostsMap.size}`);

  // Endpoint 12 & 13: Trending Narrative Metas
  const trendingMetas = await dexscreener.fetchTrendingMetas();
  assert(Array.isArray(trendingMetas), 'fetchTrendingMetas returns Array');
  console.log(`  -> Endpoint 12 (/metas/trending/v1): ${trendingMetas.length} trending narrative metas`);
  if (trendingMetas.length > 0 && trendingMetas[0].slug) {
    const metaWithPairs = await dexscreener.fetchMetaWithPairs(trendingMetas[0].slug);
    console.log(`  -> Endpoint 13 (/metas/meta/v1/{slug}): Meta "${trendingMetas[0].name || trendingMetas[0].slug}" fetched with details`);
  } else {
    // Fallback verification of endpoint 13 with dummy slug
    const meta = await dexscreener.fetchMetaWithPairs('ai');
    assert(meta === null || typeof meta === 'object', 'fetchMetaWithPairs handled safely');
    console.log(`  -> Endpoint 13 (/metas/meta/v1/{slug}): Verified response structure`);
  }
  console.log('✓ [Test 2 Passed]: Profiles, CTO, Ads, Boosts, and Metas endpoints validated.');

  // -------------------------------------------------------------
  // Test 3: Market Lookup & Pair Endpoints (7-11)
  // -------------------------------------------------------------
  console.log('[Test 3] Testing Dex Market Lookup Endpoints (Pairs, Search, Pools, Batch, Orders)...');
  const wifMint = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm';

  // Endpoint 7: Orders
  const ordersResponse = await dexscreener.checkPaidOrders('solana', wifMint);
  const orders = Array.isArray(ordersResponse) ? ordersResponse : (Array.isArray(ordersResponse?.orders) ? ordersResponse.orders : []);
  assert(ordersResponse === null || typeof ordersResponse === 'object', 'checkPaidOrders returns object or null');
  console.log(`  -> Endpoint 7 (/orders/v1/{chainId}/{tokenAddress}): Orders fetched (${orders.length} items)`);

  // Endpoint 9: Search
  const searchResults = await dexscreener.searchPairs('WIF');
  assert(Array.isArray(searchResults), 'searchPairs returns Array');
  assert(searchResults.length > 0, 'WIF search returned pairs');
  console.log(`  -> Endpoint 9 (/latest/dex/search): Found ${searchResults.length} pairs matching WIF`);

  // Endpoint 8: Single Pair Details
  const topPair = searchResults.find(p => p.chainId === 'solana') || searchResults[0];
  const topPairId = topPair.pairAddress;
  const pairDetails = await dexscreener.fetchPair(topPair.chainId, topPairId);
  assert(pairDetails != null, 'fetchPair returns pair object');
  assert(pairDetails.pairAddress === topPairId, 'Pair address matches');
  console.log(`  -> Endpoint 8 (/latest/dex/pairs/{chainId}/{pairId}): Pair ${pairDetails.baseToken.symbol}/${pairDetails.quoteToken.symbol} @ $${pairDetails.priceUsd}`);

  // Endpoint 10: Pools for Token
  const pools = await dexscreener.fetchTokenPools('solana', wifMint);
  assert(Array.isArray(pools), 'fetchTokenPools returns Array');
  console.log(`  -> Endpoint 10 (/token-pairs/v1/{chainId}/{tokenAddress}): Found ${pools.length} pools for $WIF`);

  // Endpoint 11: Batch Token Lookup
  const batchPairs = await dexscreener.fetchTokensBatch('solana', [wifMint]);
  assert(Array.isArray(batchPairs), 'fetchTokensBatch returns Array');
  assert(batchPairs.length > 0, 'Batch lookup retrieved $WIF pair');
  console.log(`  -> Endpoint 11 (/tokens/v1/{chainId}/{tokenAddresses}): Batch returned ${batchPairs.length} pairs`);
  console.log('✓ [Test 3 Passed]: All 5 market lookup endpoints operational.');

  // -------------------------------------------------------------
  // Test 4: Authoritative Dex Paid Calculation ($299 + $249 = $548)
  // -------------------------------------------------------------
  console.log('[Test 4] Verifying Authoritative Dex Paid Calculation...');
  const mockPaidOrders = [
    { type: 'tokenProfile', status: 'approved', paymentTimestamp: Date.now() - 86400000 },
    { type: 'tokenAd', status: 'approved', paymentTimestamp: Date.now() - 3600000 },
  ];

  const paidResult = gmgn._buildSecurityDetailsResult(
    'TokenMockPaid111111111111111111111111111111',
    {},
    {},
    null,
    { name: 'PaidToken', symbol: 'PAID' },
    mockPaidOrders
  );

  assert.strictEqual(paidResult.dexPaid, true, 'dexPaid is true');
  assert.strictEqual(paidResult.dexPaidAmount, 548, 'Cost sums to $548 ($299 Profile + $249 Ads)');
  assert.strictEqual(paidResult.dexPaidDisplay, '$548 • Profile+Ads', 'Display string formatted');
  assert.strictEqual(paidResult.dexOrders.length, 2, 'Two verified orders attached');
  console.log(`✓ [Test 4 Passed]: Exact Dex Paid verification ($299 + $249 = $548) passed.`);

  // -------------------------------------------------------------
  // Test 5: Community Takeover (CTO) Risk Neutralization
  // -------------------------------------------------------------
  console.log('[Test 5] Verifying Community Takeover (CTO) Risk Neutralization...');
  const mockCtoOrders = [
    { type: 'communityTakeover', status: 'approved', paymentTimestamp: 1727829542371 },
  ];

  const ctoResult = gmgn._buildSecurityDetailsResult(
    'TokenMockCTO1111111111111111111111111111111',
    { stat: { creator_hold_rate: '0.45' }, dev: { creator_token_balance: '450000000' } },
    { renounced_mint: 1 },
    null,
    { name: 'CtoToken', symbol: 'CTO' },
    mockCtoOrders
  );

  assert.strictEqual(ctoResult.isCTO, true, 'isCTO flag set to true');
  assert(['0%', '0.0%'].includes(ctoResult.devHoldPercent), 'Dev hold percent neutralized to 0%');
  assert.strictEqual(ctoResult.rugPercent, '0%', 'Dev rug percent neutralized to 0%');
  assert.strictEqual(ctoResult.isDevVerified, true, 'Decentralized dev status verified');
  assert(ctoResult.ctoClaimDate != null, 'CTO claim timestamp preserved');
  console.log(`✓ [Test 5 Passed]: CTO successfully neutralized dev rug risk to 0% with claim date ${ctoResult.ctoClaimDate}.`);

  // -------------------------------------------------------------
  // Test 6: Batch Live Price Refresh Synchronization
  // -------------------------------------------------------------
  console.log('[Test 6] Testing batch live price synchronization...');
  const testTokens = [
    {
      address: wifMint,
      name: 'dogwifhat',
      symbol: 'WIF',
      price: 1.00,
      mktCapK: 1000,
      liquidityK: 500,
      holdersCount: 500000,
      website: 'https://dogwifcoin.org'
    }
  ];

  const refreshed = await dexscreener.refreshTokensLivePrices(testTokens);
  assert.strictEqual(refreshed.length, 1, 'Same token count returned');
  assert(refreshed[0].price > 0, 'Price updated with live value');
  assert(refreshed[0].mktCapK > 100000, 'Market cap updated with real-time value');
  assert(refreshed[0].holdersCount === 500000, 'Original metadata preserved');
  assert.strictEqual(refreshed[0].website, 'https://dogwifcoin.org', 'Website link preserved');
  assert(['up', 'down', 'same'].includes(refreshed[0].priceDelta), 'priceDelta correctly assigned');
  console.log(`✓ [Test 6 Passed]: Batch price refresh updated $WIF to $${refreshed[0].price} with delta: ${refreshed[0].priceDelta}.`);

  console.log('\n================================================================');
  console.log(' ALL 13 DEXSCREENER ENDPOINTS & RISK NEUTRALIZATION TESTS PASSED');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
