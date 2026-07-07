import type { ConversationDocument } from '@/lib/db/models/conversation.model';
import type { ConversationStage, ConversationStatus, StateResult } from './types';

export class ConversationStateResolver {
  resolve(params: {
    conversation?: ConversationDocument;
    conversationId?: string;
  }): StateResult {
    if (!params.conversationId || !params.conversation) {
      return { status: null, stage: 'NEW', requiresClarification: false };
    }

    const { conversation } = params;

    if (conversation.status === 'COMPLETED') {
      return { status: 'COMPLETED', stage: 'CLOSED', requiresClarification: false };
    }

    if (conversation.status === 'ABANDONED') {
      return { status: null, stage: 'NEW', requiresClarification: false };
    }

    // Inspect messages to determine stage
    const msgs = conversation.messages;
    if (msgs.length === 0) {
      return { status: 'ACTIVE', stage: 'NEW', requiresClarification: false };
    }

    const lastMsg = msgs[msgs.length - 1];

    // ── Last message is assistant ────────────────────────────────
    if (lastMsg.role === 'assistant') {
      if (isFollowUpMessage(lastMsg.content)) {
        // AI asked a follow-up, no user response yet
        return { status: 'ACTIVE', stage: 'AWAITING_CLARIFICATION', requiresClarification: true };
      }

      // AI gave a plain-text response (diagnosis or answer)
      const userMessageCount = msgs.filter((m) => m.role === 'user').length;
      if (userMessageCount <= 1) {
        return { status: 'ACTIVE', stage: 'SHOWING_RESULT', requiresClarification: false };
      }
      return { status: 'ACTIVE', stage: 'FOLLOW_UP', requiresClarification: false };
    }

    // ── Last message is user ─────────────────────────────────────
    const previousAssistant = findLastAssistant(msgs, msgs.length - 2);
    if (previousAssistant && isFollowUpMessage(previousAssistant.content)) {
      // User just answered a clarification question
      return { status: 'ACTIVE', stage: 'COLLECTING_SYMPTOMS', requiresClarification: false };
    }

    // User asked something after a diagnosis or general answer
    return { status: 'ACTIVE', stage: 'FOLLOW_UP', requiresClarification: false };
  }
}

function isFollowUpMessage(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed.status === 'follow_up';
  } catch {
    return false;
  }
}

function findLastAssistant(
  messages: Array<{ role: string; content: string }>,
  startIndex: number,
): { role: string; content: string } | undefined {
  for (let i = startIndex; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      return messages[i];
    }
  }
  return undefined;
}
