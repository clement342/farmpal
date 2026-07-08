import type { DiagnosisRequest } from '@/types';
import { ConversationRepository } from '@/repositories/conversation.repository';
import type { ConversationStatus, LoaderResult } from './types';

export class ConversationContextLoader {
  private conversationRepository = new ConversationRepository();

  async load(request: DiagnosisRequest): Promise<LoaderResult> {
    if (!request.conversationId) {
      return { status: null };
    }

    const conversation = await this.conversationRepository.findById(request.conversationId);
    if (!conversation) {
      return { status: null, conversationId: request.conversationId };
    }

    return {
      conversation,
      conversationId: request.conversationId,
      status: conversation.status as ConversationStatus,
    };
  }
}
