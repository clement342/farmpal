import { DiseaseModel, type DiseaseDocument } from '@/lib/db/models/disease.model';
import { connectToDatabase } from '@/lib/db/connection';

/**
 * Repository for disease data.
 *
 * The only layer permitted to interact directly with the Disease collection.
 */
export class DiseaseRepository {
  /**
   * Creates a new disease entry.
   */
  async create(
    data: Omit<DiseaseDocument, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<DiseaseDocument> {
    await connectToDatabase();
    return DiseaseModel.create(data);
  }

  /**
   * Retrieves all diseases.
   *
   * @returns An array of disease documents
   */
  async findAll(): Promise<DiseaseDocument[]> {
    await connectToDatabase();
    return DiseaseModel.find().sort({ name: 1 }).lean().exec();
  }

  /**
   * Retrieves diseases associated with a specific crop.
   *
   * @param cropId - The crop identifier
   * @returns Matching disease documents
   */
  async findByCrop(cropId: string): Promise<DiseaseDocument[]> {
    await connectToDatabase();
    return DiseaseModel.find({ affectedCrops: cropId })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  /**
   * Retrieves a single disease by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns The document, or null if not found
   */
  async findById(id: string): Promise<DiseaseDocument | null> {
    await connectToDatabase();
    return DiseaseModel.findById(id).lean().exec();
  }

  /**
   * Deletes a disease by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns Whether a document was deleted
   */
  async delete(id: string): Promise<boolean> {
    await connectToDatabase();
    const result = await DiseaseModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
