import type { Diagnosis, DiagnosisRequest, DiagnosisResponse } from '@/types';
import { DiagnosisRepository, type CreateDiagnosisData } from '@/repositories/diagnosis.repository';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';

/**
 * Diagnosis service.
 *
 * Orchestrates the crop disease diagnosis pipeline. Collects symptoms,
 * runs them through the AI clarification loop, and returns structured
 * diagnosis results with confidence scoring.
 *
 * This service depends on the DiagnosisRepository for persistence and
 * will eventually depend on the AI provider layer for inference.
 *
 * TODO:
 * - Integrate with AI inference for the clarification loop
 * - Implement confidence calculation
 * - Implement severity assessment heuristics
 * - Add crop-specific knowledge base queries
 */

const diagnosisRepository = new DiagnosisRepository();

/**
 * Initiates the diagnosis pipeline for the given symptoms.
 *
 * If the system needs more information to reach a confident diagnosis,
 * it returns follow-up questions instead of a diagnosis.
 *
 * @param request - The diagnosis request payload
 * @returns A diagnosis response (either questions or a final diagnosis)
 */
export async function createDiagnosis(
  request: DiagnosisRequest,
): Promise<DiagnosisResponse> {
  // TODO:
  // 1. Retrieve crop details from CropRepository for context
  // 2. Call AI provider (inference layer) to triage the symptoms
  // 3. If AI needs more information, return followUpQuestions
  // 4. If AI can diagnose, construct the Diagnosis and persist via repository
  //
  // Example flow:
  //   const crop = await cropRepository.findById(request.cropId);
  //   const prompt = buildDiagnosisPrompt(request.symptoms, crop);
  //   const aiResponse = await infer(prompt);
  //   if (aiResponse.needsClarification) { return { requiresClarification: true, followUpQuestions }; }
  //   const data: CreateDiagnosisData = { ... };
  //   const diagnosis = await diagnosisRepository.create(data);

  void diagnosisRepository;

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
 */
export async function getDiagnosisById(id: string): Promise<Diagnosis | null> {
  const doc = await diagnosisRepository.findById(id);
  if (!doc) return null;

  return mapDiagnosisDocument(doc);
}

/**
 * Maps a Mongoose lean document to the shared Diagnosis type.
 */
function mapDiagnosisDocument(doc: DiagnosisDocument): Diagnosis {
  return {
    id: String(doc._id),
    diseaseName: doc.diseaseName,
    cropName: doc.cropName,
    confidence: doc.confidence,
    reasoning: doc.reasoning,
    severity: doc.severity,
    immediateActions: doc.immediateActions,
    preventiveMeasures: doc.preventiveMeasures,
    extensionOfficerAdvice: doc.extensionOfficerAdvice,
    createdAt: doc.createdAt instanceof Date
      ? doc.createdAt.toISOString()
      : String(doc.createdAt),
  };
}
