import type { DiagnosisRequest, DiagnosisResponse } from '@/types';
import { createDiagnosis } from '@/services/diagnose.service';
import { validateDiagnosisRequest, validateCropExists } from '@/lib/validation';
import { AIServiceError } from '@/utils/errors';

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
 * Initiates a crop disease diagnosis.
 *
 * @param body - The raw request body containing symptoms and crop info
 * @returns A diagnosis response with either a follow-up question or a completed diagnosis
 * @throws AIServiceError if the AI service is unavailable
 */
export async function handleDiagnosisRequest(
  body: unknown,
): Promise<DiagnosisResponse> {
  // Validate request structure
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  // Verify the referenced crop exists in the database
  await validateCropExists(request.cropId);

  // TODO: Add logging for incoming diagnosis requests
  // TODO: Add request tracing / correlation ID

  // Delegate to service
  const response = await createDiagnosis(request);

  // TODO: Emit telemetry event

  return response;
}
