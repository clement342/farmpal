import type { Crop } from '@/types';
import { getAllCrops, getCropById } from '@/services/crops.service';
import { NotFoundError } from '@/utils/errors';

/**
 * Crops controller.
 *
 * Handles requests for crop data. Delegates to the crops service
 * for all data access and business logic.
 */

/**
 * Retrieves all supported crops.
 *
 * @returns An array of crop entries
 */
export async function handleGetAllCrops(): Promise<Crop[]> {
  // TODO: Add caching headers / ETag support
  // TODO: Add logging

  return getAllCrops();
}

/**
 * Retrieves a single crop by its ID.
 *
 * @param id - The crop identifier
 * @returns The crop entry
 * @throws NotFoundError if the crop does not exist
 */
export async function handleGetCropById(id: string): Promise<Crop> {
  const crop = await getCropById(id);

  if (!crop) {
    throw new NotFoundError('Crop');
  }

  return crop;
}
