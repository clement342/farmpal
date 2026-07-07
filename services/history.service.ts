import type { HistoryQuery, HistoryRecord } from '@/types';
import { HistoryRepository } from '@/repositories/history.repository';
import { DiagnosisRepository, type CreateDiagnosisData } from '@/repositories/diagnosis.repository';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';

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

  const records: HistoryRecord[] = data.map((doc) => mapToHistoryRecord(doc));

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
 * Maps a Mongoose diagnosis document to a HistoryRecord.
 */
function mapToHistoryRecord(doc: DiagnosisDocument): HistoryRecord {
  const isoCreated = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt);
  const isoUpdated = doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt);

  return {
    id: String(doc._id),
    conversation: {
      id: doc.conversationId || String(doc._id),
      messages: [],
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
