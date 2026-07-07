import { describe, it, expect } from 'vitest';
import { ConversationDecisionBuilder } from '@/services/conversation/ConversationDecisionBuilder';
import type { ConversationContext, ConversationStage, ConversationIntent, StateResult, IntentClassification } from '@/services/conversation/types';

describe('ConversationDecisionBuilder', () => {
  const builder = new ConversationDecisionBuilder();

  function build(stage: ConversationStage, intent: ConversationIntent, overrides?: Partial<ConversationContext>) {
    const context: ConversationContext = {
      status: 'ACTIVE',
      stage,
      latestUserMessage: 'test message',
      recentMessages: [],
      previousRecommendations: [],
      requiresClarification: false,
      ...overrides,
    };
    const state: StateResult = { status: 'ACTIVE', stage, requiresClarification: false };
    const classification: IntentClassification = { intent, confidence: 0.9, matchedRules: [], reason: 'test' };
    return builder.build(context, state, classification);
  }

  it('NEW + NEW_DIAGNOSIS -> START_DIAGNOSIS', () => {
    const d = build('NEW', 'NEW_DIAGNOSIS');
    expect(d.nextAction).toBe('START_DIAGNOSIS');
  });

  it('AWAITING_CLARIFICATION + CLARIFICATION_RESPONSE -> CONTINUE_DIAGNOSIS', () => {
    const d = build('AWAITING_CLARIFICATION', 'CLARIFICATION_RESPONSE');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('AWAITING_CLARIFICATION + NEW_DIAGNOSIS -> CONTINUE_DIAGNOSIS', () => {
    const d = build('AWAITING_CLARIFICATION', 'NEW_DIAGNOSIS');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('AWAITING_CLARIFICATION + FOLLOW_UP_QUESTION -> CONTINUE_DIAGNOSIS', () => {
    const d = build('AWAITING_CLARIFICATION', 'FOLLOW_UP_QUESTION');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('AWAITING_CLARIFICATION + UNKNOWN -> CONTINUE_DIAGNOSIS', () => {
    const d = build('AWAITING_CLARIFICATION', 'UNKNOWN');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('SHOWING_RESULT + FOLLOW_UP_QUESTION -> ANSWER_FOLLOWUP', () => {
    const d = build('SHOWING_RESULT', 'FOLLOW_UP_QUESTION');
    expect(d.nextAction).toBe('ANSWER_FOLLOWUP');
  });

  it('SHOWING_RESULT + NEW_DIAGNOSIS -> START_DIAGNOSIS', () => {
    const d = build('SHOWING_RESULT', 'NEW_DIAGNOSIS');
    expect(d.nextAction).toBe('START_DIAGNOSIS');
  });

  it('FOLLOW_UP + FOLLOW_UP_QUESTION -> ANSWER_FOLLOWUP', () => {
    const d = build('FOLLOW_UP', 'FOLLOW_UP_QUESTION');
    expect(d.nextAction).toBe('ANSWER_FOLLOWUP');
  });

  it('FOLLOW_UP + NEW_DIAGNOSIS -> START_DIAGNOSIS', () => {
    const d = build('FOLLOW_UP', 'NEW_DIAGNOSIS');
    expect(d.nextAction).toBe('START_DIAGNOSIS');
  });

  it('GENERAL_AGRICULTURE_QUESTION + NEW -> ANSWER_GENERAL_QA', () => {
    const d = build('NEW', 'GENERAL_AGRICULTURE_QUESTION');
    expect(d.nextAction).toBe('ANSWER_GENERAL_QA');
  });

  it('GENERAL_AGRICULTURE_QUESTION + active diagnosis -> CONTINUE_DIAGNOSIS', () => {
    const d = build('FOLLOW_UP', 'GENERAL_AGRICULTURE_QUESTION');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('GENERAL_AGRICULTURE_QUESTION + AWAITING_CLARIFICATION -> CONTINUE_DIAGNOSIS', () => {
    const d = build('AWAITING_CLARIFICATION', 'GENERAL_AGRICULTURE_QUESTION');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('GENERAL_AGRICULTURE_QUESTION + COLLECTING_SYMPTOMS -> CONTINUE_DIAGNOSIS', () => {
    const d = build('COLLECTING_SYMPTOMS', 'GENERAL_AGRICULTURE_QUESTION');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('DIAGNOSIS_CORRECTION -> START_DIAGNOSIS regardless of stage', () => {
    const d = build('FOLLOW_UP', 'DIAGNOSIS_CORRECTION');
    expect(d.nextAction).toBe('START_DIAGNOSIS');
  });

  it('UNKNOWN -> ASK_CLARIFICATION', () => {
    const d = build('NEW', 'UNKNOWN');
    expect(d.nextAction).toBe('ASK_CLARIFICATION');
  });

  it('includes matchedRules, confidence, and reason from classification', () => {
    const context: ConversationContext = {
      status: 'ACTIVE', stage: 'NEW', latestUserMessage: 'test',
      recentMessages: [], previousRecommendations: [], requiresClarification: false,
    };
    const state: StateResult = { status: 'ACTIVE', stage: 'NEW', requiresClarification: false };
    const classification: IntentClassification = {
      intent: 'NEW_DIAGNOSIS', confidence: 0.75,
      matchedRules: ['SYMPTOM_MATCH'], reason: 'found symptoms',
    };
    const d = builder.build(context, state, classification);
    expect(d.matchedRules).toEqual(['SYMPTOM_MATCH']);
    expect(d.confidence).toBe(0.75);
    expect(d.reason).toBe('found symptoms');
  });
});
