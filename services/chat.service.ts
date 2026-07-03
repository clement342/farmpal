import type { ChatMessage, ChatRequest, ChatResponse } from '@/types';

/**
 * Chat service.
 *
 * Handles conversational interactions between the farmer and the AI.
 * Manages conversation context and delegates inference to the AI layer.
 *
 * TODO:
 * - Implement conversation context management
 * - Integrate with AI inference module
 * - Add conversation persistence
 * - Implement token limits and message trimming
 * - Add rate limiting per conversation
 */

/**
 * Processes a chat request and returns the AI response.
 *
 * @param request - The chat request payload
 * @returns The chat response with the AI's reply
 *
 * TODO: Implement actual chat logic.
 *       - Retrieve or create conversation context
 *       - Call infer() from the AI layer
 *       - Store the new messages
 *       - Generate follow-up suggestions
 */
export async function processChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const { messages } = request;

  // Placeholder: echo the last user message as a confirmation
  // TODO: Replace with actual AI inference
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user');

  const reply: ChatMessage = {
    id: crypto.randomUUID(),
    content: `Received your message. AI response pending implementation. You said: "${lastUserMessage?.content ?? '...'}"`,
    role: 'assistant',
    createdAt: new Date().toISOString(),
  };

  return {
    message: reply,
    suggestions: [
      'Tell me more about the symptoms',
      'Which crop is affected?',
      'When did you first notice this?',
    ],
  };
}
