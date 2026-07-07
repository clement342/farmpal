import { describe, it, expect, vi } from 'vitest';
import { ConversationContextLoader } from '@/services/conversation/ConversationContextLoader';

const mockFindById = vi.hoisted(() => vi.fn());

vi.mock('@/repositories/conversation.repository', () => {
  return {
    ConversationRepository: class MockConversationRepository {
      findById = mockFindById;
    },
  };
});

describe('ConversationContextLoader', () => {
  it('loads existing conversation when conversationId is provided', async () => {
    const fakeConversation = {
      _id: 'abc123',
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
      ],
    };
    mockFindById.mockResolvedValue(fakeConversation);
    const loader = new ConversationContextLoader();
    const result = await loader.load({ symptoms: 'test', conversationId: 'abc' });

    expect(result.conversationId).toBe('abc');
    expect(result.status).toBe('ACTIVE');
    expect(result.conversation).toBeDefined();
  });

  it('returns null status when no conversationId provided', async () => {
    const loader = new ConversationContextLoader();
    const result = await loader.load({ symptoms: 'test' });

    expect(result.conversationId).toBeUndefined();
    expect(result.status).toBeNull();
    expect(result.conversation).toBeUndefined();
  });

  it('returns null status when conversation not found', async () => {
    mockFindById.mockResolvedValue(null);

    const loader = new ConversationContextLoader();
    const result = await loader.load({ symptoms: 'test', conversationId: 'nonexistent' });

    expect(result.conversationId).toBe('nonexistent');
    expect(result.status).toBeNull();
    expect(result.conversation).toBeUndefined();
  });
});
