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

  console.log('[inferCrop] input:', JSON.stringify(symptoms));

  if (!lower) {
    console.log('[inferCrop] empty input — returning not detected');
    return { detected: false, confidence: 'low', candidates: [] };
  }

  const scored: ScoredCandidate[] = [];

  for (const crop of crops) {
    let score = 0;
    let matchReason = '';

    // 3 — exact crop name found in text
    if (lower.includes(crop.name.toLowerCase())) {
      score = 3;
      matchReason = `name match ("${crop.name.toLowerCase()}")`;
    }

    // 2 — alias found in text
    if (score < 3) {
      const matchedAlias = crop.aliases.find((a) => lower.includes(a.toLowerCase()));
      if (matchedAlias) {
        score = 2;
        matchReason = `alias match ("${matchedAlias}")`;
      }
    }

    // 1 — partial/substring match via first 4 chars of any alias
    if (score < 2) {
      const matchedPartial = crop.aliases.find((a) => {
        const aliasLower = a.toLowerCase();
        const prefix = aliasLower.substring(0, 4);
        return prefix.length >= 4 && lower.includes(prefix);
      });
      if (matchedPartial) {
        score = 1;
        matchReason = `partial alias match ("${matchedPartial.substring(0, 4)}..." from "${matchedPartial}")`;
      }
    }

    if (score > 0) {
      console.log(`[inferCrop]   crop="${crop.id}" score=${score} reason=${matchReason}`);
      scored.push({ crop, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, MAX_CANDIDATES);

  console.log('[inferCrop] all candidates:', candidates.map((c) => `${c.crop.id}=${c.score}`).join(', ') || '(none)');

  if (candidates.length === 0) {
    console.log('[inferCrop] result: not detected');
    return { detected: false, confidence: 'low', candidates: [] };
  }

  const topScore = candidates[0].score;
  const isUniqueTop = candidates.length === 1 || candidates[0].score > candidates[1].score;

  console.log(`[inferCrop] top: "${candidates[0].crop.id}" score=${topScore} unique=${isUniqueTop}`);

  if (topScore >= 2 && isUniqueTop) {
    console.log(`[inferCrop] result: detected "${candidates[0].crop.id}" confidence=high`);
    return {
      detected: true,
      crop: candidates[0].crop,
      confidence: 'high',
      candidates,
    };
  }

  if (topScore >= 2) {
    console.log(`[inferCrop] result: detected "${candidates[0].crop.id}" confidence=medium`);
    return {
      detected: true,
      crop: candidates[0].crop,
      confidence: 'medium',
      candidates,
    };
  }

  console.log(`[inferCrop] result: not detected (top score ${topScore} < 2)`);
  return { detected: false, confidence: 'low', candidates };
}
