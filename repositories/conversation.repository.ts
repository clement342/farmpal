import { ConversationModel, type ConversationDocument, type ConversationStatus } from '@/lib/db/models/conversation.model';
import { connectToDatabase } from '@/lib/db/connection';

export interface CreateConversationData {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  cropId?: string;
  cropName?: string;
}

export interface FindRecentOptions {
  status?: ConversationStatus;
  cropName?: string;
  page?: number;
  limit?: number;
}

/**
 * Repository for conversation data.
 *
 * The only layer permitted to interact directly with the Conversation collection.
 * All conversation persistence must go through this class.
 */
export class ConversationRepository {
  /**
   * Creates a new conversation with ACTIVE status.
   *
   * @param data - The conversation data
   * @returns The created document
   */
  async createConversation(data: CreateConversationData): Promise<ConversationDocument> {
    await connectToDatabase();
    return ConversationModel.create({
      messages: data.messages.map((m) => ({
        ...m,
        createdAt: new Date(),
      })),
      cropId: data.cropId,
      cropName: data.cropName,
      status: 'ACTIVE',
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
   * Appends a message to an existing conversation.
   *
   * @param id      - The MongoDB ObjectId string
   * @param message - The message to append
   * @returns The updated document, or null if not found
   */
  async appendMessage(
    id: string,
    message: { role: 'user' | 'assistant' | 'system'; content: string },
  ): Promise<ConversationDocument | null> {
    await connectToDatabase();
    return ConversationModel.findByIdAndUpdate(
      id,
      {
        $push: {
          messages: { ...message, createdAt: new Date() },
        },
      },
      { new: true },
    ).lean().exec();
  }

  /**
   * Marks a conversation as COMPLETED and optionally links a diagnosis.
   *
   * @param id          - The MongoDB ObjectId string
   * @param diagnosisId - The diagnosis record ID (optional)
   * @returns The updated document, or null if not found
   */
  async completeConversation(
    id: string,
    diagnosisId?: string,
  ): Promise<ConversationDocument | null> {
    await connectToDatabase();
    const update: Record<string, unknown> = { status: 'COMPLETED' };
    if (diagnosisId) update.diagnosisId = diagnosisId;
    return ConversationModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean().exec();
  }

  /**
   * Marks a conversation as ABANDONED.
   *
   * @param id - The MongoDB ObjectId string
   * @returns The updated document, or null if not found
   */
  async markAbandoned(id: string): Promise<ConversationDocument | null> {
    await connectToDatabase();
    return ConversationModel.findByIdAndUpdate(
      id,
      { $set: { status: 'ABANDONED' } },
      { new: true },
    ).lean().exec();
  }

  /**
   * Retrieves recent conversations with optional filtering.
   *
   * @param options - Filter and pagination options
   * @returns Paginated results and total count
   */
  async findRecent(
    options: FindRecentOptions = {},
  ): Promise<{ data: ConversationDocument[]; total: number }> {
    await connectToDatabase();

    const { status, cropName, page = 1, limit = 20 } = options;
    const query: Record<string, unknown> = {};

    if (status) query.status = status;
    if (cropName) query.cropName = { $regex: cropName, $options: 'i' };

    const [data, total] = await Promise.all([
      ConversationModel.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      ConversationModel.countDocuments(query).exec(),
    ]);

    return { data, total };
  }

  // ---------------------------------------------------------------------------
  // Deprecated — kept for backward compatibility during migration
  // ---------------------------------------------------------------------------

  /**
   * Creates a new conversation (legacy).
   *
   * @deprecated Use `createConversation()` instead.
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
      status: data.resolved ? 'COMPLETED' : 'ACTIVE',
      diagnosisId: data.diagnosisId,
    });
  }

  /**
   * Updates a conversation (legacy).
   *
   * @deprecated Use specific methods like `appendMessage()` or `completeConversation()`.
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
      updateData.status = data.resolved ? 'COMPLETED' : 'ACTIVE';
    }
    if (data.diagnosisId !== undefined) {
      updateData.diagnosisId = data.diagnosisId;
    }

    return ConversationModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean().exec();
  }
}
