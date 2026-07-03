import type { ChatRequest } from '@/types';
import { ValidationError } from '@/utils/errors';

/**
 * Validates a chat request payload.
 *
 * @param data - The incoming request body
 * @returns The validated payload
 * @throws ValidationError if validation fails
 *
 * TODO: Implement full validation with Zod or similar schema validator.
 *       This is a placeholder that checks basic presence of required fields.
 */
export function validateChatRequest(data: unknown): ChatRequest {
  const request = data as ChatRequest | null;

  if (!request) {
    throw new ValidationError('Request body is required');
  }

  if (!Array.isArray(request.messages) || request.messages.length === 0) {
    throw new ValidationError('At least one message is required');
  }

  // TODO: Validate each message structure
  // TODO: Validate message content length limits
  // TODO: Sanitize message content

  return request;
}
