import { RankingService } from '../src/services/ranking.service.js';
import { FilterService } from '../src/services/filter.service.js';
import { websiteVerifier } from '../src/services/websiteVerifier.service.js';

console.log('--- Starting Rugged Token Eviction & Socials Discovery Tests ---');

const rankingService = new RankingService();
const filterService = new FilterService();

const testCoins = [
  { address: 'LiveCoin11111111111111111111111111111', symbol: 'LIVE1', mktCapK: 45.2, liquidityK: 8.5, devRugPercent: 5, websiteUrl: 'https://livecoin.com', twitterUrl: 'https://x.com/livecoin', telegramUrl: 'https://t.me/livecoin' },
  { address: 'DeadCoinUnder10K222222222222222222222222222', symbol: 'DEAD1', mktCapK: 4.8, liquidityK: 1.2, devRugPercent: 10 },
  { address: 'PulledLiqCoin33333333333333333333333333333', symbol: 'RUGPULL', mktCapK: 15.0, liquidityK: 0.3, devRugPercent: 20 },
  { address: 'HardRuggedCoin444444444444444444444444444', symbol: 'HARDRUG', mktCapK: 18.0, liquidityK: 2.0, devRugPercent: 95 },
  { address: 'LiveCoin222222222222222222222222222222', symbol: 'LIVE2', mktCapK: 120.0, liquidityK: 25.0, devRugPercent: 0, websiteUrl: 'https://gemsol.xyz', twitterUrl: 'https://x.com/gemsol' },
];

const ranked = rankingService.rank(testCoins);

if (ranked.length !== 2) {
  console.error('[Test 1 Failed]: Expected exactly 2 non-rugged tokens, got', ranked.length);
  process.exit(1);
}

if (!ranked.find(c => c.symbol === 'LIVE1') || !ranked.find(c => c.symbol === 'LIVE2')) {
  console.error('[Test 1 Failed]: LIVE1 and LIVE2 must be present in ranked tokens');
  process.exit(1);
}

if (ranked.find(c => c.symbol === 'DEAD1') || ranked.find(c => c.symbol === 'RUGPULL') || ranked.find(c => c.symbol === 'HARDRUG')) {
  console.error('[Test 1 Failed]: Rugged/dead tokens under 10K or pulled LP were NOT evicted');
  process.exit(1);
}

console.log('✓ [Test 1 Passed]: Rugged and dead tokens (<10K MCap / pulled LP / 95% dev rug) strictly evicted from rankings');

const filtered = filterService.apply(testCoins, {});
if (filtered.length !== 2) {
  console.error('[Test 2 Failed]: FilterService should evict dead tokens by default, got', filtered.length);
  process.exit(1);
}
console.log('✓ [Test 2 Passed]: FilterService baseline eviction floor eliminates tokens <10K market cap');

if (websiteVerifier.classifyDomainTier('project.com') !== 'best' || websiteVerifier.classifyDomainTier('portal.in') !== 'best') {
  console.error('[Test 3 Failed]: .com and .in should classify as best');
  process.exit(1);
}

if (websiteVerifier.classifyDomainTier('meme.xyz') !== 'small' || websiteVerifier.classifyDomainTier('degencoin.fun') !== 'small') {
  console.error('[Test 3 Failed]: .xyz and .fun should classify as small');
  process.exit(1);
}
console.log('☓ [Test 3 Passed]: Domain tier accurately classifies .com/.in as best and .xyz/.fun as small');

const quickClassified = websiteVerifier.classifyCoinWebsiteQuick({ address: 'Test', website: 'https://myprotocol.org' });
if (!quickClassified || quickClassified.domain !== 'myprotocol.org' || quickClassified.domainTier !== 'best') {
  console.error('[Test 4 Failed]: Quick domain classifier failed');
  process.exit(1);
}
console.log('☓ [Test 4 Passed]: Fast synchronous domain classifier successfully detected myprotocol.org');

console.log('===================================================');
console.log(' ALL RUGGED EVICTION & SOCIALS TESTS PASSED (100%)');
console.log('===================================================');
