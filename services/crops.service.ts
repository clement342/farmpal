import type { Crop } from '@/types';

/**
 * Crops service.
 *
 * Manages the crop knowledge base. Provides lookup and listing of
 * supported crop types for the diagnosis system.
 *
 * TODO:
 * - Implement database queries for crop CRUD
 * - Add crop search by name or region
 * - Cache crop list for frequently accessed data
 * - Add crop-specific disease associations
 */

/**
 * Retrieves all supported crops.
 *
 * @returns An array of crop entries
 *
 * TODO: Query crops from the database.
 *       Consider adding caching for this read-heavy endpoint.
 */
export async function getAllCrops(): Promise<Crop[]> {
  // TODO: Fetch crops from the database
  return [];
}

/**
 * Retrieves a single crop by its ID.
 *
 * @param id - The crop identifier
 * @returns The crop entry, or null if not found
 *
 * TODO: Implement database lookup.
 */
export async function getCropById(id: string): Promise<Crop | null> {
  // TODO: Query crop from the database
  void id;
  return null;
}

/**
 * Searches crops by name.
 *
 * @param query - The search string
 * @returns Matching crop entries
 *
 * TODO: Implement case-insensitive search.
 */
export async function searchCrops(query: string): Promise<Crop[]> {
  // TODO: Search crops by name in the database
  void query;
  return [];
}
