import { NextRequest } from 'next/server';
import { handleGetAllCrops, handleGetCropById } from '@/controllers/crops.controller';
import { successResponse, errorResponse } from '@/utils/response';
import { getQueryParam } from '@/utils/http';
import { AppError } from '@/utils/errors';

/**
 * GET /api/crops
 *
 * Retrieves all supported crop types.
 *
 * Query params:
 *   id?: string — Get a single crop by ID
 *
 * Response:
 *   { success: true, data: Crop[] | Crop }
 */
export async function GET(request: NextRequest) {
  try {
    const id = getQueryParam(request, 'id');

    if (id) {
      const crop = await handleGetCropById(id);
      return successResponse(crop);
    }

    const crops = await handleGetAllCrops();
    return successResponse(crops);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse('An unexpected error occurred');
  }
}
