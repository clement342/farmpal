import type { Disease } from '@/types';
import { DiseaseRepository } from '@/repositories/disease.repository';
import type { DiseaseDocument } from '@/lib/db/models/disease.model';

/**
 * Diseases service.
 *
 * Manages the disease knowledge base. Provides lookup and listing of
 * known crop diseases with their symptoms, treatments, and prevention
 * information.
 *
 * TODO:
 * - Add caching for frequently accessed disease lists
 * - Add region-specific disease filtering
 * - Add seed data population script
 */

const diseaseRepository = new DiseaseRepository();

/**
 * Retrieves all known diseases.
 *
 * @returns An array of disease entries
 */
export async function getAllDiseases(): Promise<Disease[]> {
  const docs = await diseaseRepository.findAll();
  return docs.map(mapDiseaseDocument);
}

/**
 * Retrieves diseases associated with a specific crop.
 *
 * @param cropId - The crop identifier
 * @returns An array of diseases common to that crop
 */
export async function getDiseasesByCrop(cropId: string): Promise<Disease[]> {
  const docs = await diseaseRepository.findByCrop(cropId);
  return docs.map(mapDiseaseDocument);
}

/**
 * Retrieves a single disease by its ID.
 *
 * @param id - The disease identifier
 * @returns The disease entry, or null if not found
 */
export async function getDiseaseById(id: string): Promise<Disease | null> {
  const doc = await diseaseRepository.findById(id);
  if (!doc) return null;
  return mapDiseaseDocument(doc);
}

/**
 * Maps a Mongoose disease document to the shared Disease type.
 */
function mapDiseaseDocument(doc: DiseaseDocument): Disease {
  return {
    id: String(doc._id),
    name: doc.name,
    scientificName: doc.scientificName,
    affectedCrops: doc.affectedCrops,
    symptoms: doc.symptoms,
    causes: doc.causes,
    severity: doc.severity,
    treatments: doc.treatments,
    prevention: doc.prevention,
    regions: doc.regions,
    imageUrl: doc.imageUrl,
  };
}
