import type { HistoryQuery } from '@/types';
import { ValidationError } from '@/utils/errors';

/**
 * Validates history query parameters.
 *
 * @param data - The query parameters object
 * @returns The validated query
 *
 * TODO: Implement full validation with Zod or similar schema validator.
 *       This is a placeholder with basic sanitization.
 */
export function validateHistoryQuery(data: Record<string, unknown>): HistoryQuery {
  const query: HistoryQuery = {};

  if (data.page !== undefined) {
    const page = Number(data.page);
    if (isNaN(page) || page < 1) {
      throw new ValidationError('Page must be a positive integer');
    }
    query.page = page;
  }

  if (data.limit !== undefined) {
    const limit = Number(data.limit);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }
    query.limit = limit;
  }

  if (data.cropName && typeof data.cropName === 'string') {
    query.cropName = data.cropName.trim();
  }

  // TODO: Validate date formats
  // TODO: Validate sortBy and sortOrder values

  return query;
}
