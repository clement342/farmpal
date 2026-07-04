import { NextRequest } from 'next/server';
import { handleDiagnosisRequest } from '@/controllers/diagnose.controller';
import { successResponse, errorResponse } from '@/utils/response';
import { parseBody } from '@/utils/http';
import { AppError } from '@/utils/errors';

/**
 * POST /api/diagnose
 *
 * Initiates or continues a crop disease diagnosis conversation.
 *
 * If `conversationId` is omitted a new conversation is created.
 * If provided the existing conversation is resumed with the new message.
 *
 * Body:
 *   { symptoms: string, cropId: string, conversationId?: string, imageUrls?: string[], context?: Record<string, string> }
 *
 * Response:
 *   { success: true, data: { conversationId: string, status: "ACTIVE"|"COMPLETED", response: { status: "follow_up"|"diagnosis", ... } } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const result = await handleDiagnosisRequest(body);
    return successResponse(result, 'Diagnosis request processed');
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse('An unexpected error occurred');
  }
}
