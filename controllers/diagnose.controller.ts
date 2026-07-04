import type { DiagnosisRequest, ConversationDiagnosisResponse } from '@/types';
import { createDiagnosis } from '@/services/diagnose.service';
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
 * Initiates or continues a crop disease diagnosis.
 *
 * @param body - The raw request body containing symptoms, crop info, and optional conversationId
 * @returns A conversation-aware diagnosis response
 * @throws NotFoundError if the referenced conversation does not exist
 */
export async function handleDiagnosisRequest(
  body: unknown,
): Promise<ConversationDiagnosisResponse> {
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  await validateCropExists(request.cropId);

  return createDiagnosis(request);
}
