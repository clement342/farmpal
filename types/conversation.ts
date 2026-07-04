import type { ChatMessage } from './chat';

/**
 * Possible states of a conversation session.
 */
export type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

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
  /** Human-readable crop name */
  cropName?: string;
  /** Current status of the conversation */
  status: ConversationStatus;
  /** Reference to the resulting diagnosis (if any) */
  diagnosisId?: string;
  /** ISO 8601 timestamp */
  startedAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
}
