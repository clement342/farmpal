import type { ConversationContext, ConversationDecision, ConversationIntent, ConversationStage, IntentClassification, NextAction, StateResult } from './types';

const ACTION_MAP: Record<string, NextAction> = {
  'NEW|NEW_DIAGNOSIS': 'START_DIAGNOSIS',
  'COLLECTING_SYMPTOMS|CLARIFICATION_RESPONSE': 'CONTINUE_DIAGNOSIS',
  'COLLECTING_SYMPTOMS|NEW_DIAGNOSIS': 'CONTINUE_DIAGNOSIS',
  'AWAITING_CLARIFICATION|CLARIFICATION_RESPONSE': 'CONTINUE_DIAGNOSIS',
  'AWAITING_CLARIFICATION|NEW_DIAGNOSIS': 'CONTINUE_DIAGNOSIS',
  'AWAITING_CLARIFICATION|FOLLOW_UP_QUESTION': 'CONTINUE_DIAGNOSIS',
  'AWAITING_CLARIFICATION|UNKNOWN': 'CONTINUE_DIAGNOSIS',
  'SHOWING_RESULT|FOLLOW_UP_QUESTION': 'ANSWER_FOLLOWUP',
  'SHOWING_RESULT|NEW_DIAGNOSIS': 'START_DIAGNOSIS',
  'FOLLOW_UP|FOLLOW_UP_QUESTION': 'ANSWER_FOLLOWUP',
  'FOLLOW_UP|NEW_DIAGNOSIS': 'START_DIAGNOSIS',
};

export class ConversationDecisionBuilder {
  build(
    context: ConversationContext,
    state: StateResult,
    classification: IntentClassification,
  ): ConversationDecision {
    const { intent } = classification;
    const stage = state.stage;

    let nextAction: NextAction;

    // Stage-independent intents
    if (intent === 'GENERAL_AGRICULTURE_QUESTION') {
      nextAction = 'ANSWER_GENERAL_QA';
    } else if (intent === 'DIAGNOSIS_CORRECTION') {
      nextAction = 'START_DIAGNOSIS';
    } else {
      const key = `${stage}|${intent}`;
      nextAction = ACTION_MAP[key] ?? 'ASK_CLARIFICATION';
    }

    return {
      status: state.status,
      stage,
      intent,
      confidence: classification.confidence,
      nextAction,
      matchedRules: classification.matchedRules,
      reason: classification.reason,
    };
  }
}
