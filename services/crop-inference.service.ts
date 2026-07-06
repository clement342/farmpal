import type { KnowledgeCrop } from '@/types/knowledge';

export interface ScoredCandidate {
  crop: KnowledgeCrop;
  score: number;
}

export interface CropInferenceResult {
  detected: boolean;
  crop?: KnowledgeCrop;
  confidence: 'high' | 'medium' | 'low';
  candidates: ScoredCandidate[];
}

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
        const minLen = Math.min(4, aliasLower.length);
        return aliasLower.substring(0, minLen).length >= 4 &&
          lower.includes(aliasLower.substring(0, minLen));
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
  const candidates = scored.slice(0, 3);

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
