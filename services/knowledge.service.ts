import type { KnowledgeBase, KnowledgeCrop, KnowledgeDisease } from '@/types/knowledge';
import { getKnowledge, refreshKnowledge } from '@/lib/knowledge/knowledge-cache';
import {
  findCrop,
  findCropByName,
  findCropByApproximateName,
  findDiseasesByCrop,
  findDisease,
  findDiseaseByName,
  findPest,
  findPestsByCrop,
  findDeficiency,
  findDeficienciesByCrop,
  findRemedies,
  findByKeyword,
} from '@/lib/knowledge/knowledge-search';
import type { KnowledgeRemedy } from '@/types/knowledge';
import { buildKnowledgeContext } from '@/lib/knowledge/knowledge-context';
import { inferCropFromSymptoms } from './crop-inference.service';
import type { CropInferenceResult } from './crop-inference.service';

/**
 * Public API for the Offline Knowledge Engine.
 *
 * Wraps the internal knowledge cache, search utilities, and context
 * builder into a single service that the rest of the application
 * (primarily DiagnosisAIAdapter) can consume.
 *
 * All methods are read-only — knowledge data is static JSON bundled
 * with the application.
 */
export class KnowledgeService {
  /**
   * Returns the full knowledge base metadata.
   */
  getMetadata(): KnowledgeBase['metadata'] {
    return getKnowledge().metadata;
  }

  /**
   * Returns all crops in the knowledge base.
   */
  getAllCrops(): KnowledgeCrop[] {
    return getKnowledge().crops;
  }

  /**
   * Finds a crop by its exact ID.
   */
  getCrop(id: string): KnowledgeCrop | undefined {
    return findCrop(id);
  }

  /**
   * Finds a crop by name or alias (case-insensitive, then fuzzy).
   */
  getCropByName(name: string): KnowledgeCrop | undefined {
    return findCropByName(name) ?? findCropByApproximateName(name);
  }

  /**
   * Returns all diseases known to affect a given crop.
   */
  getDiseasesForCrop(cropId: string): KnowledgeDisease[] {
    return findDiseasesByCrop(cropId);
  }

  /**
   * Finds a disease by its exact ID.
   */
  getDisease(id: string): KnowledgeDisease | undefined {
    return findDisease(id);
  }

  /**
   * Finds diseases by name or alias.
   */
  getDiseaseByName(name: string): KnowledgeDisease[] {
    return findDiseaseByName(name);
  }

  /**
   * Finds pests by ID.
   */
  getPest(id: string) {
    return findPest(id);
  }

  /**
   * Finds pests affecting a crop.
   */
  getPestsForCrop(cropId: string) {
    return findPestsByCrop(cropId);
  }

  /**
   * Finds a nutrient deficiency by ID.
   */
  getDeficiency(id: string) {
    return findDeficiency(id);
  }

  /**
   * Returns all nutrient deficiencies known to affect a given crop.
   */
  getDeficienciesForCrop(cropId: string) {
    return findDeficienciesByCrop(cropId);
  }

  /**
   * Searches all knowledge for a keyword.
   */
  search(keyword: string) {
    return findByKeyword(keyword);
  }

  /**
   * Searches remedies by multiple keywords.
   */
  getRemedies(keywords: string[]): KnowledgeRemedy[] {
    return findRemedies(keywords);
  }

  /**
   * Infers the most likely crop from symptom text.
   *
   * @param symptoms - The user's symptom description.
   * @returns Inference result with detected crop and confidence.
   */
  inferCrop(symptoms: string): CropInferenceResult {
    return inferCropFromSymptoms(symptoms, this.getAllCrops());
  }

  /**
   * Builds a formatted context block for AI prompt injection.
   *
   * This is the primary method used by DiagnosisAIAdapter to enrich
   * the system prompt with relevant agricultural knowledge before
   * invoking the AI model.
   *
   * @param cropId   - The ID of the crop being diagnosed.
   * @param symptoms - Optional symptom description for keyword matching.
   * @returns A formatted string of relevant knowledge, or empty string.
   */
  buildContext(cropId?: string, symptoms?: string): string {
    return buildKnowledgeContext(cropId, symptoms);
  }

  /**
   * Forces a reload of the knowledge base from disk.
   */
  reload(): void {
    refreshKnowledge();
  }
}

/** Singleton instance */
export const knowledgeService = new KnowledgeService();
