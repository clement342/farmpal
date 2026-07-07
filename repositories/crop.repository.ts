import { CropModel, type CropDocument } from '@/lib/db/models/crop.model';
import { connectToDatabase } from '@/lib/db/connection';

/**
 * Repository for crop data.
 *
 * The only layer permitted to interact directly with the Crop collection.
 */
export class CropRepository {
  /**
   * Creates a new crop entry.
   */
  async create(
    data: Omit<CropDocument, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CropDocument> {
    await connectToDatabase();
    return CropModel.create(data);
  }

  /**
   * Retrieves all crops.
   *
   * @returns An array of crop documents
   */
  async findAll(): Promise<CropDocument[]> {
    await connectToDatabase();
    return CropModel.find().sort({ name: 1 }).lean().exec();
  }

  /**
   * Retrieves a single crop by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns The document, or null if not found or id is not a valid ObjectId
   */
  async findById(id: string): Promise<CropDocument | null> {
    await connectToDatabase();
    try {
      return await CropModel.findById(id).lean().exec();
    } catch {
      return null;
    }
  }

  /**
   * Searches crops by name (case-insensitive).
   *
   * @param query - The search string
   * @returns Matching crop documents
   */
  async searchByName(query: string): Promise<CropDocument[]> {
    await connectToDatabase();
    const regex = new RegExp(query, 'i');
    return CropModel.find({ name: regex }).sort({ name: 1 }).lean().exec();
  }

  /**
   * Deletes a crop by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns Whether a document was deleted
   */
  async delete(id: string): Promise<boolean> {
    await connectToDatabase();
    const result = await CropModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
