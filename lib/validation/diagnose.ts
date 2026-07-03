import type { DiagnosisRequest } from '@/types';
import { ValidationError } from '@/utils/errors';

/**
 * Validates a diagnosis request payload.
 *
 * @param data - The incoming request body
 * @returns The validated payload
 * @throws ValidationError if validation fails
 *
 * TODO: Implement full validation with Zod or similar schema validator.
 *       This is a placeholder that checks basic presence of required fields.
 */
export function validateDiagnosisRequest(data: unknown): DiagnosisRequest {
  const request = data as DiagnosisRequest | null;

  if (!request) {
    throw new ValidationError('Request body is required');
  }

  if (!request.symptoms || request.symptoms.trim().length === 0) {
    throw new ValidationError('Symptoms description is required');
  }

  if (!request.cropId || request.cropId.trim().length === 0) {
    throw new ValidationError('Crop ID is required');
  }

  // TODO: Validate symptom length limits
  // TODO: Validate image URLs if provided
  // TODO: Validate cropId exists in the database
  // TODO: Sanitize input text

  return request;
}
