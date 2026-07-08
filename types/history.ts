import type { ChatMessage } from './chat';
import type { Diagnosis } from './diagnosis';

/**
 * A record of a past consultation stored in history.
 */
export interface HistoryRecord {
  /** Unique record identifier */
  id: string;
  /** The conversation that led to this record */
  conversation: {
    id: string;
    messages: ChatMessage[];
  };
  /** The resulting diagnosis (if reached) */
  diagnosis?: Diagnosis;
  /** Crop involved */
  cropName: string;
  /** Crop identifier (when known) */
  cropId?: string;
  /** Initial symptoms described */
  initialSymptoms: string;
  /** Whether the farmer found this helpful */
  rated?: boolean;
  /** Rating 1–5 */
  rating?: number;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
}

/**
 * Query parameters for fetching history.
 */
export interface HistoryQuery {
  page?: number;
  limit?: number;
  cropName?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}
