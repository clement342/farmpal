import type { HistoryQuery, HistoryRecord, ChatMessage } from '@/types';
import { HistoryRepository } from '@/repositories/history.repository';
import { DiagnosisRepository, type CreateDiagnosisData } from '@/repositories/diagnosis.repository';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import { ConversationModel } from '@/lib/db/models/conversation.model';
import { connectToDatabase } from '@/lib/db/connection';

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

  records = await populateConversationMessages(records);

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

  return mapToHistoryRecord(doc);
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
function mapToHistoryRecord(doc: DiagnosisDocument): HistoryRecord {
  const isoCreated = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt);
  const isoUpdated = doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt);

  const conversationId = doc.conversationId ?? '';

  return {
    id: String(doc._id),
    conversation: {
      id: conversationId || String(doc._id),
      messages: [], // populated async below
    },
    diagnosis: {
      id: String(doc._id),
      diseaseName: doc.diseaseName,
      cropName: doc.cropName,
      confidence: doc.confidence,
      reasoning: doc.reasoning,
      severity: doc.severity,
      immediateActions: doc.immediateActions,
      preventiveMeasures: doc.preventiveMeasures,
      extensionOfficerAdvice: doc.extensionOfficerAdvice,
      createdAt: isoCreated,
    },
    cropName: doc.cropName,
    initialSymptoms: doc.symptoms,
    createdAt: isoCreated,
    updatedAt: isoUpdated,
  };
}

/**
 * Loads conversation messages for a batch of history records.
 *
 * Performs at most one query per unique conversation ID to avoid N+1
 * while still fetching the actual message content that was stored in the
 * Conversation collection during the diagnosis flow.
 */
async function populateConversationMessages(
  records: HistoryRecord[],
): Promise<HistoryRecord[]> {
  const convIds = [...new Set(records.map((r) => r.conversation.id).filter(Boolean))];
  if (convIds.length === 0) return records;

  await connectToDatabase();
  const conversations = await ConversationModel.find(
    { _id: { $in: convIds } },
    { messages: 1 },
  ).lean().exec();

  const msgMap = new Map<string, ChatMessage[]>();
  for (const conv of conversations) {
    const id = String(conv._id);
    const messages: ChatMessage[] = (conv.messages ?? []).map((m: { role: string; content: string; createdAt?: Date }) => ({
      id: crypto.randomUUID(),
      role: m.role as ChatMessage['role'],
      content: m.content,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date().toISOString(),
    }));
    msgMap.set(id, messages);
  }

  return records.map((r) => {
    const msgs = msgMap.get(r.conversation.id);
    if (msgs) {
      return { ...r, conversation: { ...r.conversation, messages: msgs } };
    }
    return r;
  });
}
