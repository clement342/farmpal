import type { ChatMessage, Diagnosis, DiagnosisRequest, ConversationDiagnosisResponse } from '@/types';
import type { Crop } from '@/types/crop';
import { DiagnosisRepository, type CreateDiagnosisData } from '@/repositories/diagnosis.repository';
import { ConversationRepository } from '@/repositories/conversation.repository';
import { CropRepository } from '@/repositories/crop.repository';
import { getDiagnosisAdapter, getStreamDiagnosisAdapter, getAdapterProviderName } from '@/adapters/diagnosis-adapter.factory';
import { parseDiagnosisResponse } from '@/lib/ai/parsers/diagnosis-response.parser';
import { mapToDiagnosisResponse } from '@/adapters/diagnosis/mapper';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import type { CropDocument } from '@/lib/db/models/crop.model';
import { NotFoundError } from '@/utils/errors';
import { knowledgeService } from '@/services/knowledge.service';
import { generateOfflineDiagnosis, OFFLINE_PROVIDER_NAME } from '@/services/offline-diagnosis.service';
import { createLogger } from '@/lib/ai/logger';

const log = createLogger('diagnose:service');

const diagnosisRepository = new DiagnosisRepository();
const conversationRepository = new ConversationRepository();
const cropRepository = new CropRepository();

function resolveCropName(cropId?: string, mongoCrop?: { name?: string }): string {
  if (mongoCrop?.name) return mongoCrop.name;
  if (!cropId) return '';
  const kbCrop = knowledgeService.getCrop(cropId);
  return kbCrop?.name ?? '';
}

/**
 * Initiates or continues a diagnosis conversation.
 *
 * If the request includes a `conversationId` the existing conversation
 * is loaded and the new message is appended before calling the AI.
 * Otherwise a new conversation is created.
 *
 * On a completed diagnosis the conversation is marked COMPLETED and
 * the result is persisted. On a follow-up the conversation stays
 * ACTIVE so the farmer can continue.
 *
 * @param request - The diagnosis request payload.
 * @returns A conversation-aware diagnosis response.
 * @throws NotFoundError if the conversationId does not exist.
 */
export async function createDiagnosis(
  request: DiagnosisRequest,
): Promise<ConversationDiagnosisResponse> {
  const crop = request.cropId ? await cropRepository.findById(request.cropId) : null;
  const mappedCrop: Crop | undefined = crop ? mapCropDocument(crop) : undefined;

  // -----------------------------------------------------------------------
  // Resolve or create conversation
  // -----------------------------------------------------------------------
  let conversationId: string;
  let existingMessages: ChatMessage[] = [];

  if (request.conversationId) {
    const existing = await conversationRepository.findById(request.conversationId);
    if (!existing) {
      throw new NotFoundError('Conversation');
    }
    conversationId = request.conversationId;
    existingMessages = existing.messages.map(mapMessageSubDoc);
  } else {
    const created = await conversationRepository.createConversation({
      messages: [],
      cropId: request.cropId,
      cropName: crop?.name,
    });
    conversationId = String(created._id);
  }

  // -----------------------------------------------------------------------
  // Append user message to conversation
  // -----------------------------------------------------------------------
  await conversationRepository.appendMessage(conversationId, {
    role: 'user',
    content: request.symptoms,
  });

  // -----------------------------------------------------------------------
  // Call AI adapter — fall back to offline KB if all providers fail
  // -----------------------------------------------------------------------
  let response: Awaited<ReturnType<typeof generateOfflineDiagnosis>>;
  let aiProvider: string;

  try {
    const generateDiagnosis = await getDiagnosisAdapter();
    aiProvider = getAdapterProviderName();
    response = await generateDiagnosis(request, mappedCrop, existingMessages);
  } catch (aiError) {
    log.warn('All AI providers failed — falling back to offline knowledge base', {
      error: aiError instanceof Error ? aiError.message : String(aiError),
    });
    aiProvider = OFFLINE_PROVIDER_NAME;
    response = generateOfflineDiagnosis(request);
  }

  // -----------------------------------------------------------------------
  // Persist AI response and handle completion
  // -----------------------------------------------------------------------
  if (response.status === 'diagnosis') {
    const topCause = response.diagnosis.possibleCauses[0];

    await conversationRepository.appendMessage(conversationId, {
      role: 'assistant',
      content: response.diagnosis.reasoning,
    });

    const diagnosisData: CreateDiagnosisData = {
      diseaseName: topCause.name,
      cropName: resolveCropName(request.cropId, crop ?? undefined),
      cropId: request.cropId ?? '',
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
      conversationId,
      aiProvider,
    };

    const diagnosisDoc = await diagnosisRepository.create(diagnosisData);
    await conversationRepository.completeConversation(conversationId, String(diagnosisDoc._id));

    return {
      conversationId,
      status: 'COMPLETED',
      response,
    };
  }

  // Follow-up — leave conversation ACTIVE, persist AI question
  await conversationRepository.appendMessage(conversationId, {
    role: 'assistant',
    content: response.question,
  });

  return {
    conversationId,
    status: 'ACTIVE',
    response,
  };
}

/**
 * Initiates a streaming diagnosis conversation.
 *
 * Sets up or resumes a conversation, then returns a `ReadableStream`
 * that yields SSE events (`chunk`, `result`, or `error`) as the AI
 * generates its response. After the stream completes, the conversation
 * and diagnosis (if reached) are persisted.
 *
 * The caller (route handler) should pipe this stream directly into the
 * HTTP response with `Content-Type: text/event-stream`.
 *
 * @param request - The diagnosis request.
 * @returns A ReadableStream of SSE-encoded events.
 */
export async function streamDiagnosis(
  request: DiagnosisRequest,
): Promise<ReadableStream<Uint8Array>> {
  const mongoCrop = request.cropId ? await cropRepository.findById(request.cropId) : null;
  const cropName = resolveCropName(request.cropId, mongoCrop ?? undefined);
  const mappedCrop: Crop | undefined = mongoCrop ? mapCropDocument(mongoCrop) : undefined;

  // -----------------------------------------------------------------------
  // Resolve or create conversation
  // -----------------------------------------------------------------------
  let conversationId: string;
  let existingMessages: ChatMessage[] = [];

  if (request.conversationId) {
    const existing = await conversationRepository.findById(request.conversationId);
    if (!existing) throw new NotFoundError('Conversation');
    conversationId = request.conversationId;
    existingMessages = existing.messages.map(mapMessageSubDoc);
  } else {
    const created = await conversationRepository.createConversation({
      messages: [],
      cropId: request.cropId,
      cropName,
    });
    conversationId = String(created._id);
  }

  await conversationRepository.appendMessage(conversationId, {
    role: 'user',
    content: request.symptoms,
  });

  // -----------------------------------------------------------------------
  // Create the stream
  // -----------------------------------------------------------------------
  const streamAdapter = await getStreamDiagnosisAdapter();
  const aiProvider = getAdapterProviderName();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // --- Buffer the full AI response first ---
        let fullText = '';
        for await (const chunk of streamAdapter(request, mappedCrop, existingMessages)) {
          fullText += chunk;
        }

        // --- Parse and persist ---
        const parsed = parseDiagnosisResponse(fullText);

        if (!parsed.success) {
          controller.enqueue(encodeSSE('error', { message: parsed.error.message }));
          controller.close();
          return;
        }

        const response = mapToDiagnosisResponse(parsed.data);
        await persistAndEmit(response, aiProvider, cropName, request, conversationId, controller);
      } catch (err) {
        // AI stream failed — attempt offline KB fallback before giving up
        log.warn('Streaming AI failed — falling back to offline knowledge base', {
          error: err instanceof Error ? err.message : String(err),
        });
        try {
          const offlineResponse = generateOfflineDiagnosis(request);
          await persistAndEmit(offlineResponse, OFFLINE_PROVIDER_NAME, cropName, request, conversationId, controller);
        } catch (offlineErr) {
          controller.enqueue(encodeSSE('error', {
            message: offlineErr instanceof Error
              ? offlineErr.message
              : 'An unexpected error occurred during diagnosis',
          }));
        }
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Encodes a streaming event as an SSE-format Uint8Array.
 */
function encodeSSE(type: string, data: unknown): Uint8Array {
  const payload = `data: ${JSON.stringify({ type, ...(data as Record<string, unknown>) })}\n\n`;
  return new TextEncoder().encode(payload);
}

/**
 * Persists a DiagnosisResponse and emits SSE events to the stream controller.
 *
 * Shared between the AI streaming path and the offline KB fallback so
 * both paths produce identical SSE output and MongoDB records.
 */
async function persistAndEmit(
  response: ReturnType<typeof generateOfflineDiagnosis>,
  provider: string,
  cropName: string,
  request: DiagnosisRequest,
  conversationId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  const displayText =
    response.status === 'follow_up'
      ? response.question
      : response.diagnosis.reasoning;

  controller.enqueue(encodeSSE('chunk', { text: displayText }));

  if (response.status === 'diagnosis') {
    const topCause = response.diagnosis.possibleCauses[0];

    await conversationRepository.appendMessage(conversationId, {
      role: 'assistant',
      content: response.diagnosis.reasoning,
    });

    const diagnosisData: CreateDiagnosisData = {
      diseaseName: topCause.name,
      cropName,
      cropId: request.cropId ?? '',
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
      conversationId,
      aiProvider: provider,
    };

    const diagnosisDoc = await diagnosisRepository.create(diagnosisData);
    await conversationRepository.completeConversation(conversationId, String(diagnosisDoc._id));

    controller.enqueue(encodeSSE('result', {
      conversationId,
      status: 'COMPLETED',
      response,
    }));
  } else {
    await conversationRepository.appendMessage(conversationId, {
      role: 'assistant',
      content: response.question,
    });

    controller.enqueue(encodeSSE('result', {
      conversationId,
      status: 'ACTIVE',
      response,
    }));
  }
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
 * Maps a Mongoose message sub-document to the shared ChatMessage type.
 */
function mapMessageSubDoc(doc: { role: string; content: string; createdAt?: Date }): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: doc.role as ChatMessage['role'],
    content: doc.content,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date().toISOString(),
  };
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
    case 'critical': return 'critical';
    case 'high':     return 'high';
    case 'moderate': return 'moderate';
    default:         return 'low';
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
