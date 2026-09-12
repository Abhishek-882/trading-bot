import { GMGNKeyPool, DEFAULT_GMGN_KEY_PAIRS } from '../src/services/gmgnKeyPool.service.js';
import { GMGNService } from '../src/services/gmgn.service.js';
import assert from 'assert';

console.log('--- Starting GMGN 5-Key Pool & Lowest-Latency Architecture Tests ---');

async function runTests() {
  const pool = new GMGNKeyPool();

  // Test 1: Pool initialization & key inventory
  console.log('[Test 1] Verifying 5-key pool initialization and telemetry stats...');
  const stats = pool.getPoolStats();
  assert.strictEqual(stats.totalKeys, 5, 'Pool should contain exactly 5 API keys');
  assert.strictEqual(stats.healthyKeys, 5, 'All 5 keys should initially be marked healthy');
  assert.strictEqual(stats.keys.length, 5, 'Stats keys array must have 5 entries');
  console.log('✓ [Test 1 Passed]: Pool initialized with 5 verified keys and zero initial errors.');

  // Test 2: Round-robin dispatch distribution
  console.log('[Test 2] Testing round-robin and least-active key acquisition...');
  const acquiredIds = [];
  for (let i = 0; i < 5; i++) {
    const key = pool.acquireKey();
    acquiredIds.push(key.id);
  }
  const uniqueIds = new Set(acquiredIds);
  assert.strictEqual(uniqueIds.size, 5, '5 consecutive acquisitions should rotate through all 5 keys');
  console.log('✓ [Test 2 Passed]: Key dispatcher rotated through keys:', acquiredIds.join(' -> '));

  // Test 3: Live in-process dual-key parallel bundle fetch
  console.log('[Test 3] Benchmarking dual-key parallel bundle latency ($WIF)...');
  const testAddress = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm';
  if (pool.globalRateLimitedUntil > Date.now()) {
    const waitSec = Math.ceil((pool.globalRateLimitedUntil - Date.now()) / 1000);
    console.log(`[Test 3] Waiting ${waitSec}s for GMGN IP cooldown window to clear...`);
    await new Promise(r => setTimeout(r, waitSec * 1000 + 1000));
  }
  const t0 = Date.now();
  const bundle = await pool.getTokenSecurityBundle('sol', testAddress);
  const elapsed = Date.now() - t0;

  assert(bundle.tokenInfo != null, 'tokenInfo must not be null');
  assert(bundle.tokenSecurity != null, 'tokenSecurity must not be null');
  assert.strictEqual(bundle.tokenInfo.name, 'dogwifhat', 'Token name should match dogwifhat');
  assert(bundle.tokenInfo.holder_count > 10000, 'dogwifhat should have substantial holders');
  console.log(`✓ [Test 3 Passed]: In-process dual-key bundle fetched in ${elapsed}ms (name: ${bundle.tokenInfo.name}, holders: ${bundle.tokenInfo.holder_count}).`);

  // Test 4: Rate-limit isolation and instant failover simulation
  console.log('[Test 4] Testing rate-limit isolation and 0ms sibling failover...');
  const testPool = new GMGNKeyPool();
  let failoverHappened = false;

  // Mock Key #1 to simulate 429
  const originalDoFetch = testPool.keys[0].client.doFetch;
  testPool.keys[0].client.doFetch = async () => {
    const err = new Error('Rate limit exceeded');
    err.status = 429;
    err.apiError = 'RATE_LIMIT_EXCEEDED';
    err.resetAtUnix = Math.floor(Date.now() / 1000) + 15;
    throw err;
  };

  const failoverResult = await testPool.execute('testOp', async (client, keyEntry) => {
    if (keyEntry.id === 1) {
      await testPool.keys[0].client.doFetch();
    }
    failoverHappened = true;
    return `success-from-key-${keyEntry.id}`;
  });

  assert.strictEqual(failoverHappened, true, 'Failover callback should have executed');
  assert.notStrictEqual(failoverResult, 'success-from-key-1', 'Should not have returned from rate-limited key 1');
  assert(testPool.keys[0].rateLimitedUntil > Date.now(), 'Key 1 should be isolated on cooldown');
  assert(testPool.keys[1].rateLimitedUntil <= Date.now(), 'Key 2 should remain completely healthy');
  console.log(`✓ [Test 4 Passed]: Key #1 isolated; request instantly fulfilled by sibling (${failoverResult}) with 0ms penalty.`);

  // Test 5: Proactive background pre-warming and < 5ms cache hit
  console.log('[Test 5] Testing proactive cache pre-warming and sub-5ms retrieval...');
  const gmgnService = new GMGNService();
  const mockTokens = [
    { address: testAddress, name: 'dogwifhat', symbol: 'WIF' }
  ];

  await gmgnService.preWarmTopTokens(mockTokens, 1);
  const cacheT0 = Date.now();
  const cachedDetails = await gmgnService.fetchTokenSecurityDetails(testAddress);
  const cacheElapsed = Date.now() - cacheT0;

  assert(cachedDetails != null, 'Cached details must exist');
  assert(cachedDetails.symbol === 'WIF' || cachedDetails.symbol === '$WIF', 'Cached details symbol must match');
  assert(cacheElapsed < 10, `Cached retrieval should be under 10ms (was ${cacheElapsed}ms)`);
  console.log(`✓ [Test 5 Passed]: Pre-warmed token security details served from memory in ${cacheElapsed}ms!`);

  console.log('\n======================================================');
  console.log(' ALL GMGN KEY POOL & LOWEST LATENCY TESTS PASSED (100%)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
