import type { KnowledgeSearchResult, ConfidenceEvaluation } from './types';

export interface ConfidenceEvaluatorOptions {
  threshold: number;
}

export class ConfidenceEvaluator {
  private threshold: number;

  constructor(options?: ConfidenceEvaluatorOptions) {
    this.threshold = options?.threshold ?? 0.7;
  }

  evaluate(result: KnowledgeSearchResult, cropId?: string): ConfidenceEvaluation {
    let score = 0;

    if (result.diseases.length > 0) {
      score += Math.min(result.diseases.length * 0.25, 0.5);
    }

    if (result.matchedSymptomCount > 0) {
      score += Math.min(result.matchedSymptomCount * 0.15, 0.3);
    }

    if (result.totalKeywordHits > 0) {
      score += Math.min(result.totalKeywordHits * 0.05, 0.2);
    }

    if (result.diseases.length === 0 && result.deficiencies.length > 0) {
      score = Math.min(score, 0.4);
    }

    if (!cropId) {
      score = Math.min(score, 0.3);
    }

    const clamped = Math.min(Math.max(score, 0), 1);

    return {
      score: clamped,
      threshold: this.threshold,
      isHighConfidence: clamped >= this.threshold,
      reason: clamped >= this.threshold
        ? `Knowledge confidence ${(clamped * 100).toFixed(0)}% meets threshold of ${(this.threshold * 100).toFixed(0)}%`
        : `Knowledge confidence ${(clamped * 100).toFixed(0)}% below threshold of ${(this.threshold * 100).toFixed(0)}%`,
    };
  }
}
