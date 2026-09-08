/**
 * RankingService — Two-Tier Dual Ranking Engine:
 *
 * 1. SECTION 1: Low Risk (< 20% Rug Risk)
 *    - Ranked strictly by Net Money (Dev's Total Net Worth in USD: SOL + tokens)
 *    - The wealthiest developers with safest track records appear at the top.
 *
 * 2. SECTION 2: High / Degen Risk (>= 20% Rug Risk)
 *    - Ranked strictly by Net Profit / Net Buy Momentum
 *    - The tokens generating the highest buying profit/volume appear at the top.
 */
export class RankingService {
  rank(coins) {
    if (!coins || !coins.length) return [];

    // Deduplicate so one spammer dev cannot flood the table
    const seenDevs = new Set();
    const seenSymbols = new Set();
    const uniqueCoins = [];

    for (const c of coins) {
      const devKey = c.devAddress ? c.devAddress.toLowerCase() : null;
      const symKey = c.symbol ? c.symbol.toLowerCase() : null;

      if (devKey && seenDevs.has(devKey)) continue;
      if (symKey && symKey.length > 1 && seenSymbols.has(symKey)) continue;

      if (devKey) seenDevs.add(devKey);
      if (symKey) seenSymbols.add(symKey);
      uniqueCoins.push(c);
    }

    const lowRisk = [];
    const highRisk = [];

    for (const c of uniqueCoins) {
      const rugPct = parseFloat(c.devRugPercent ?? 0);
      if (rugPct < 20) {
        lowRisk.push({ ...c, section: 'low_risk', sectionTitle: 'Low Risk (<20%)' });
      } else {
        highRisk.push({ ...c, section: 'high_risk', sectionTitle: 'High Profit (≥20% Risk)' });
      }
    }

    // ── SECTION 1: Low Risk (<20%) → Ranked strictly by Dev Net Money ──
    lowRisk.sort((a, b) => {
      const moneyA = parseFloat(a.devTotalValueUsd ?? (a.devBalanceSol || 0) * 150);
      const moneyB = parseFloat(b.devTotalValueUsd ?? (b.devBalanceSol || 0) * 150);
      return moneyB - moneyA; // Highest net worth first
    });

    lowRisk.forEach((c, idx) => {
      const netWorth = parseFloat(c.devTotalValueUsd ?? (c.devBalanceSol || 0) * 150);
      // Normalized score based on net money (log benchmark: $500 = 60, $5k = 78, $30k+ = 95+)
      const score = netWorth > 10 ? Math.min(99.9, Math.round((Math.log10(netWorth) / Math.log10(40000)) * 100 * 10) / 10) : 50;
      c.sectionRank = idx + 1;
      c.rank = idx + 1;
      c.score = Math.max(10, Math.min(99.9, score));
      c.rankReason = `Ranked by Net Worth: $${Math.round(netWorth).toLocaleString()}`;
    });

    // ── SECTION 2: High Risk (≥20%) → Ranked strictly by Net Profit / Net Buy ──
    highRisk.sort((a, b) => {
      const profitA = parseFloat(a.netBuyK ?? 0);
      const profitB = parseFloat(b.netBuyK ?? 0);
      if (profitB !== profitA) return profitB - profitA; // Highest net buy first
      return (b.volumeK || 0) - (a.volumeK || 0);
    });

    highRisk.forEach((c, idx) => {
      const netBuyUsd = (c.netBuyK || 0) * 1000;
      // Score based on net profit / buy pressure
      const score = netBuyUsd > 10 ? Math.min(99.9, Math.round((Math.log10(netBuyUsd) / Math.log10(15000)) * 100 * 10) / 10) : 45;
      c.sectionRank = idx + 1;
      c.rank = lowRisk.length + idx + 1;
      c.score = Math.max(10, Math.min(99.9, score));
      c.rankReason = `Ranked by Net Profit: +$${Math.round(netBuyUsd).toLocaleString()}`;
    });

    // Return low risk first, then high profit
    return [...lowRisk, ...highRisk];
  }
}
