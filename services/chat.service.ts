import type { ChatRequest, ChatResponse } from '@/types';
import { reasoningEngine } from '@/services/reasoning/ReasoningEngine';

export async function processChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  return reasoningEngine.answerGeneralQuestion({
    messages: request.messages,
    cropContext: request.cropContext,
  });
}
