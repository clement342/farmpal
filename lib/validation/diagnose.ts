import type { DiagnosisRequest } from '@/types';
import { ValidationError } from '@/utils/errors';
import { CropRepository } from '@/repositories/crop.repository';
import { knowledgeService } from '@/services/knowledge.service';

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

  // cropId is optional — only validate format if provided
  if (request.cropId && typeof request.cropId !== 'string') {
    throw new ValidationError('Crop ID must be a string');
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
 * Checks both MongoDB (seeded crops) and the offline knowledge base
 * so that crops added as static JSON are immediately available for
 * diagnosis without a database seed step.
 *
 * @param cropId - The crop identifier to verify
 * @throws ValidationError if the crop does not exist in either source
 */
export async function validateCropExists(cropId?: string): Promise<void> {
  if (!cropId) return;
  const dbCrop = await cropRepository.findById(cropId);
  if (dbCrop) return;

  const kbCrop = knowledgeService.getCrop(cropId);
  if (kbCrop) return;

  throw new ValidationError(`Crop with ID "${cropId}" not found`);
}
