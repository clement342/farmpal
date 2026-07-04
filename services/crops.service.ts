import type { Crop } from '@/types';
import { CropRepository } from '@/repositories/crop.repository';
import type { CropDocument } from '@/lib/db/models/crop.model';

/**
 * Crops service.
 *
 * Manages the crop knowledge base. Provides lookup and listing of
 * supported crop types for the diagnosis system.
 *
 * TODO:
 * - Add caching for frequently accessed crop lists
 * - Add crop-specific disease association queries
 * - Add seed data population script
 */

const cropRepository = new CropRepository();

/**
 * Retrieves all supported crops.
 *
 * @returns An array of crop entries
 */
export async function getAllCrops(): Promise<Crop[]> {
  const docs = await cropRepository.findAll();
  return docs.map(mapCropDocument);
}

/**
 * Retrieves a single crop by its ID.
 *
 * @param id - The crop identifier
 * @returns The crop entry, or null if not found
 */
export async function getCropById(id: string): Promise<Crop | null> {
  const doc = await cropRepository.findById(id);
  if (!doc) return null;
  return mapCropDocument(doc);
}

/**
 * Searches crops by name.
 *
 * @param query - The search string
 * @returns Matching crop entries
 */
export async function searchCrops(query: string): Promise<Crop[]> {
  const docs = await cropRepository.searchByName(query);
  return docs.map(mapCropDocument);
}

/**
 * Maps a Mongoose crop document to the shared Crop type.
 */
function mapCropDocument(doc: CropDocument): Crop {
  return {
    id: String(doc._id),
    name: doc.name,
    scientificName: doc.scientificName,
    varieties: doc.varieties,
    regions: doc.regions,
    growthStages: doc.growthStages,
    commonDiseaseIds: doc.commonDiseaseIds,
    imageUrl: doc.imageUrl,
  };
}
