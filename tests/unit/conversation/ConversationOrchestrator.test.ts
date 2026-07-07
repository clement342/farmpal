import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationOrchestrator } from '@/services/conversation/ConversationOrchestrator';

const mockFindById = vi.hoisted(() => vi.fn());

vi.mock('@/repositories/conversation.repository', () => {
  return {
    ConversationRepository: class MockConversationRepository {
      findById = mockFindById;
    },
  };
});

vi.mock('@/services/knowledge.service', () => ({
  knowledgeService: {
    search: vi.fn().mockReturnValue({ crops: [], diseases: [], pests: [], deficiencies: [] }),
    getDiseasesForCrop: vi.fn().mockReturnValue([]),
  },
}));

describe('ConversationOrchestrator', () => {
  let orchestrator: ConversationOrchestrator;

  beforeEach(() => {
    orchestrator = new ConversationOrchestrator();
    vi.clearAllMocks();
  });

  it('returns START_DIAGNOSIS for new conversation with symptoms', async () => {
    const { decision, context } = await orchestrator.execute({
      symptoms: 'my cassava leaves are turning yellow',
    });

    expect(decision.nextAction).toBe('START_DIAGNOSIS');
    expect(decision.intent).toBe('NEW_DIAGNOSIS');
    expect(decision.stage).toBe('NEW');
    expect(context.conversationId).toBeUndefined();
    expect(context.stage).toBe('NEW');
  });

  it('returns ASK_CLARIFICATION for unrecognized messages', async () => {
    const { decision } = await orchestrator.execute({
      symptoms: 'hello',
    });

    expect(decision.nextAction).toBe('ASK_CLARIFICATION');
    expect(decision.intent).toBe('UNKNOWN');
    expect(decision.confidence).toBe(0);
  });

  it('returns ANSWER_GENERAL_QA for agriculture questions', async () => {
    const { decision } = await orchestrator.execute({
      symptoms: 'what is crop rotation',
    });

    expect(decision.nextAction).toBe('ANSWER_GENERAL_QA');
    expect(decision.intent).toBe('GENERAL_AGRICULTURE_QUESTION');
  });

  it('returns CONTINUE_DIAGNOSIS when conversation is awaiting clarification', async () => {
    mockFindById.mockResolvedValue({
      _id: 'conv-1',
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: '{"status":"follow_up","question":"What color?"}', createdAt: new Date() },
      ],
    } as any);

    const { decision } = await orchestrator.execute({
      symptoms: 'they are black',
      conversationId: 'conv-1',
    });

    expect(decision.nextAction).toBe('CONTINUE_DIAGNOSIS');
    expect(decision.stage).toBe('AWAITING_CLARIFICATION');
    expect(decision.intent).toBe('CLARIFICATION_RESPONSE');
  });

  it('returns ANSWER_FOLLOWUP for follow-up question after diagnosis', async () => {
    mockFindById.mockResolvedValue({
      _id: 'conv-2',
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'This is cassava mosaic disease.', createdAt: new Date() },
        { role: 'user', content: 'what should I do about this', createdAt: new Date() },
      ],
    } as any);

    const { decision } = await orchestrator.execute({
      symptoms: 'what should I do about this',
      conversationId: 'conv-2',
    });

    expect(decision.nextAction).toBe('ANSWER_FOLLOWUP');
    expect(decision.stage).toBe('FOLLOW_UP');
    expect(decision.intent).toBe('FOLLOW_UP_QUESTION');
  });

  it('loads knowledge context for NEW_DIAGNOSIS intent', async () => {
    const { knowledgeService } = await import('@/services/knowledge.service');

    const { context } = await orchestrator.execute({
      symptoms: 'my cassava leaves are turning yellow',
    });

    expect(knowledgeService.search).toHaveBeenCalled();
    expect(context.knowledgeContext).toBeDefined();
  });
});
