import type { ChatMessage } from '@/types';

export function createUserMessage(content: string): ChatMessage {
  return {
    id: 'test-msg-1',
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createAssistantMessage(content: string): ChatMessage {
  return {
    id: 'test-msg-2',
    role: 'assistant',
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createFollowUpMessage(question: string): ChatMessage {
  return {
    id: 'test-msg-3',
    role: 'assistant',
    content: JSON.stringify({
      status: 'follow_up',
      question,
      options: ['Option A', 'Option B'],
    }),
    createdAt: new Date().toISOString(),
  };
}
