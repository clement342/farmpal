import { describe, it, expect } from 'vitest';
import { ConfidenceEvaluator } from '@/services/reasoning/ConfidenceEvaluator';
import type { KnowledgeSearchResult } from '@/services/reasoning/types';

describe('ConfidenceEvaluator', () => {
  const evaluator = new ConfidenceEvaluator({ threshold: 0.7 });

  it('returns high confidence when many diseases match with symptoms', () => {
    const result: KnowledgeSearchResult = {
      diseases: [{ id: 'd1', name: 'Disease 1', symptoms: ['yellow'] } as any],
      deficiencies: [],
      matchedSymptomCount: 3,
      totalKeywordHits: 5,
    };
    const evaluation = evaluator.evaluate(result);
    expect(evaluation.isHighConfidence).toBe(true);
    expect(evaluation.score).toBeGreaterThanOrEqual(0.7);
  });

  it('returns low confidence when no diseases match', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [],
      matchedSymptomCount: 0,
      totalKeywordHits: 0,
    };
    const evaluation = evaluator.evaluate(result);
    expect(evaluation.isHighConfidence).toBe(false);
    expect(evaluation.score).toBe(0);
  });

  it('returns low confidence when only deficiencies match without disease', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [{ id: 'n1', name: 'Nitrogen Deficiency' } as any],
      matchedSymptomCount: 1,
      totalKeywordHits: 1,
    };
    const evaluation = evaluator.evaluate(result);
    expect(evaluation.isHighConfidence).toBe(false);
  });

  it('uses configured threshold', () => {
    const highThreshold = new ConfidenceEvaluator({ threshold: 0.9 });
    const result: KnowledgeSearchResult = {
      diseases: [{ id: 'd1', name: 'D1', symptoms: ['spot'] } as any],
      deficiencies: [],
      matchedSymptomCount: 1,
      totalKeywordHits: 2,
    };
    expect(highThreshold.evaluate(result).isHighConfidence).toBe(false);

    const lowThreshold = new ConfidenceEvaluator({ threshold: 0.3 });
    expect(lowThreshold.evaluate(result).isHighConfidence).toBe(true);
  });
});
