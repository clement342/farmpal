import { ConversationModel, type ConversationDocument } from '@/lib/db/models/conversation.model';
import { connectToDatabase } from '@/lib/db/connection';

/**
 * Repository for conversation data.
 *
 * The only layer permitted to interact directly with the Conversation collection.
 * All conversation persistence must go through this class.
 */
export class ConversationRepository {
  /**
   * Creates a new conversation.
   *
   * @param data - The conversation data
   * @returns The created document
   */
  async create(data: {
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    cropId?: string;
    cropName?: string;
    resolved?: boolean;
    diagnosisId?: string;
  }): Promise<ConversationDocument> {
    await connectToDatabase();
    return ConversationModel.create({
      messages: data.messages.map((m) => ({
        ...m,
        createdAt: new Date(),
      })),
      cropId: data.cropId,
      cropName: data.cropName,
      resolved: data.resolved ?? false,
      diagnosisId: data.diagnosisId,
    });
  }

  /**
   * Retrieves a conversation by its ID.
   *
   * @param id - The MongoDB ObjectId string
   * @returns The document, or null if not found
   */
  async findById(id: string): Promise<ConversationDocument | null> {
    await connectToDatabase();
    return ConversationModel.findById(id).lean().exec();
  }

  /**
   * Updates a conversation's messages and metadata.
   *
   * @param id - The MongoDB ObjectId string
   * @param data - Fields to update
   * @returns The updated document, or null if not found
   */
  async update(
    id: string,
    data: {
      messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      resolved?: boolean;
      diagnosisId?: string;
    },
  ): Promise<ConversationDocument | null> {
    await connectToDatabase();

    const updateData: Record<string, unknown> = {};

    if (data.messages) {
      updateData.messages = data.messages.map((m) => ({
        ...m,
        createdAt: new Date(),
      }));
    }
    if (data.resolved !== undefined) {
      updateData.resolved = data.resolved;
    }
    if (data.diagnosisId !== undefined) {
      updateData.diagnosisId = data.diagnosisId;
    }

    return ConversationModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean().exec();
  }
}
