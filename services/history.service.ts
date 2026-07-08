import type { HistoryQuery, HistoryRecord, ChatMessage } from '@/types';
import { HistoryRepository } from '@/repositories/history.repository';
import { DiagnosisRepository, type CreateDiagnosisData } from '@/repositories/diagnosis.repository';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import { ConversationModel } from '@/lib/db/models/conversation.model';
import { connectToDatabase } from '@/lib/db/connection';
import { enrichCropName } from '@/lib/crop-resolver';

/**
 * History service.
 *
 * Manages the consultation history. Handles retrieval with filtering
 * and pagination, as well as saving new records from completed diagnoses.
 *
 * TODO:
 * - Add full-text search over symptoms and diagnoses
 * - Add sorting by relevance or crop name
 * - Implement cursor-based pagination for large datasets
 */

const historyRepository = new HistoryRepository();
const diagnosisRepository = new DiagnosisRepository();

/**
 * Retrieves a paginated list of history records.
 *
 * @param query - Filtering and pagination parameters
 * @returns An object containing the records and total count
 */
export async function getHistory(
  query: HistoryQuery,
): Promise<{ records: HistoryRecord[]; total: number }> {
  const { data, total } = await historyRepository.findAll({
    cropName: query.cropName,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  let records: HistoryRecord[] = data.map((doc) => mapToHistoryRecord(doc));

  records = await populateConversationData(records);

  return { records, total };
}

/**
 * Retrieves a single history record by its ID.
 *
 * @param id - The history record identifier
 * @returns The history record, or null if not found
 */
export async function getHistoryById(id: string): Promise<HistoryRecord | null> {
  const doc = await historyRepository.findById(id);
  if (!doc) return null;

  const [record] = await populateConversationData([mapToHistoryRecord(doc)]);
  return record ?? null;
}

/**
 * Saves a new history record after a diagnosis is completed.
 *
 * @param record - The history record to persist
 * @returns The saved record with its generated ID
 */
export async function saveHistoryRecord(
  record: Omit<HistoryRecord, 'id'>,
): Promise<HistoryRecord> {
  const data: CreateDiagnosisData = {
    diseaseName: record.diagnosis?.diseaseName ?? '',
    cropName: record.cropName,
    cropId: '',
    confidence: record.diagnosis?.confidence ?? 0,
    reasoning: record.diagnosis?.reasoning ?? '',
    severity: record.diagnosis?.severity ?? 'low',
    immediateActions: record.diagnosis?.immediateActions ?? [],
    preventiveMeasures: record.diagnosis?.preventiveMeasures ?? [],
    extensionOfficerAdvice: record.diagnosis?.extensionOfficerAdvice,
    symptoms: record.initialSymptoms,
    conversationId: record.conversation.id,
    aiProvider: undefined,
  };

  const doc = await diagnosisRepository.create(data);

  return {
    id: String(doc._id),
    conversation: {
      id: record.conversation.id,
      messages: record.conversation.messages,
    },
    diagnosis: record.diagnosis
      ? { ...record.diagnosis, id: String(doc._id), createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt) }
      : undefined,
    cropName: record.cropName,
    initialSymptoms: record.initialSymptoms,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
  };
}

/**
 * Maps a Mongoose diagnosis document to a HistoryRecord,
 * loading the conversation messages from the Conversation collection.
 */
function mapToHistoryRecord(
  doc: DiagnosisDocument,
  conversationCrop?: { cropId?: string; cropName?: string },
): HistoryRecord {
  const isoCreated = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt);
  const isoUpdated = doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt);

  const conversationId = doc.conversationId ?? '';
  const cropName = enrichCropName(doc.cropId, doc.cropName, conversationCrop);
  const cropId = doc.cropId && doc.cropId !== 'Unknown' && doc.cropId !== 'unspecified'
    ? doc.cropId
    : conversationCrop?.cropId;

  return {
    id: String(doc._id),
    conversation: {
      id: conversationId || String(doc._id),
      messages: [], // populated async below
    },
    diagnosis: {
      id: String(doc._id),
      diseaseName: doc.diseaseName,
      cropName: cropName || doc.cropName,
      confidence: doc.confidence,
      reasoning: doc.reasoning,
      severity: doc.severity,
      immediateActions: doc.immediateActions,
      preventiveMeasures: doc.preventiveMeasures,
      extensionOfficerAdvice: doc.extensionOfficerAdvice,
      createdAt: isoCreated,
    },
    cropName: cropName || '',
    cropId,
    initialSymptoms: doc.symptoms,
    createdAt: isoCreated,
    updatedAt: isoUpdated,
  };
}

/**
 * Loads conversation messages and crop context for a batch of history records.
 */
async function populateConversationData(
  records: HistoryRecord[],
): Promise<HistoryRecord[]> {
  const convIds = [...new Set(records.map((r) => r.conversation.id).filter(Boolean))];
  if (convIds.length === 0) return records;

  await connectToDatabase();
  const conversations = await ConversationModel.find(
    { _id: { $in: convIds } },
    { messages: 1, cropId: 1, cropName: 1 },
  ).lean().exec();

  const msgMap = new Map<string, ChatMessage[]>();
  const cropMap = new Map<string, { cropId?: string; cropName?: string }>();
  for (const conv of conversations) {
    const id = String(conv._id);
    const messages: ChatMessage[] = (conv.messages ?? []).map((m: { role: string; content: string; createdAt?: Date }) => ({
      id: crypto.randomUUID(),
      role: m.role as ChatMessage['role'],
      content: m.content,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date().toISOString(),
    }));
    msgMap.set(id, messages);
    cropMap.set(id, { cropId: conv.cropId, cropName: conv.cropName });
  }

  return records.map((r) => {
    const msgs = msgMap.get(r.conversation.id);
    const convCrop = cropMap.get(r.conversation.id);
    const enrichedCropName = enrichCropName(r.cropId, r.cropName, convCrop);

    const updated: HistoryRecord = {
      ...r,
      cropName: enrichedCropName || r.cropName,
      cropId: r.cropId || convCrop?.cropId,
      conversation: {
        ...r.conversation,
        messages: msgs ?? r.conversation.messages,
      },
    };

    if (updated.diagnosis && enrichedCropName) {
      updated.diagnosis = { ...updated.diagnosis, cropName: enrichedCropName };
    }

    return updated;
  });
}
