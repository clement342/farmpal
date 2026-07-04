import type { DiagnosisRequest } from '@/types';
import { ValidationError } from '@/utils/errors';
import { CropRepository } from '@/repositories/crop.repository';

const cropRepository = new CropRepository();

/**
 * Validates a diagnosis request payload.
 *
 * @param data - The incoming request body
 * @returns The validated payload
 * @throws ValidationError if validation fails
 */
export function validateDiagnosisRequest(data: unknown): DiagnosisRequest {
  const request = data as DiagnosisRequest | null;

  if (!request) {
    throw new ValidationError('Request body is required');
  }

  if (!request.symptoms || request.symptoms.trim().length === 0) {
    throw new ValidationError('Symptoms description is required');
  }

  if (request.symptoms.trim().length > 2000) {
    throw new ValidationError('Symptoms description must not exceed 2000 characters');
  }

  if (!request.cropId || request.cropId.trim().length === 0) {
    throw new ValidationError('Crop ID is required');
  }

  // Validate image URLs if provided
  if (request.imageUrls) {
    if (!Array.isArray(request.imageUrls)) {
      throw new ValidationError('Image URLs must be an array');
    }
    for (const url of request.imageUrls) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        throw new ValidationError('Each image URL must be a valid HTTP URL');
      }
    }
  }

  // TODO: Move async validation to the controller to keep validators synchronous
  //       if this becomes a pattern. For now, the async crop check is inline.

  return request;
}

/**
 * Validates that the cropId corresponds to an existing crop.
 *
 * Separated from the main validator so the controller can call it
 * without requiring database access in purely synchronous validation.
 *
 * @param cropId - The crop identifier to verify
 * @throws NotFoundError if the crop does not exist
 */
export async function validateCropExists(cropId: string): Promise<void> {
  const crop = await cropRepository.findById(cropId);
  if (!crop) {
    throw new ValidationError(`Crop with ID "${cropId}" not found`);
  }
}
