import type { Crop } from '@/types';
import { getAllCrops, getCropById } from '@/services/crops.service';
import { NotFoundError } from '@/utils/errors';
import { knowledgeService } from '@/services/knowledge.service';

/**
 * Crops controller.
 *
 * Handles requests for crop data. Delegates to the crops service
 * for all data access and business logic.
 */

/**
 * Retrieves all supported crops.
 *
 * First tries MongoDB via the crops service. If the database is
 * empty (fresh setup / not seeded), falls back to the offline
 * knowledge base so the dropdown never shows "No crops available".
 *
 * @returns An array of crop entries
 */
export async function handleGetAllCrops(): Promise<Crop[]> {
  const dbCrops = await getAllCrops();

  if (dbCrops.length > 0) {
    return dbCrops;
  }

  return knowledgeService.getAllCrops().map((kc) => ({
    id: kc.id,
    name: kc.name,
    scientificName: kc.scientificName,
    regions: kc.growingRegions,
    growthStages: kc.growthStages,
    commonDiseaseIds: kc.commonDiseaseIds,
  }));
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
