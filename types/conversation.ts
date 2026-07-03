import type { ChatMessage } from './chat';

/**
 * A complete conversation session between the farmer and the AI.
 */
export interface Conversation {
  /** Unique conversation identifier */
  id: string;
  /** All messages in the conversation */
  messages: ChatMessage[];
  /** The crop being discussed (if identified) */
  cropId?: string;
  /** Whether a diagnosis was reached */
  resolved: boolean;
  /** Reference to the resulting diagnosis (if any) */
  diagnosisId?: string;
  /** ISO 8601 timestamp */
  startedAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
}
