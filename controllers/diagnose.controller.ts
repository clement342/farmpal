import type { DiagnosisRequest, ConversationDiagnosisResponse } from '@/types';
import { createDiagnosis, streamDiagnosis } from '@/services/diagnose.service';
import { validateDiagnosisRequest, validateCropExists } from '@/lib/validation';

/**
 * Diagnosis controller.
 *
 * Handles incoming diagnosis requests. Validates the input,
 * verifies the crop exists, and delegates to the diagnosis service.
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

  await validateCropExists(request.cropId);

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
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  await validateCropExists(request.cropId);

  return streamDiagnosis(request);
}
