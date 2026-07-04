import { NextRequest } from 'next/server';
import { handleDiagnosisRequest } from '@/controllers/diagnose.controller';
import { successResponse, errorResponse } from '@/utils/response';
import { parseBody } from '@/utils/http';
import { AppError } from '@/utils/errors';

/**
 * POST /api/diagnose
 *
 * Initiates a crop disease diagnosis. If the system needs more
 * information, it returns follow-up questions. Once sufficient
 * information is gathered, it returns the diagnosis.
 *
 * Body:
 *   { symptoms: string, cropId: string, imageUrls?: string[], context?: Record<string, string> }
 *
 * Response:
 *   { success: true, data: { status: "follow_up", question: string, options?: string[] } | { status: "diagnosis", diagnosis: DiagnosisResult } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const response = await handleDiagnosisRequest(body);
    return successResponse(response, 'Diagnosis request processed');
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse('An unexpected error occurred');
  }
}
