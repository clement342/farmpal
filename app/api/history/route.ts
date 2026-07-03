import { NextRequest } from 'next/server';
import { handleGetHistory, handleSaveHistory } from '@/controllers/history.controller';
import { successResponse, errorResponse } from '@/utils/response';
import { parseBody, getPaginationParams } from '@/utils/http';
import { AppError } from '@/utils/errors';

/**
 * GET /api/history
 *
 * Retrieves paginated consultation history.
 *
 * Query params:
 *   page?: number (default: 1)
 *   limit?: number (default: 20)
 *   cropName?: string
 *   dateFrom?: string (ISO 8601)
 *   dateTo?: string (ISO 8601)
 *   sortBy?: 'createdAt' | 'updatedAt'
 *   sortOrder?: 'asc' | 'desc'
 *
 * Response:
 *   { success: true, data: HistoryRecord[], page: number, limit: number, total: number, totalPages: number }
 */
export async function GET(request: NextRequest) {
  try {
    const pagination = getPaginationParams(request);
    const query = {
      ...pagination,
      cropName: request.nextUrl.searchParams.get('cropName'),
      dateFrom: request.nextUrl.searchParams.get('dateFrom'),
      dateTo: request.nextUrl.searchParams.get('dateTo'),
      sortBy: request.nextUrl.searchParams.get('sortBy'),
      sortOrder: request.nextUrl.searchParams.get('sortOrder'),
    };

    const { records, total } = await handleGetHistory(query);
    return successResponse(
      { records, total, ...pagination },
      'History retrieved successfully',
    );
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse('An unexpected error occurred');
  }
}

/**
 * POST /api/history
 *
 * Saves a new history record after a completed diagnosis.
 *
 * Body:
 *   Omit<HistoryRecord, 'id'>
 *
 * Response:
 *   { success: true, data: HistoryRecord }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const record = await handleSaveHistory(body);
    return successResponse(record, 'History record saved', 201);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse('An unexpected error occurred');
  }
}
