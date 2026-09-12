import { FilterService } from '../src/services/filter.service.js';
import { RankingService } from '../src/services/ranking.service.js';

console.log('--- Starting Watchers & Most Watching Filter Tests ---');

const filterService = new FilterService();
const rankingService = new RankingService();

const sampleCoins = [
  { address: 'TokenA1111111111111111111111111111111111111', symbol: 'TOKA', watchersCount: 43, devRugPercent: 5 },
  { address: 'TokenB2222222222222222222222222222222222222', symbol: 'TOKB', watchersCount: 347, devRugPercent: 10 },
  { address: 'TokenC3333333333333333333333333333333333333', symbol: 'TOKC', watchersCount: 15, devRugPercent: 0 },
  { address: 'TokenD4444444444444444444444444444444444444', symbol: 'TOKD', watchersCount: 247, devRugPercent: 25 },
];

// Test 1: minWatchers filter
const filtered50 = filterService.apply(sampleCoins, { minWatchers: '50' });
if (filtered50.length !== 2 || !filtered50.find(c => c.symbol === 'TOKB') || !filtered50.find(c => c.symbol === 'TOKD')) {
  console.error('Test 1 Failed: Expected 2 coins with >= 50 watchers, got', filtered50.length);
  process.exit(1);
}
console.log('✓ [Test 1 Passed]: minWatchers filter accurately filters coins >= 50 watchers');

// Test 2: RankingService sortBy watchers
const rankedByWatchers = rankingService.rank(sampleCoins, { sortBy: 'watchers' });
if (rankedByWatchers[0].symbol !== 'TOKB' || rankedByWatchers[0].watchersCount !== 347) {
  console.error('Test 2 Failed: First ranked coin should be TOKB with 347 watchers, got', rankedByWatchers[0]?.symbol);
  process.exit(1);
}
if (rankedByWatchers[1].symbol !== 'TOKD' || rankedByWatchers[1].watchersCount !== 247) {
  console.error('Test 2 Failed: Second ranked coin should be TOKD with 247 watchers, got', rankedByWatchers[1]?.symbol);
  process.exit(1);
}
console.log('✓ [Test 2 Passed]: RankingService sortBy: "watchers" orders tokens descending (347 -> 247 -> 43 -> 15)');

// Test 3: Watchers guarantee on unpopulated tokens
const unpopulated = [{ address: 'TokenE5555555555555555555555555555555555555', symbol: 'TOKE', buys: 50, volumeK: 200, mktCapK: 150 }];
const rankedUnpopulated = rankingService.rank(unpopulated);
if (!rankedUnpopulated[0].watchersCount || rankedUnpopulated[0].watchersCount <= 0) {
  console.error('Test 3 Failed: Unpopulated coin should have watchersCount derived');
  process.exit(1);
}
console.log(`✓ [Test 3 Passed]: Unpopulated token received derived watchersCount = ${rankedUnpopulated[0].watchersCount}`);

console.log('==============================================');
console.log(' ALL WATCHERS TESTS PASSED (100%)');
console.log('==============================================');
