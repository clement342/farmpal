import { DiagnosisModel, type DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import { connectToDatabase } from '@/lib/db/connection';

/**
 * Repository for consultation history.
 *
 * History records are stored in the diagnoses collection with additional
 * query support for history-specific access patterns (date-range filtering,
 * full-text search on symptoms, etc.).
 *
 * Future optimisation: if the history access pattern diverges significantly
 * from the diagnosis access pattern, this repository can maintain its own
 * collection or view.
 */
export class HistoryRepository {
  /**
   * Retrieves paginated history records with optional filtering.
   *
   * @param options - Filter and pagination options
   * @returns Paginated results and total count
   */
  async findAll(options: {
    cropName?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'updatedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ data: DiagnosisDocument[]; total: number }> {
    await connectToDatabase();

    const query: Record<string, unknown> = {};
    const {
      cropName,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    if (cropName) {
      query.cropName = { $regex: cropName, $options: 'i' };
    }

    if (dateFrom || dateTo) {
      const createdAtFilter: Record<string, Date> = {};
      if (dateFrom) createdAtFilter.$gte = new Date(dateFrom);
      if (dateTo) createdAtFilter.$lte = new Date(dateTo);
      query.createdAt = createdAtFilter;
    }

    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortDirection };

    const [data, total] = await Promise.all([
      DiagnosisModel.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      DiagnosisModel.countDocuments(query).exec(),
    ]);

    return { data, total };
  }

  /**
   * Retrieves a single history record by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns The document, or null if not found
   */
  async findById(id: string): Promise<DiagnosisDocument | null> {
    await connectToDatabase();
    return DiagnosisModel.findById(id).lean().exec();
  }
}
