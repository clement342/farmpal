import type { DiagnosisRequest, DiagnosisResponse } from '@/types';
import { createDiagnosis } from '@/services/diagnose.service';
import { validateDiagnosisRequest } from '@/lib/validation';
import { AIServiceError } from '@/utils/errors';

/**
 * Diagnosis controller.
 *
 * Handles incoming diagnosis requests. Validates the input,
 * initiates the diagnosis pipeline, and returns the structured
 * response (either follow-up questions or a completed diagnosis).
 */

/**
 * Initiates a crop disease diagnosis.
 *
 * @param body - The raw request body containing symptoms and crop info
 * @returns A diagnosis response with either questions or results
 * @throws AIServiceError if the AI service is unavailable
 */
export async function handleDiagnosisRequest(
  body: unknown,
): Promise<DiagnosisResponse> {
  // Validate input
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  // TODO: Add logging for incoming diagnosis requests
  // TODO: Add request tracing / correlation ID

  // Delegate to service
  const response = await createDiagnosis(request);

  // TODO: Persist conversation state for clarification loop
  // TODO: Emit telemetry event

  return response;
}
