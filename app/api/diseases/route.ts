import { NextRequest } from 'next/server';
import { handleGetAllDiseases, handleGetDiseaseById, handleGetDiseasesByCrop } from '@/controllers/diseases.controller';
import { successResponse, errorResponse } from '@/utils/response';
import { getQueryParam } from '@/utils/http';
import { AppError } from '@/utils/errors';

/**
 * GET /api/diseases
 *
 * Retrieves disease information from the knowledge base.
 *
 * Query params:
 *   id?: string — Get a single disease by ID
 *   cropId?: string — Filter diseases by crop
 *   (if neither is provided, returns all diseases)
 *
 * Response:
 *   { success: true, data: Disease[] | Disease }
 */
export async function GET(request: NextRequest) {
  try {
    const id = getQueryParam(request, 'id');
    const cropId = getQueryParam(request, 'cropId');

    if (id) {
      const disease = await handleGetDiseaseById(id);
      return successResponse(disease);
    }

    if (cropId) {
      const diseases = await handleGetDiseasesByCrop(cropId);
      return successResponse(diseases);
    }

    const diseases = await handleGetAllDiseases();
    return successResponse(diseases);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse('An unexpected error occurred');
  }
}
