import type { HistoryRecord } from '@/types';

/**
 * Fetches paginated diagnosis history.
 */
export async function fetchHistory(params?: {
  page?: number;
  limit?: number;
}): Promise<{ records: HistoryRecord[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const url = `/api/history${searchParams.toString() ? `?${searchParams}` : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch history (${response.status})`);
  }

  const json = await response.json();
  return json.data as { records: HistoryRecord[]; total: number };
}
