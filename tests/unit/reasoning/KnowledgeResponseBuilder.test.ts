import { describe, it, expect } from 'vitest';
import { KnowledgeResponseBuilder } from '@/services/reasoning/KnowledgeResponseBuilder';
import type { KnowledgeSearchResult } from '@/services/reasoning/types';

describe('KnowledgeResponseBuilder', () => {
  const builder = new KnowledgeResponseBuilder();

  it('builds diagnosis from matched diseases', () => {
    const result: KnowledgeSearchResult = {
      diseases: [
        {
          id: 'cassava-mosaic',
          cropId: 'cassava',
          name: 'Cassava Mosaic Disease',
          description: 'Viral disease causing mosaic pattern on leaves.',
          symptoms: ['mosaic', 'yellow', 'curling'],
          causes: ['Virus'],
          severity: 'high',
          treatments: ['Remove infected plants', 'Use resistant varieties'],
          prevention: ['Use disease-free cuttings', 'Control whiteflies'],
          aliases: [],
          references: [],
        },
      ],
      deficiencies: [],
      matchedSymptomCount: 2,
      totalKeywordHits: 3,
    };

    const response = builder.buildDiagnosisResponse(result, 'Cassava');
    expect(response.status).toBe('diagnosis');
    if (response.status === 'diagnosis') {
      expect(response.diagnosis.possibleCauses[0].name).toBe('Cassava Mosaic Disease');
      expect(response.diagnosis.recommendations.length).toBeGreaterThan(0);
    }
  });

  it('returns follow_up when no diseases matched', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [],
      matchedSymptomCount: 0,
      totalKeywordHits: 0,
    };

    const response = builder.buildDiagnosisResponse(result);
    expect(response.status).toBe('follow_up');
  });

  it('returns context-aware fallback when symptom details exist but no diseases match', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [],
      matchedSymptomCount: 1,
      totalKeywordHits: 1,
    };

    const response = builder.buildDiagnosisResponse(result, 'Cassava');
    expect(response.status).toBe('follow_up');
    if (response.status === 'follow_up') {
      expect(response.question).toContain('Cassava');
      expect(response.options.length).toBeGreaterThan(0);
    }
  });

  it('fallback omits crop name when crop is not provided', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [],
      matchedSymptomCount: 0,
      totalKeywordHits: 0,
    };

    const response = builder.buildDiagnosisResponse(result);
    expect(response.status).toBe('follow_up');
    if (response.status === 'follow_up') {
      expect(response.question).not.toContain('regarding your');
      expect(response.options!.length).toBeGreaterThan(0);
    }
  });

  it('includes deficiency entries in possible causes', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [
        {
          id: 'nitrogen-deficiency',
          name: 'Nitrogen Deficiency',
          description: 'Yellowing of older leaves due to lack of nitrogen.',
          symptoms: ['yellow', 'stunted'],
          causes: ['Poor soil'],
          treatments: ['Apply nitrogen fertilizer'],
          prevention: ['Use compost'],
          aliases: [],
          affectedCrops: ['maize'],
        },
      ],
      matchedSymptomCount: 1,
      totalKeywordHits: 1,
    };

    const response = builder.buildDiagnosisResponse(result);
    expect(response.status).toBe('diagnosis');
    if (response.status === 'diagnosis') {
      expect(response.diagnosis.possibleCauses[0].name).toBe('Nitrogen Deficiency');
    }
  });
});
