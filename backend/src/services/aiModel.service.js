import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic models directory resolution
function findModelsDir() {
  const candidates = [
    path.resolve(__dirname, '../../../ml/models'),
    path.resolve(__dirname, '../../ml/models'),
    path.resolve(__dirname, '../ml/models'),
    path.resolve(process.cwd(), 'ml/models'),
    path.resolve(process.cwd(), '../ml/models'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'xgb_model.json'))) {
      return dir;
    }
  }
  return candidates[0];
}

const MODELS_DIR = findModelsDir();

export class AIModelService {
  constructor() {
    this.xgbModel = null;
    this.nlpModel = null;
    this.metaConfig = {
      gate1_sanity_threshold: 0.05,
      xgb_weight: 0.80,
      nlp_weight: 0.20,
      high_confidence_threshold: 0.45,
    };
    this.isLoaded = false;
    this.init();
  }

  init() {
    try {
      const xgbPath = path.join(MODELS_DIR, 'xgb_model.json');
      const nlpPath = path.join(MODELS_DIR, 'nlp_model.json');
      const weightsPath = path.join(MODELS_DIR, 'meta_learner_weights.json');

      if (fs.existsSync(xgbPath)) {
        this.xgbModel = JSON.parse(fs.readFileSync(xgbPath, 'utf8'));
      }
      if (fs.existsSync(nlpPath)) {
        this.nlpModel = JSON.parse(fs.readFileSync(nlpPath, 'utf8'));
      }
      if (fs.existsSync(weightsPath)) {
        this.metaConfig = { ...this.metaConfig, ...JSON.parse(fs.readFileSync(weightsPath, 'utf8')) };
      }

      if (this.xgbModel && this.nlpModel) {
        this.isLoaded = true;
        console.log('[AIModelService] Models initialized successfully: XGBoost (150 trees) + NLP (2500 vocab)');
      } else {
        console.warn('[AIModelService] Model files not fully found in ml/models/. Service running in uninitialized mode.');
      }
    } catch (err) {
      console.error('[AIModelService] Error loading model files:', err.message);
    }
  }

  /**
   * Evaluates a single XGBoost decision tree on a feature vector
   */
  _evaluateTree(tree, features) {
    let node = 0;
    while (tree.left_children[node] !== -1) {
      const splitFeat = tree.split_indices[node];
      const cond = tree.split_conditions[node];
      const val = features[splitFeat] ?? 0;
      if (val < cond) {
        node = tree.left_children[node];
      } else {
        node = tree.right_children[node];
      }
    }
    return tree.split_conditions[node];
  }

  /**
   * Gate 1: XGBoost tabular probability
   */
  predictXgb(features) {
    if (!this.xgbModel) return 0.0;
    const trees = this.xgbModel.learner.gradient_booster.model.trees;
    let sum = 0;
    for (let i = 0; i < trees.length; i++) {
      sum += this._evaluateTree(trees[i], features);
    }
    return 1 / (1 + Math.exp(-sum));
  }

  /**
   * Gate 2: NLP character/word n-gram narrative probability
   */
  predictNlp(name, symbol) {
    if (!this.nlpModel) return 0.0;
    const text = `${name || ''} ${symbol || ''}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const words = text.split(/\s+/).filter(Boolean);
    const ngrams = [];
    for (let i = 0; i < words.length; i++) {
      ngrams.push(words[i]);
      if (i < words.length - 1) {
        ngrams.push(`${words[i]} ${words[i + 1]}`);
      }
    }

    const tf = {};
    for (const ng of ngrams) {
      if (this.nlpModel.vocabulary[ng] !== undefined) {
        tf[ng] = (tf[ng] || 0) + 1;
      }
    }

    let score = this.nlpModel.intercept;
    let normSq = 0;
    const weights = [];
    for (const [ng, count] of Object.entries(tf)) {
      const idx = this.nlpModel.vocabulary[ng];
      const idf = this.nlpModel.idf[idx];
      const sublinearTf = 1 + Math.log(count);
      const w = sublinearTf * idf;
      weights.push({ idx, w });
      normSq += w * w;
    }

    const norm = Math.sqrt(normSq) || 1.0;
    for (const item of weights) {
      const normalizedWeight = item.w / norm;
      score += normalizedWeight * this.nlpModel.coef[item.idx];
    }

    return 1 / (1 + Math.exp(-score));
  }

  /**
   * Extracts the strict 23-feature matrix from a live coin object
   */
  extractFeatures(coin) {
    const buys = parseInt(coin.buys || 0, 10);
    const sells = parseInt(coin.sells || 0, 10);
    const totalSwaps = buys + sells;
    const ageMin = parseInt(coin.ageMinutes || 0, 10);
    const holders = parseInt(coin.holdersCount || 0, 10);
    const bCurve = parseFloat(coin.bCurvePercent ?? 0);

    return [
      parseFloat(coin.mktCapK || 0),                                             // 0: mktCapK
      parseFloat(coin.liquidityK || 0),                                          // 1: liquidityK
      parseFloat(coin.volumeK || 0),                                             // 2: volumeK
      parseFloat(coin.netBuyK || 0),                                             // 3: netBuyK
      totalSwaps > 0 ? buys / totalSwaps : 0.5,                                  // 4: buySellRatio
      bCurve,                                                                    // 5: bCurvePercent
      ageMin > 0 ? bCurve / ageMin : 0,                                          // 6: bCurveVelocity
      ageMin,                                                                    // 7: ageMinutes
      parseFloat(coin.devRugPercent ?? 0),                                       // 8: devRugPercent
      parseInt(coin.devTotalLaunches ?? 1, 10),                                  // 9: devTotalLaunches
      holders,                                                                   // 10: holdersCount
      parseInt(coin.watchersCount || 0, 10),                                     // 11: watchersCount
      parseInt(coin.watchersDelta || 0, 10),                                     // 12: watchersDelta
      (coin.twitterUrl || coin.telegramUrl) ? 1 : 0,                             // 13: hasSocialLinks
      coin.websiteUrl ? 1 : 0,                                                   // 14: hasWebsite
      0,                                                                         // 15: isCTO (pinned to 0 at launch)
      bCurve >= 100 ? 1 : 0,                                                     // 16: isGraduated
      parseInt(coin.txs || totalSwaps || 0, 10),                                 // 17: txCount
      Math.min(1.0, holders / Math.max(buys, 1)),                                // 18: uniqueBuyerRatio
      parseInt(coin.cluster_sniper_count || 0, 10),                              // 19: cluster_sniper_count
      parseFloat(coin.cluster_sniper_supply_pct || 0),                           // 20: cluster_sniper_supply_pct
      0,                                                                         // 21: fee_regime_0
      0,                                                                         // 22: fee_regime_1
      1,                                                                         // 23: fee_regime_2 (current active regime)
    ];
  }

  /**
   * Generates SHAP-style explainability factors for display in Top 5 shortlist
   */
  _deriveAttributions(coin, features, p_xgb, p_nlp) {
    const attributions = [];
    const devRug = features[8];
    const uniqueBuyerRatio = features[18];
    const sniperSupply = features[20];
    const bVelocity = features[6];

    if (devRug === 0) {
      attributions.push({ factor: 'Clean Developer History', impact: '+', detail: '0% prior rug rate' });
    } else if (devRug > 15) {
      attributions.push({ factor: 'Elevated Dev Risk', impact: '-', detail: `${devRug.toFixed(1)}% prior rug rate` });
    }

    if (sniperSupply <= 15) {
      attributions.push({ factor: 'Healthy Cluster Supply', impact: '+', detail: `${sniperSupply.toFixed(1)}% launch slot concentration` });
    } else if (sniperSupply > 30) {
      attributions.push({ factor: 'High Sniper Concentration', impact: '-', detail: `${sniperSupply.toFixed(1)}% early supply captured` });
    }

    if (uniqueBuyerRatio >= 0.5) {
      attributions.push({ factor: 'Organic Holder Spread', impact: '+', detail: `${(uniqueBuyerRatio * 100).toFixed(0)}% unique wallet ratio` });
    }

    if (bVelocity > 5.0) {
      attributions.push({ factor: 'High Curve Velocity', impact: '+', detail: `${bVelocity.toFixed(1)}%/min momentum` });
    }

    if (p_nlp >= 0.5) {
      attributions.push({ factor: 'Strong Narrative Signal', impact: '+', detail: `${(p_nlp * 100).toFixed(0)}% meme archetypal score` });
    }

    return attributions;
  }

  /**
   * Evaluates a token through the 2-Gate ensemble pipeline
   */
  scoreToken(coin) {
    if (!this.isLoaded) {
      return {
        p_xgb: 0,
        p_nlp: 0,
        final_score: 0,
        passes_gate1: false,
        confidence_tier: 'UNVERIFIED',
        attributions: [],
      };
    }

    const t0 = performance.now();
    const features = this.extractFeatures(coin);

    // Gate 1: XGBoost
    const p_xgb = this.predictXgb(features);

    // Gate 1 Loose Sanity Filter (Pass 2 Risk #30)
    if (p_xgb < this.metaConfig.gate1_sanity_threshold) {
      return {
        p_xgb: parseFloat(p_xgb.toFixed(4)),
        p_nlp: 0.0,
        final_score: 0.0,
        passes_gate1: false,
        confidence_tier: 'REJECTED',
        attributions: [{ factor: 'Gate 1 Filter', impact: '-', detail: `P_xgb ${(p_xgb * 100).toFixed(1)}% < 5% threshold` }],
        latency_ms: parseFloat((performance.now() - t0).toFixed(2)),
      };
    }

    // Gate 2: In-Process NLP
    const p_nlp = this.predictNlp(coin.name, coin.symbol);

    // Meta-Learner Explicit Interaction Formula (Pass 2 Risk #29)
    // final_score = p_xgb * (0.80 + 0.20 * p_nlp)
    const final_score = p_xgb * (this.metaConfig.xgb_weight + this.metaConfig.nlp_weight * p_nlp);

    // Confidence tiering
    let confidence_tier = 'LOW';
    if (final_score >= this.metaConfig.high_confidence_threshold) {
      confidence_tier = 'HIGH';
    } else if (final_score >= 0.20) {
      confidence_tier = 'MEDIUM';
    }

    const attributions = this._deriveAttributions(coin, features, p_xgb, p_nlp);
    const latency_ms = parseFloat((performance.now() - t0).toFixed(2));

    return {
      p_xgb: parseFloat(p_xgb.toFixed(4)),
      p_nlp: parseFloat(p_nlp.toFixed(4)),
      final_score: parseFloat(final_score.toFixed(4)),
      passes_gate1: true,
      confidence_tier,
      attributions,
      latency_ms,
    };
  }
}

export const aiModelService = new AIModelService();
