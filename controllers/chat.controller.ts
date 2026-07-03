import type { ChatRequest, ChatResponse } from '@/types';
import { processChatMessage } from '@/services/chat.service';
import { validateChatRequest } from '@/lib/validation';
import { AIServiceError } from '@/utils/errors';

/**
 * Chat controller.
 *
 * Handles incoming chat requests. Validates the input, delegates
 * processing to the chat service, and returns the formatted response.
 *
 * All business logic lives in the service layer — this controller
 * only orchestrates the flow and handles errors.
 */

/**
 * Handles a chat message from the farmer.
 *
 * @param body - The raw request body
 * @returns The chat response
 * @throws AIServiceError if the AI service is unavailable
 */
export async function handleChatMessage(body: unknown): Promise<ChatResponse> {
  // Validate input
  const request: ChatRequest = validateChatRequest(body);

  // TODO: Add logging for incoming chat requests
  // TODO: Add request tracing / correlation ID

  // Delegate to service
  const response = await processChatMessage(request);

  // TODO: Store conversation context
  // TODO: Emit telemetry event

  return response;
}
