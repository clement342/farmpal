import type { ChatRequest, ChatResponse } from '@/types';
import { processChatMessage } from '@/services/chat.service';
import { validateChatRequest } from '@/lib/validation';

export async function handleChatMessage(body: unknown): Promise<ChatResponse> {
  const request: ChatRequest = validateChatRequest(body);
  return processChatMessage(request);
}
