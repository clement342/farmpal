import { DiagnosisModel, type DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import { connectToDatabase } from '@/lib/db/connection';

/**
 * Input type for creating a diagnosis.
 * Excludes Mongoose-managed metadata fields.
 */
export type CreateDiagnosisData = {
  diseaseName: string;
  cropName: string;
  cropId: string;
  confidence: number;
  reasoning: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  immediateActions: string[];
  preventiveMeasures: string[];
  extensionOfficerAdvice?: string;
  conversationId?: string;
  symptoms: string;
  aiProvider?: string;
};

/**
 * Repository for diagnosis data.
 *
 * The only layer permitted to interact directly with the Diagnosis collection.
 * All database access for diagnosis records must go through this class.
 */
export class DiagnosisRepository {
  /**
   * Creates a new diagnosis record.
   *
   * @param data - The diagnosis data
   * @returns The created document
   */
  async create(data: CreateDiagnosisData): Promise<DiagnosisDocument> {
    await connectToDatabase();
    return DiagnosisModel.create(data);
  }

  /**
   * Retrieves a diagnosis by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns The document, or null if not found
   */
  async findById(id: string): Promise<DiagnosisDocument | null> {
    await connectToDatabase();
    return DiagnosisModel.findById(id).lean().exec();
  }

  /**
   * Retrieves diagnoses filtered by crop name, with pagination.
   *
   * @param filter - Optional filter by crop name
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @returns Paginated results and total count
   */
  async findAll(
    filter: { cropName?: string } = {},
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: DiagnosisDocument[]; total: number }> {
    await connectToDatabase();

    const query: Record<string, unknown> = {};
    if (filter.cropName) {
      query.cropName = { $regex: filter.cropName, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      DiagnosisModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      DiagnosisModel.countDocuments(query).exec(),
    ]);

    return { data, total };
  }

  /**
   * Deletes a diagnosis by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns Whether a document was deleted
   */
  async delete(id: string): Promise<boolean> {
    await connectToDatabase();
    const result = await DiagnosisModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
