import { NextRequest } from 'next/server';
import { handleStreamDiagnosis } from '@/controllers/diagnose.controller';
import { parseBody } from '@/utils/http';
import { AppError } from '@/utils/errors';

export const runtime = 'nodejs';

/**
 * POST /api/diagnose/stream
 *
 * Initiates or continues a crop disease diagnosis with a streaming response.
 *
 * Returns SSE events:
 *   data: { "type": "chunk", "text": "..." }
 *   data: { "type": "result", "conversationId": "...", "status": "...", "response": { ... } }
 *   data: { "type": "error", "message": "..." }
 *
 * Body: same as POST /api/diagnose
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[stream:route] request received');
    const body = await parseBody(request);
    if (!body) {
      return new Response('Invalid JSON body', { status: 400 });
    }

    console.log('[stream:route] calling handleStreamDiagnosis');
    const stream = await handleStreamDiagnosis(body);
    console.log('[stream:route] stream created — returning SSE response');

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[stream:route] UNHANDLED ERROR:', error);
    console.error('[stream:route] stack:', error instanceof Error ? error.stack : String(error));

    if (error instanceof AppError) {
      return new Response(
        `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`,
        {
          status: error.statusCode,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      );
    }
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'An unexpected error occurred' })}\n\n`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/event-stream' },
      },
    );
  }
}
