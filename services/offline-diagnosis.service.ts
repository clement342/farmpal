/**
 * Offline Diagnosis Service.
 *
 * Produces a `DiagnosisResponse` purely from the static JSON knowledge base
 * when every AI provider is unavailable. No network calls are made.
 *
 * ## Matching algorithm
 *
 * 1. If a `cropId` is given, fetch all diseases for that crop from the KB.
 *    Otherwise search the full KB by symptom keywords.
 * 2. Score each candidate disease by counting how many of its known symptom
 *    strings overlap with the farmer's symptom text (case-insensitive).
 * 3. Return the top match as a `diagnosis` response, or fall back to a
 *    generic `follow_up` question when no match scores above zero.
 *
 * ## Output format
 *
 * The returned `DiagnosisResponse` is structurally identical to what
 * `DiagnosisAIAdapter` returns — the same `possibleCauses`, `recommendations`,
 * `urgency`, and `reasoning` fields — so `diagnose.service.ts` can persist
 * it with the same `CreateDiagnosisData` block used for AI results.
 *
 * @module
 */

import type { DiagnosisRequest, DiagnosisResponse, DiagnosisResult, PossibleCause, Recommendation } from '@/types/diagnosis';
import type { KnowledgeDisease } from '@/types/knowledge';
import { knowledgeService } from './knowledge.service';

/** Provider label written to the `aiProvider` column in MongoDB. */
export const OFFLINE_PROVIDER_NAME = 'offline-kb';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates a diagnosis from the offline knowledge base.
 *
 * @param request - The original diagnosis request (symptoms + optional cropId).
 * @returns A fully-formed DiagnosisResponse — either a matched diagnosis or a
 *          follow-up question when no knowledge-base entry matches.
 */
export function generateOfflineDiagnosis(request: DiagnosisRequest): DiagnosisResponse {
  const candidates = getCandidateDiseases(request.cropId, request.symptoms);

  if (candidates.length === 0) {
    // No KB data for this crop at all — ask the farmer for more detail
    return {
      status: 'follow_up',
      question: buildFallbackQuestion(request.cropId),
      options: [
        'Yellowing or wilting leaves',
        'Spots or lesions on leaves',
        'Holes in leaves',
        'Rotting stems or roots',
        'Stunted growth',
      ],
    };
  }

  const scored = scoreAndRank(candidates, request.symptoms);
  const top = scored[0];

  // If the best match scored zero keyword hits, ask for clarification
  if (top.score === 0) {
    return {
      status: 'follow_up',
      question: buildClarifyingQuestion(candidates),
      options: candidates.slice(0, 5).map((d) => d.name),
    };
  }

  const response = buildDiagnosisResponse(scored, request);
  return response;
}

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

/**
 * Returns the disease candidates to score.
 *
 * If a cropId is given, returns diseases registered for that crop.
 * Otherwise falls back to a keyword search across the full KB.
 */
function getCandidateDiseases(cropId?: string, symptoms?: string): KnowledgeDisease[] {
  if (cropId) {
    const byCrop = knowledgeService.getDiseasesForCrop(cropId);
    if (byCrop.length > 0) return byCrop;
  }

  // No cropId or crop has no diseases — search by symptom keywords
  if (symptoms) {
    const words = extractKeywords(symptoms);
    const found = new Map<string, KnowledgeDisease>();
    for (const word of words) {
      const { diseases } = knowledgeService.search(word);
      for (const r of diseases) {
        found.set(r.id, r);
      }
    }
    return Array.from(found.values());
  }

  return [];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface ScoredDisease {
  disease: KnowledgeDisease;
  score: number;
}

/**
 * Scores each disease by counting symptom keyword overlaps.
 * Returns list sorted by score descending.
 */
function scoreAndRank(diseases: KnowledgeDisease[], symptoms: string): ScoredDisease[] {
  const symptomsLower = symptoms.toLowerCase();
  const words = extractKeywords(symptoms);

  const scored = diseases.map((disease) => {
    let score = 0;

    // Each known symptom string that appears in the farmer's description scores 2
    for (const knownSymptom of disease.symptoms) {
      const kLower = knownSymptom.toLowerCase();
      // Check if any keyword from the farmer's text appears in this symptom
      for (const word of words) {
        if (kLower.includes(word)) {
          score += 2;
          break;
        }
      }
    }

    // Aliases and name appearing in symptoms score 3 (strong signal)
    const nameTokens = [disease.name.toLowerCase(), ...disease.aliases.map((a) => a.toLowerCase())];
    for (const token of nameTokens) {
      if (symptomsLower.includes(token)) {
        score += 3;
      }
    }

    return { disease, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Response building
// ---------------------------------------------------------------------------

function buildDiagnosisResponse(
  scored: ScoredDisease[],
  request: DiagnosisRequest,
): DiagnosisResponse {
  const possibleCauses = buildPossibleCauses(scored);
  const top = scored[0].disease;

  const diagnosis: DiagnosisResult = {
    possibleCauses,
    reasoning: buildReasoning(top, request.symptoms),
    recommendations: buildRecommendations(top),
    urgency: top.severity, // severity and urgency share the same enum values
    extensionOfficerAdvice:
      'If symptoms persist or worsen after applying the recommended actions, ' +
      'consult your local agricultural extension officer within 7 days.',
  };

  return { status: 'diagnosis', diagnosis };
}

function buildPossibleCauses(scored: ScoredDisease[]): PossibleCause[] {
  const maxScore = Math.max(scored[0].score, 1); // avoid division by zero

  // Return up to 3 candidates; normalise confidence against the top score
  return scored.slice(0, 3).map(({ disease, score }, index) => ({
    name: disease.name,
    // Top match gets 0.65–0.80, lower matches scale proportionally
    confidence: parseFloat(((score / maxScore) * (index === 0 ? 0.75 : 0.5)).toFixed(2)),
    reasoning: disease.description,
  }));
}

function buildRecommendations(disease: KnowledgeDisease): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const treatment of disease.treatments) {
    recommendations.push({ text: treatment, category: 'immediate_action' });
  }

  for (const prevention of disease.prevention) {
    recommendations.push({ text: prevention, category: 'preventive' });
  }

  recommendations.push({
    text: 'Contact an agricultural extension officer if symptoms persist beyond 7 days.',
    category: 'consultation',
  });

  return recommendations;
}

function buildReasoning(disease: KnowledgeDisease, symptoms: string): string {
  const symptomSummary = disease.symptoms.slice(0, 3).join('; ');
  const causeSummary = disease.causes.slice(0, 2).join(' and ');

  return (
    `Based on the reported symptoms ("${symptoms}"), the most likely cause is ` +
    `${disease.name}. ` +
    `Known indicators include: ${symptomSummary}. ` +
    `Common causes: ${causeSummary}. ` +
    `This diagnosis was produced from the offline knowledge base.`
  );
}

// ---------------------------------------------------------------------------
// Fallback questions
// ---------------------------------------------------------------------------

function buildFallbackQuestion(cropId?: string): string {
  if (cropId) {
    const crop = knowledgeService.getCrop(cropId);
    if (crop) {
      return `Could you describe the symptoms in more detail? Which part of the ${crop.name} plant is affected?`;
    }
  }
  return 'Could you describe the symptoms in more detail? Which part of the plant is affected and when did you first notice the problem?';
}

function buildClarifyingQuestion(candidates: KnowledgeDisease[]): string {
  const names = candidates.slice(0, 3).map((d) => d.name).join(', ');
  return `Based on your crop, the most common issues are: ${names}. Which of the following best describes the symptoms you are seeing?`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts meaningful keywords from a symptom string.
 * Strips stop words and returns lowercase tokens of 4+ characters.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'and', 'are', 'have', 'with', 'that', 'this', 'from', 'they',
    'been', 'some', 'also', 'more', 'very', 'just', 'will', 'then', 'them',
    'what', 'when', 'which', 'your', 'crop', 'plant', 'leaves', 'leaf',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));
}
