import { describe, it, expect } from 'vitest';
import { ConversationStateResolver } from '@/services/conversation/ConversationStateResolver';
import type { ConversationDocument } from '@/lib/db/models/conversation.model';

describe('ConversationStateResolver', () => {
  const resolver = new ConversationStateResolver();

  it('returns NEW for no conversationId', () => {
    const result = resolver.resolve({ conversationId: undefined });
    expect(result.status).toBeNull();
    expect(result.stage).toBe('NEW');
    expect(result.requiresClarification).toBe(false);
  });

  it('returns AWAITING_CLARIFICATION when last message is follow_up JSON with no user response', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: '{"status":"follow_up","question":"What color?"}', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('AWAITING_CLARIFICATION');
    expect(result.requiresClarification).toBe(true);
  });

  it('returns AWAITING_CLARIFICATION when last message is a plain-text follow_up question', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'What specific symptoms are you seeing on the leaves?', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('AWAITING_CLARIFICATION');
    expect(result.requiresClarification).toBe(true);
  });

  it('does not flag long assistant responses as follow_up even when they start with What', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'What you are describing sounds like cassava mosaic disease. ' + 'x'.repeat(501), createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.stage).toBe('SHOWING_RESULT');
  });

  it('returns SHOWING_RESULT when last assistant response is plain text diagnosis', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'Based on the symptoms, this is likely cassava mosaic disease.', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('SHOWING_RESULT');
    expect(result.requiresClarification).toBe(false);
  });

  it('returns FOLLOW_UP after a diagnosis then a user follow-up', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'This is cassava mosaic disease.', createdAt: new Date() },
        { role: 'user', content: 'what fertilizer should I use', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('FOLLOW_UP');
    expect(result.requiresClarification).toBe(false);
  });

  it('returns FOLLOW_UP after follow-up answered and another user question', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'This is cassava mosaic disease.', createdAt: new Date() },
        { role: 'user', content: 'what fertilizer should I use', createdAt: new Date() },
        { role: 'assistant', content: 'Use NPK 15-15-15', createdAt: new Date() },
        { role: 'user', content: 'how much per hectare', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('FOLLOW_UP');
  });

  it('returns CLOSED for completed conversations', () => {
    const conversation = {
      status: 'COMPLETED',
      messages: [],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('COMPLETED');
    expect(result.stage).toBe('CLOSED');
  });

  it('returns NEW for abandoned conversations (fresh start)', () => {
    const conversation = {
      status: 'ABANDONED',
      messages: [],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBeNull();
    expect(result.stage).toBe('NEW');
  });

  it('detects AWAITING_CLARIFICATION correctly when follow_up has been answered', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: '{"status":"follow_up","question":"What color?"}', createdAt: new Date() },
        { role: 'user', content: 'they are brown', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('COLLECTING_SYMPTOMS');
    expect(result.requiresClarification).toBe(false);
  });
});
