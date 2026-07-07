import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentClassifier } from '@/services/conversation/IntentClassifier';
import type { ConversationContext } from '@/services/conversation/types';

vi.mock('@/services/knowledge.service', () => ({
  knowledgeService: {
    search: vi.fn(),
  },
}));

function makeContext(overrides: Partial<ConversationContext>): ConversationContext {
  return {
    status: 'ACTIVE',
    stage: 'FOLLOW_UP',
    latestUserMessage: '',
    recentMessages: [],
    previousRecommendations: [],
    requiresClarification: false,
    ...overrides,
  };
}

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;

  beforeEach(async () => {
    const { knowledgeService } = await import('@/services/knowledge.service');
    vi.mocked(knowledgeService.search).mockReturnValue({
      crops: [],
      diseases: [],
      pests: [],
      deficiencies: [],
    });
    classifier = new IntentClassifier();
  });

  it('detects FOLLOW_UP_QUESTION for question starting with "what" and existing diagnosis', () => {
    const ctx = makeContext({
      stage: 'FOLLOW_UP',
      latestUserMessage: 'what should I do about this',
      recentMessages: [
        { id: '1', role: 'user', content: 'my cassava has spots', createdAt: '' },
        { id: '2', role: 'assistant', content: 'diagnosis result', createdAt: '' },
      ],
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('FOLLOW_UP_QUESTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.matchedRules).toContain('QUESTION_START');
  });

  it('detects DIAGNOSIS_CORRECTION for correction markers', () => {
    const ctx = makeContext({
      latestUserMessage: 'actually the crop is rice',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('DIAGNOSIS_CORRECTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.matchedRules).toContain('CORRECTION_MARKER');
  });

  it('detects NEW_DIAGNOSIS for symptom keywords', () => {
    const ctx = makeContext({
      stage: 'NEW',
      latestUserMessage: 'my cassava leaves are turning yellow',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('NEW_DIAGNOSIS');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.matchedRules).toContain('SYMPTOM_MATCH');
  });

  it('detects GENERAL_AGRICULTURE_QUESTION for ag keywords', () => {
    const ctx = makeContext({
      latestUserMessage: 'what is crop rotation',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('GENERAL_AGRICULTURE_QUESTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects CLARIFICATION_RESPONSE for short message when awaiting clarification', () => {
    const ctx = makeContext({
      stage: 'AWAITING_CLARIFICATION',
      requiresClarification: true,
      latestUserMessage: 'they are black',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('CLARIFICATION_RESPONSE');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns UNKNOWN when no rules match and no knowledge match', () => {
    const ctx = makeContext({
      stage: 'NEW',
      latestUserMessage: 'hello world',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('UNKNOWN');
    expect(result.confidence).toBe(0);
  });

  it('uses knowledge lookup for symptom-like content in unknown context', async () => {
    const { knowledgeService } = await import('@/services/knowledge.service');
    vi.mocked(knowledgeService.search).mockReturnValue({
      crops: [],
      diseases: [{ id: 'cassava-mosaic', name: 'Cassava Mosaic Disease', symptoms: ['yellow leaves'] }],
      pests: [],
      deficiencies: [],
    });

    const ctx = makeContext({
      stage: 'NEW',
      latestUserMessage: 'my cassava has yellow leaves and stunted growth',
    });

    const result = classifier.classify(ctx);
    // Should still be NEW_DIAGNOSIS from Phase 1 (SYMPTOM_MATCH), but Phase 2
    // knowledge search gives it a higher confidence
    expect(result.intent).toBe('NEW_DIAGNOSIS');
    expect(knowledgeService.search).toHaveBeenCalled();
  });

  it('prefers GENERAL_AGRICULTURE_QUESTION when no symptoms match knowledge', () => {
    const ctx = makeContext({
      latestUserMessage: 'what is the best fertilizer for tomatoes',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('GENERAL_AGRICULTURE_QUESTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
