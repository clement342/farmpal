import type { HistoryQuery, HistoryRecord } from '@/types';
import { getHistory, getHistoryById, saveHistoryRecord } from '@/services/history.service';
import { validateHistoryQuery } from '@/lib/validation';
import { NotFoundError } from '@/utils/errors';

/**
 * History controller.
 *
 * Handles history CRUD operations. Manages retrieval of past
 * consultations and persistence of new diagnosis records.
 */

/**
 * Retrieves paginated consultation history.
 *
 * @param query - Filter and pagination parameters
 * @returns An object with records array and total count
 */
export async function handleGetHistory(
  query: Record<string, unknown>,
): Promise<{ records: HistoryRecord[]; total: number }> {
  const validatedQuery: HistoryQuery = validateHistoryQuery(query);

  // TODO: Add user-scoped filtering
  // TODO: Add logging

  return getHistory(validatedQuery);
}

/**
 * Retrieves a single history record by ID.
 *
 * @param id - The record identifier
 * @returns The history record
 * @throws NotFoundError if the record does not exist
 */
export async function handleGetHistoryById(id: string): Promise<HistoryRecord> {
  const record = await getHistoryById(id);

  if (!record) {
    throw new NotFoundError('History record');
  }

  return record;
}

/**
 * Saves a new history record.
 *
 * @param body - The history record data
 * @returns The persisted record
 */
export async function handleSaveHistory(
  body: unknown,
): Promise<HistoryRecord> {
  // TODO: Validate the history record payload
  const record = body as Omit<HistoryRecord, 'id'>;

  // TODO: Add logging
  // TODO: Add data sanitization

  return saveHistoryRecord(record);
}
