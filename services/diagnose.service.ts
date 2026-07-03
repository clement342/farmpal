import type { Diagnosis, DiagnosisRequest, DiagnosisResponse } from '@/types';

/**
 * Diagnosis service.
 *
 * Orchestrates the crop disease diagnosis pipeline. Collects symptoms,
 * runs them through the AI clarification loop, and returns structured
 * diagnosis results with confidence scoring.
 *
 * TODO:
 * - Implement the clarification loop (AI asks follow-up questions)
 * - Integrate with AI inference for diagnosis generation
 * - Add confidence calculation logic
 * - Implement severity assessment heuristics
 * - Add crop-specific knowledge base queries
 * - Store completed diagnoses in the database
 */

/**
 * Initiates the diagnosis pipeline for the given symptoms.
 *
 * If the system needs more information to reach a confident diagnosis,
 * it returns follow-up questions instead of a diagnosis.
 *
 * @param request - The diagnosis request payload
 * @returns A diagnosis response (either questions or a final diagnosis)
 *
 * TODO: Implement the full diagnosis pipeline.
 *       - Check if sufficient information is available
 *       - If not, return follow-up questions
 *       - If yes, generate and return the diagnosis
 */
export async function createDiagnosis(
  request: DiagnosisRequest,
): Promise<DiagnosisResponse> {
  // Placeholder: always ask for more information
  // TODO: Replace with actual AI-driven triage

  return {
    requiresClarification: true,
    followUpQuestions: [
      'Which part of the plant is affected?',
      'When did you first notice the symptoms?',
      'Are other plants in the area affected?',
      'Have you applied any treatments?',
    ],
  };
}

/**
 * Retrieves a single diagnosis by its ID.
 *
 * @param id - The diagnosis identifier
 * @returns The diagnosis record, or null if not found
 *
 * TODO: Implement database lookup.
 */
export async function getDiagnosisById(id: string): Promise<Diagnosis | null> {
  // TODO: Query diagnosis from the database
  void id;
  return null;
}
