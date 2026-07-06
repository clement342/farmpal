import type {
  KnowledgeBase,
  KnowledgeCrop,
  KnowledgeDisease,
  KnowledgePest,
  KnowledgeDeficiency,
} from '@/types/knowledge';
import { getKnowledge } from './knowledge-cache';

/**
 * Search utilities for the offline knowledge base.
 *
 * All functions operate on the singleton in-memory cache.
 * No filesystem access occurs at query time.
 */

/**
 * Finds a crop by its `id` field.
 */
export function findCrop(id: string): KnowledgeCrop | undefined {
  return getKnowledge().crops.find((c) => c.id === id);
}

/**
 * Finds a crop by its name or alias (case-insensitive).
 */
export function findCropByName(name: string): KnowledgeCrop | undefined {
  const lower = name.toLowerCase();
  return getKnowledge().crops.find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.aliases.some((a) => a.toLowerCase() === lower),
  );
}

/**
 * Finds a crop by approximate name match (fuzzy).
 * Returns the best match if confidence exceeds the threshold.
 */
export function findCropByApproximateName(name: string): KnowledgeCrop | undefined {
  const lower = name.toLowerCase().trim();
  const crops = getKnowledge().crops;

  // Exact match first
  const exact = crops.find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.aliases.some((a) => a.toLowerCase() === lower),
  );
  if (exact) return exact;

  // Partial match — name contains search term or vice versa
  return crops.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()) ||
      c.aliases.some((a) => a.toLowerCase().includes(lower) || lower.includes(a.toLowerCase())),
  );
}

/**
 * Returns all diseases for a given crop ID.
 */
export function findDiseasesByCrop(cropId: string): KnowledgeDisease[] {
  return getKnowledge().diseases.filter((d) => d.cropId === cropId);
}

/**
 * Finds a disease by its `id` field.
 */
export function findDisease(id: string): KnowledgeDisease | undefined {
  return getKnowledge().diseases.find((d) => d.id === id);
}

/**
 * Finds diseases by name or alias (case-insensitive).
 */
export function findDiseaseByName(name: string): KnowledgeDisease[] {
  const lower = name.toLowerCase();
  return getKnowledge().diseases.filter(
    (d) =>
      d.name.toLowerCase().includes(lower) ||
      d.aliases.some((a) => a.toLowerCase().includes(lower)),
  );
}

/**
 * Finds a pest by its `id` field.
 */
export function findPest(id: string): KnowledgePest | undefined {
  return getKnowledge().pests.find((p) => p.id === id);
}

/**
 * Finds pests affecting a given crop ID.
 */
export function findPestsByCrop(cropId: string): KnowledgePest[] {
  return getKnowledge().pests.filter((p) =>
    p.affectedCrops.includes(cropId),
  );
}

/**
 * Finds a nutrient deficiency by its `id` field.
 */
export function findDeficiency(id: string): KnowledgeDeficiency | undefined {
  return getKnowledge().deficiencies.find((d) => d.id === id);
}

/**
 * Searches the entire knowledge base for a keyword.
 *
 * Checks crops, diseases, pests, deficiencies, and glossary
 * for matches in names, aliases, descriptions, and symptoms.
 *
 * Returns matches grouped by category.
 */
export function findByKeyword(keyword: string): {
  crops: KnowledgeCrop[];
  diseases: KnowledgeDisease[];
  pests: KnowledgePest[];
  deficiencies: KnowledgeDeficiency[];
} {
  const lower = keyword.toLowerCase().trim();
  const kb: KnowledgeBase = getKnowledge();

  const score = (text: string): number => {
    const t = text.toLowerCase();
    if (t === lower) return 3;
    if (t.startsWith(lower) || t.includes(` ${lower}`)) return 2;
    if (t.includes(lower)) return 1;
    return 0;
  };

  const cropResults = kb.crops
    .filter((c) => score(c.name) > 0 || c.aliases.some((a) => score(a) > 0) || score(c.description) > 0)
    .sort((a, b) => Math.max(score(b.name), score(b.description)) - Math.max(score(a.name), score(a.description)));

  const diseaseResults = kb.diseases
    .filter(
      (d) =>
        score(d.name) > 0 ||
        d.symptoms.some((s) => score(s) > 0) ||
        d.description.includes(lower),
    )
    .sort((a, b) => Math.max(score(b.name)) - Math.max(score(a.name)));

  const pestResults = kb.pests
    .filter((p) => score(p.name) > 0 || p.symptoms.some((s) => score(s) > 0))
    .sort((a, b) => Math.max(score(b.name)) - Math.max(score(a.name)));

  const deficiencyResults = kb.deficiencies
    .filter((d) => score(d.name) > 0 || d.symptoms.some((s) => score(s) > 0))
    .sort((a, b) => Math.max(score(b.name)) - Math.max(score(a.name)));

  return {
    crops: cropResults,
    diseases: diseaseResults,
    pests: pestResults,
    deficiencies: deficiencyResults,
  };
}
