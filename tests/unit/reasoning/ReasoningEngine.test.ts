import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSearch, mockGetDiseasesForCrop, mockGetDeficienciesForCrop, mockInferCrop } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockGetDiseasesForCrop: vi.fn(),
  mockGetDeficienciesForCrop: vi.fn(),
  mockInferCrop: vi.fn(),
}));

vi.mock('@/services/knowledge.service', () => ({
  knowledgeService: {
    search: mockSearch,
    getDiseasesForCrop: mockGetDiseasesForCrop,
    getDeficienciesForCrop: mockGetDeficienciesForCrop,
    inferCrop: mockInferCrop,
  },
}));

vi.mock('@/lib/ai', () => ({
  infer: vi.fn(),
}));

vi.mock('@/lib/ai/prompts', () => ({
  buildSystemMessages: vi.fn((_task, messages, _extraContext) => messages),
}));

vi.mock('@/lib/ai/parsers/diagnosis-response.parser', () => ({
  parseDiagnosisResponse: vi.fn(),
}));

vi.mock('@/adapters/diagnosis/mapper', () => ({
  mapToDiagnosisResponse: vi.fn(),
}));

import { ReasoningEngine } from '@/services/reasoning/ReasoningEngine';

describe('ReasoningEngine', () => {
  let engine: ReasoningEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDeficienciesForCrop.mockReturnValue([]);
    mockInferCrop.mockReturnValue({ detected: false, crop: undefined, confidence: 'low' as const, candidates: [] });
    engine = new ReasoningEngine({ threshold: 0.7 });
  });

  it('answers from knowledge when confidence is high', async () => {
    mockGetDiseasesForCrop.mockReturnValue([
      {
        id: 'cassava-mosaic',
        cropId: 'cassava',
        name: 'Cassava Mosaic Disease',
        description: 'Viral disease causing mosaic pattern on leaves.',
        symptoms: ['mosaic pattern on leaves', 'yellow leaves'],
        causes: ['Virus'],
        severity: 'high',
        treatments: ['Remove infected plants', 'Use resistant varieties'],
        prevention: ['Use disease-free cuttings', 'Control whiteflies'],
        aliases: [],
        references: [],
      },
    ]);
    mockSearch.mockReturnValue({
      crops: [],
      diseases: [],
      pests: [],
      deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'mosaic yellow leaves', cropId: 'cassava' },
    });

    expect(response.status).toBe('diagnosis');
  });

  it('falls back to AI when confidence is low', async () => {
    const { infer } = await import('@/lib/ai');
    vi.mocked(infer).mockResolvedValue(JSON.stringify({
      status: 'follow_up',
      question: 'Can you describe the spots?',
      options: ['Round', 'Angular'],
    }));

    mockGetDiseasesForCrop.mockReturnValue([]);
    mockSearch.mockReturnValue({
      crops: [],
      diseases: [],
      pests: [],
      deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'something wrong with my plant', cropId: 'cassava' },
    });

    expect(response.status).toBe('follow_up');
    expect(infer).toHaveBeenCalledOnce();
  });

  it('returns knowledge response when AI fails', async () => {
    const { infer } = await import('@/lib/ai');
    vi.mocked(infer).mockRejectedValue(new Error('AI unavailable'));

    mockGetDiseasesForCrop.mockReturnValue([
      {
        id: 'cassava-mosaic',
        cropId: 'cassava',
        name: 'Cassava Mosaic Disease',
        description: 'Viral disease.',
        symptoms: ['mosaic', 'yellow'],
        causes: ['Virus'],
        severity: 'high',
        treatments: ['Remove infected plants'],
        prevention: ['Use resistant varieties'],
        aliases: [],
        references: [],
      },
    ]);
    mockSearch.mockReturnValue({
      crops: [],
      diseases: [],
      pests: [],
      deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'mosaic yellow leaves', cropId: 'cassava' },
    });

    expect(response.status).toBe('diagnosis');
    if (response.status === 'diagnosis') {
      expect(response.diagnosis.possibleCauses[0].name).toBe('Cassava Mosaic Disease');
    }
  });

  it('matches diseases by keyword in name/description/symptoms, not full-text containment', async () => {
    const rootRotDisease = {
      id: 'cassava-root-rot',
      cropId: 'cassava',
      name: 'Cassava Root Rot',
      description: 'Fungal disease causing root decay in cassava.',
      symptoms: ['Roots showing brown water-soaked lesions', 'Soft foul-smelling decay of roots'],
      causes: ['Fungi'],
      severity: 'high',
      treatments: ['Improve drainage', 'Remove infected plants'],
      prevention: ['Use raised beds', 'Crop rotation'],
      aliases: [],
      references: [],
    };

    mockGetDiseasesForCrop.mockReturnValue([rootRotDisease]);

    // mockSearch returns empty for each keyword — the disease should
    // still match via keyword extraction (name contains "rot")
    mockSearch.mockReturnValue({
      crops: [], diseases: [], pests: [], deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'it rotting and producing some liquid substance', cropId: 'cassava' },
      crop: { id: 'cassava', name: 'Cassava', regions: ['West Africa'], growthStages: [], commonDiseaseIds: [] },
    });

    expect(response.status).toBe('follow_up');
    if (response.status === 'follow_up') {
      expect(response.question).toContain('Cassava');
    }
  });

  it('returns context-aware fallback with options when AI fails and keywords match', async () => {
    const { infer } = await import('@/lib/ai');
    vi.mocked(infer).mockRejectedValue(new Error('AI unavailable'));

    mockGetDiseasesForCrop.mockReturnValue([]);
    mockSearch.mockReturnValue({
      crops: [], diseases: [], pests: [], deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'my cassava root is rotting and producing liquid', cropId: 'cassava' },
      crop: { id: 'cassava', name: 'Cassava', regions: ['West Africa'], growthStages: [], commonDiseaseIds: [] },
    });

    expect(response.status).toBe('follow_up');
    if (response.status === 'follow_up') {
      expect(response.question).toContain('Cassava');
      expect(response.options).toBeDefined();
      expect(response.options!.length).toBeGreaterThan(0);
    }
  });

  it('returns follow_up from knowledge when nothing matches and AI fails', async () => {
    const { infer } = await import('@/lib/ai');
    vi.mocked(infer).mockRejectedValue(new Error('AI unavailable'));

    mockGetDiseasesForCrop.mockReturnValue([]);
    mockSearch.mockReturnValue({
      crops: [], diseases: [], pests: [], deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'weird growth on stem' },
    });

    expect(response.status).toBe('follow_up');
  });
});
