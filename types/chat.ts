/**
 * Represents a single message in a chat conversation.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** The message content */
  content: string;
  /** Who sent the message */
  role: 'user' | 'assistant' | 'system';
  /** ISO 8601 timestamp */
  createdAt: string;
}

/**
 * Request payload for the chat endpoint.
 */
export interface ChatRequest {
  /** The conversation history */
  messages: ChatMessage[];
  /** Optional context about the crop being discussed */
  cropContext?: {
    cropId: string;
    cropName: string;
  };
}

/**
 * Response from the chat endpoint.
 */
export interface ChatResponse {
  /** The assistant's reply */
  message: ChatMessage;
  /** Suggested follow-up questions */
  suggestions?: string[];
}
