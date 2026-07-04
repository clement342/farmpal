import type { Diagnosis, DiagnosisRequest, DiagnosisResponse } from '@/types';
import type { Crop } from '@/types/crop';
import { DiagnosisRepository, type CreateDiagnosisData } from '@/repositories/diagnosis.repository';
import { ConversationRepository } from '@/repositories/conversation.repository';
import { CropRepository } from '@/repositories/crop.repository';
import { generateDiagnosis } from '@/adapters/mock-ai/diagnosis.adapter';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import type { CropDocument } from '@/lib/db/models/crop.model';

/**
 * Diagnosis service.
 *
 * Orchestrates the crop disease diagnosis workflow:
 * 1. Looks up the crop for context
 * 2. Delegates to the AI adapter for diagnosis generation
 * 3. Persists the conversation and diagnosis result
 * 4. Returns the structured response
 *
 * The service depends on an AI adapter interface, not a concrete
 * implementation. Swapping from mock to real AI only requires
 * changing the adapter import.
 *
 * TODO:
 * - Replace import from mock adapter with a configurable adapter factory
 *   so the AI provider can be chosen at runtime (local vs cloud).
 * - Add request telemetry and logging.
 * - Add request tracing / correlation ID.
 */

const diagnosisRepository = new DiagnosisRepository();
const conversationRepository = new ConversationRepository();
const cropRepository = new CropRepository();

/**
 * Initiates the diagnosis pipeline for the given symptoms.
 *
 * @param request - The diagnosis request payload
 * @returns A diagnosis response (follow_up or diagnosis)
 */
export async function createDiagnosis(
  request: DiagnosisRequest,
): Promise<DiagnosisResponse> {
  // Look up the crop for context
  const crop = await cropRepository.findById(request.cropId);

  // Delegate diagnosis generation to the AI adapter
  // TODO:
  // Replace mocked adapter with AIProvider.generateDiagnosis()
  // once the AI provider layer is integrated.
  // The adapter should be injected via constructor or factory,
  // not hard-imported, to support runtime provider selection.
  const mappedCrop: Crop | undefined = crop ? mapCropDocument(crop) : undefined;
  const response = await generateDiagnosis(request, mappedCrop);

  // Persist conversation and diagnosis for completed diagnoses
  if (response.status === 'diagnosis') {
    const topCause = response.diagnosis.possibleCauses[0];

    // Save the conversation thread
    const conversation = await conversationRepository.create({
      messages: [
        {
          role: 'user',
          content: request.symptoms,
        },
        {
          role: 'assistant',
          content: response.diagnosis.reasoning,
        },
      ],
      cropId: request.cropId,
      cropName: crop?.name,
      resolved: true,
    });

    // Save the diagnosis record
    const data: CreateDiagnosisData = {
      diseaseName: topCause.name,
      cropName: crop?.name ?? 'Unknown',
      cropId: request.cropId,
      confidence: topCause.confidence,
      reasoning: response.diagnosis.reasoning,
      severity: mapUrgencyToSeverity(response.diagnosis.urgency),
      immediateActions: response.diagnosis.recommendations
        .filter((r) => r.category === 'immediate_action')
        .map((r) => r.text),
      preventiveMeasures: response.diagnosis.recommendations
        .filter((r) => r.category === 'preventive')
        .map((r) => r.text),
      extensionOfficerAdvice: response.diagnosis.extensionOfficerAdvice,
      symptoms: request.symptoms,
      conversationId: String(conversation._id),
      aiProvider: 'mock',
    };

    await diagnosisRepository.create(data);
  }

  return response;
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
 * Maps a Mongoose crop document to the shared Crop type.
 */
function mapCropDocument(doc: CropDocument): Crop {
  return {
    id: String(doc._id),
    name: doc.name,
    scientificName: doc.scientificName,
    varieties: doc.varieties,
    regions: doc.regions,
    growthStages: doc.growthStages,
    commonDiseaseIds: doc.commonDiseaseIds,
    imageUrl: doc.imageUrl,
  };
}

/**
 * Maps urgency from the diagnosis result to the severity level
 * used in the persisted Diagnosis record.
 */
function mapUrgencyToSeverity(urgency: string): 'low' | 'moderate' | 'high' | 'critical' {
  switch (urgency) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'moderate':
      return 'moderate';
    default:
      return 'low';
  }
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
