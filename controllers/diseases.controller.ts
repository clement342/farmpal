import type { Disease } from '@/types';
import { getAllDiseases, getDiseaseById, getDiseasesByCrop } from '@/services/diseases.service';
import { NotFoundError } from '@/utils/errors';

/**
 * Diseases controller.
 *
 * Handles requests for disease data. Delegates to the diseases service
 * for all data access and business logic.
 */

/**
 * Retrieves all known diseases.
 *
 * @returns An array of disease entries
 */
export async function handleGetAllDiseases(): Promise<Disease[]> {
  // TODO: Add caching headers / ETag support
  // TODO: Add logging

  return getAllDiseases();
}

/**
 * Retrieves diseases associated with a specific crop.
 *
 * @param cropId - The crop identifier
 * @returns An array of disease entries for that crop
 */
export async function handleGetDiseasesByCrop(cropId: string): Promise<Disease[]> {
  // TODO: Validate cropId exists
  // TODO: Add logging

  return getDiseasesByCrop(cropId);
}

/**
 * Retrieves a single disease by its ID.
 *
 * @param id - The disease identifier
 * @returns The disease entry
 * @throws NotFoundError if the disease does not exist
 */
export async function handleGetDiseaseById(id: string): Promise<Disease> {
  const disease = await getDiseaseById(id);

  if (!disease) {
    throw new NotFoundError('Disease');
  }

  return disease;
}
