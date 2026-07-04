/**
 * Diagnosis response mapper.
 *
 * Converts the intermediate parsed output from `lib/ai/parsers/diagnosis.parser`
 * into the application's canonical `DiagnosisResponse` type.
 *
 * This is the ONLY module that bridges the AI provider's output format
 * and the application's domain types. If the AI provider changes its
 * output schema, only this file needs updating.
 *
 * @module
 */

import type { DiagnosisResponse, DiagnosisResult, PossibleCause, Recommendation, UrgencyLevel } from '@/types';
import type { ParsedDiagnosisResponse, RawDiagnosisSub, RawPossibleCause, RawRecommendation } from '@/lib/ai/parsers/diagnosis-response.parser';

/**
 * Maps a parsed AI response to the application's DiagnosisResponse type.
 *
 * Includes defensive fallbacks for every field — the AI may omit anything,
 * and this layer ensures the client always receives a well-formed response.
 *
 * @param parsed - The validated output from the diagnosis parser.
 * @returns A fully-formed DiagnosisResponse.
 */
export function mapToDiagnosisResponse(parsed: ParsedDiagnosisResponse): DiagnosisResponse {
  if (parsed.status === 'follow_up') {
    return {
      status: 'follow_up',
      question: parsed.question ?? 'Could you describe the symptoms in more detail?',
      options: parsed.options,
    };
  }

  return {
    status: 'diagnosis',
    diagnosis: buildDiagnosisResult(parsed.diagnosis),
  };
}

/**
 * Builds a DiagnosisResult from the raw diagnosis sub-object.
 */
function buildDiagnosisResult(raw: ParsedDiagnosisResponse['diagnosis']): DiagnosisResult {
  const possibleCauses = buildPossibleCauses(raw?.possibleCauses);
  const recommendations = buildRecommendations(raw?.recommendations);

  return {
    possibleCauses,
    reasoning: raw?.reasoning ?? 'No reasoning provided.',
    recommendations,
    urgency: validateUrgency(raw?.urgency),
    extensionOfficerAdvice:
      raw?.extensionOfficerAdvice ??
      'Consult your local agricultural extension officer if symptoms worsen.',
  };
}

/**
 * Maps and validates the possible-causes array.
 */
function buildPossibleCauses(raw?: RawDiagnosisSub['possibleCauses']): PossibleCause[] {
  if (!raw || raw.length === 0) {
    return [
      {
        name: 'Unknown',
        confidence: 0,
        reasoning: 'Could not determine possible causes from the information provided.',
      },
    ];
  }

  return raw.map((c: RawPossibleCause) => ({
    name: c.name ?? 'Unknown condition',
    confidence: typeof c.confidence === 'number' ? Math.max(0, Math.min(1, c.confidence)) : 0,
    reasoning: c.reasoning ?? '',
  }));
}

/**
 * Maps and validates the recommendations array.
 */
function buildRecommendations(raw?: RawDiagnosisSub['recommendations']): Recommendation[] {
  if (!raw || raw.length === 0) {
    return [
      {
        text: 'Monitor the affected plants and consult an expert if symptoms persist',
        category: 'consultation',
      },
    ];
  }

  return raw.map((r: RawRecommendation) => ({
    text: r.text ?? 'No specific recommendation available.',
    category: isValidCategory(r.category) ? r.category : 'immediate_action',
  }));
}

/**
 * Validates that a category string is one of the allowed values.
 */
function isValidCategory(c?: string): c is 'immediate_action' | 'preventive' | 'consultation' {
  return c === 'immediate_action' || c === 'preventive' || c === 'consultation';
}

/**
 * Validates and normalises the urgency level.
 */
function validateUrgency(u?: string): UrgencyLevel {
  if (u === 'low' || u === 'moderate' || u === 'high' || u === 'critical') {
    return u;
  }
  return 'moderate';
}
