import type { DiagnosisRequest, ConversationDiagnosisResponse } from '@/types';
import { createDiagnosis, streamDiagnosis } from '@/services/diagnose.service';
import { validateDiagnosisRequest, validateCropExists } from '@/lib/validation';
import { knowledgeService } from '@/services/knowledge.service';

/**
 * Diagnosis controller.
 *
 * Handles incoming diagnosis requests. Validates the input,
 * verifies the crop exists (if provided or auto-detected), and
 * delegates to the diagnosis service.
 *
 * Controllers remain thin — no business logic, no database access,
 * no AI calls.
 */

/**
 * Initiates or continues a crop disease diagnosis (non-streaming).
 *
 * @param body - The raw request body containing symptoms, crop info, and optional conversationId
 * @returns A conversation-aware diagnosis response
 */
export async function handleDiagnosisRequest(
  body: unknown,
): Promise<ConversationDiagnosisResponse> {
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  if (!request.cropId) {
    const inference = knowledgeService.inferCrop(request.symptoms);
    if (inference.detected && inference.crop) {
      request.cropId = inference.crop.id;
    }
  }

  if (request.cropId) {
    await validateCropExists(request.cropId);
  }

  return createDiagnosis(request);
}

/**
 * Initiates or continues a crop disease diagnosis with streaming.
 *
 * Returns a `ReadableStream` that the route handler should return
 * as the HTTP response with `Content-Type: text/event-stream`.
 *
 * @param body - The raw request body
 * @returns A ReadableStream of SSE events
 */
export async function handleStreamDiagnosis(
  body: unknown,
): Promise<ReadableStream<Uint8Array>> {
  console.log('[stream:controller] validating request');
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  let detectedCropInfo: { cropId: string; cropName: string; confidence: string } | undefined;

  if (!request.cropId) {
    console.log('[stream:controller] no cropId — running inferCrop');
    const inference = knowledgeService.inferCrop(request.symptoms);
    if (inference.detected && inference.crop) {
      request.cropId = inference.crop.id;
      detectedCropInfo = {
        cropId: inference.crop.id,
        cropName: inference.crop.name,
        confidence: inference.confidence,
      };
      console.log('[stream:controller] inferCrop detected:', detectedCropInfo);
    } else {
      console.log('[stream:controller] inferCrop: no crop detected');
    }
  }

  if (request.cropId) {
    console.log('[stream:controller] validating crop exists:', request.cropId);
    await validateCropExists(request.cropId);
    console.log('[stream:controller] crop validated');
  }

  console.log('[stream:controller] calling streamDiagnosis');
  const stream = await streamDiagnosis(request);
  console.log('[stream:controller] streamDiagnosis returned ReadableStream');

  if (detectedCropInfo) {
    return prependCropDetectedEvent(stream, detectedCropInfo);
  }

  return stream;
}

function prependCropDetectedEvent(
  original: ReadableStream<Uint8Array>,
  info: { cropId: string; cropName: string; confidence: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let headerSent = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const event = `data: ${JSON.stringify({ type: 'crop_detected', ...info })}\n\n`;
      controller.enqueue(encoder.encode(event));
      headerSent = true;

      const reader = original.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.close();
    },
  });
}
