import type { ChatMessage, ChatRequest, ChatResponse } from '@/types';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';

/**
 * Chat service.
 *
 * Handles conversational interactions between the farmer and the AI.
 * Delegates inference to the AI layer via the InferenceRouter, which
 * tries Ollama (local/offline) first and falls back to the cloud
 * provider if Ollama is unavailable.
 */

/**
 * Processes a chat request and returns the AI response.
 *
 * Prepends the FarmPal chat system prompt to the conversation history,
 * then calls `infer()` which routes through the registered providers in
 * priority order (Ollama → cloud).
 *
 * @param request - The validated chat request payload.
 * @returns The assistant's reply wrapped in a ChatResponse.
 * @throws AIServiceError if no AI provider is available.
 */
export async function processChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const messagesWithSystem = buildSystemMessages('chat', request.messages);
  const content = await infer(messagesWithSystem, { task: 'chat' });

  const reply: ChatMessage = {
    id: crypto.randomUUID(),
    content,
    role: 'assistant',
    createdAt: new Date().toISOString(),
  };

  return { message: reply };
}
