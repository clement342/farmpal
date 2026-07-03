import { NextRequest } from 'next/server';
import { handleChatMessage } from '@/controllers/chat.controller';
import { successResponse, errorResponse } from '@/utils/response';
import { parseBody } from '@/utils/http';
import { AppError } from '@/utils/errors';

/**
 * POST /api/chat
 *
 * Sends a chat message to the AI assistant and receives a response.
 * Expects a JSON body with a messages array.
 *
 * Body:
 *   { messages: ChatMessage[], cropContext?: { cropId: string, cropName: string } }
 *
 * Response:
 *   { success: true, data: { message: ChatMessage, suggestions?: string[] } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseBody(request);
    const response = await handleChatMessage(body);
    return successResponse(response, 'Message processed successfully');
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.statusCode);
    }
    return errorResponse('An unexpected error occurred');
  }
}
