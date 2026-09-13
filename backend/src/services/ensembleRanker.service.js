import { aiModelService } from './aiModel.service.js';

export class EnsembleRankerService {
  constructor() {
    this.topK = 5;
    this.cachedTopPicks = [];
    this.lastRankedAt = null;
  }

  /**
   * Evaluates and ranks an array of tokens through the 2-Gate ensemble
   * Returns sorted array of scored tokens with Top 5 tagged
   */
  rankTokens(tokens = []) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return [];
    }

    const scoredTokens = [];

    for (const token of tokens) {
      // Basic sanity: skip unresolvable or dead tokens
      if (!token || !token.address) continue;
      if (token.mktCapK != null && token.mktCapK < 8) continue; // Purge sub-$8K collapsed tokens

      // Execute in-process 2-Gate scoring (<1ms per token)
      const scoreResult = aiModelService.scoreToken(token);

      // Enforce strict security filter
      const devRug = parseFloat(token.devRugPercent ?? 0);
      const isRugRisk = devRug >= 15.0;
      const isHoneypot = Boolean(token.is_honeypot);
      const sniperConcentration = parseFloat(token.cluster_sniper_supply_pct ?? 0);
      const isOverSniped = sniperConcentration > 35.0;

      const isEligible = scoreResult.passes_gate1 && !isRugRisk && !isHoneypot && !isOverSniped;

      scoredTokens.push({
        ...token,
        aiScore: scoreResult.final_score,
        p_xgb: scoreResult.p_xgb,
        p_nlp: scoreResult.p_nlp,
        passes_gate1: scoreResult.passes_gate1,
        confidence_tier: scoreResult.confidence_tier,
        attributions: scoreResult.attributions,
        inference_latency_ms: scoreResult.latency_ms,
        isEligible,
      });
    }

    // Sort eligible candidates by aiScore descending
    const eligible = scoredTokens.filter(t => t.isEligible).sort((a, b) => b.aiScore - a.aiScore);
    const ineligible = scoredTokens.filter(t => !t.isEligible).sort((a, b) => b.aiScore - a.aiScore);

    // Tag top 5 shortlist
    const rankedShortlist = eligible.slice(0, this.topK).map((token, idx) => ({
      ...token,
      rank: idx + 1,
      isTopPick: true,
      recommendedAction: token.aiScore >= 0.45 ? 'BUY' : 'WATCH',
      suggestedTradeSizeSol: 0.20,
      suggestedJitoTipSol: 0.00055,
    }));

    this.cachedTopPicks = rankedShortlist;
    this.lastRankedAt = new Date().toISOString();

    return {
      topPicks: rankedShortlist,
      allScored: [...eligible, ...ineligible],
      metadata: {
        totalEvaluated: scoredTokens.length,
        eligibleCount: eligible.length,
        ineligibleCount: ineligible.length,
        timestamp: this.lastRankedAt,
      },
    };
  }

  /**
   * Retrieves the current Top 5 ranked shortlist
   */
  getTopPicks() {
    return {
      picks: this.cachedTopPicks,
      count: this.cachedTopPicks.length,
      lastRankedAt: this.lastRankedAt,
    };
  }
}

export const ensembleRankerService = new EnsembleRankerService();
