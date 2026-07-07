import type { KnowledgeCrop } from '@/types/knowledge';

const MAX_CANDIDATES = 3;

/**
 * A scored candidate crop from the inference engine.
 */
export interface ScoredCandidate {
  crop: KnowledgeCrop;
  score: number;
}

/**
 * Result of attempting to infer a crop from symptom text.
 */
export interface CropInferenceResult {
  /** Whether a crop was confidently detected */
  detected: boolean;
  /** The detected crop (undefined when not detected) */
  crop?: KnowledgeCrop;
  /** Confidence level of the inference */
  confidence: 'high' | 'medium' | 'low';
  /** Top candidates ranked by score */
  candidates: ScoredCandidate[];
}

/**
 * Infers the most likely crop from symptom text by searching crop names,
 * aliases, and partial matches.
 *
 * @param symptoms - The user's symptom description.
 * @param crops    - All crops from the knowledge base.
 * @returns The inference result with detected crop and confidence.
 */
export function inferCropFromSymptoms(
  symptoms: string,
  crops: KnowledgeCrop[],
): CropInferenceResult {
  const lower = symptoms.toLowerCase().trim();
  if (!lower) {
    return { detected: false, confidence: 'low', candidates: [] };
  }

  const scored: ScoredCandidate[] = [];

  for (const crop of crops) {
    let score = 0;

    // 3 — exact crop name found in text
    if (lower.includes(crop.name.toLowerCase())) {
      score = 3;
    }

    // 2 — alias found in text
    if (score < 3 && crop.aliases.some((a) => lower.includes(a.toLowerCase()))) {
      score = 2;
    }

    // 1 — partial/substring match via first 4 chars of any alias
    if (score < 2) {
      const hasPartial = crop.aliases.some((a) => {
        const aliasLower = a.toLowerCase();
        const prefix = aliasLower.substring(0, 4);
        return prefix.length >= 4 && lower.includes(prefix);
      });
      if (hasPartial) {
        score = 1;
      }
    }

    if (score > 0) {
      scored.push({ crop, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) {
    return { detected: false, confidence: 'low', candidates: [] };
  }

  const topScore = candidates[0].score;
  const isUniqueTop = candidates.length === 1 || candidates[0].score > candidates[1].score;

  if (topScore >= 2 && isUniqueTop) {
    return {
      detected: true,
      crop: candidates[0].crop,
      confidence: 'high',
      candidates,
    };
  }

  if (topScore >= 2) {
    return {
      detected: true,
      crop: candidates[0].crop,
      confidence: 'medium',
      candidates,
    };
  }

  return { detected: false, confidence: 'low', candidates };
}
