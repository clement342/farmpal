import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

/**
 * Sub-document interface for a single chat message within a conversation.
 */
export interface MessageSubDocument {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

/**
 * Possible states of a conversation session.
 */
export type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

/**
 * Mongoose document interface for a Conversation.
 */
export interface ConversationDocument extends Document {
  _id: Types.ObjectId;
  messages: MessageSubDocument[];
  cropId?: string;
  cropName?: string;
  status: ConversationStatus;
  diagnosisId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSubSchema = new Schema<MessageSubDocument>(
  {
    role: {
      type: String,
      required: true,
      enum: ['user', 'assistant', 'system'],
    },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ConversationSchema = new Schema<ConversationDocument>(
  {
    messages: {
      type: [MessageSubSchema],
      required: true,
      default: [],
    },
    cropId: { type: String, index: true },
    cropName: { type: String },
    status: {
      type: String,
      default: 'ACTIVE',
      enum: ['ACTIVE', 'COMPLETED', 'ABANDONED'],
      index: true,
    },
    diagnosisId: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'conversations',
  },
);

ConversationSchema.index({ status: 1, updatedAt: -1 });
ConversationSchema.index({ createdAt: -1 });

/**
 * Mongoose model for conversations.
 *
 * Uses the existing model if one has already been compiled
 * (avoids "Cannot overwrite model" errors during hot reload).
 */
export const ConversationModel: Model<ConversationDocument> =
  mongoose.models.Conversation ??
  mongoose.model<ConversationDocument>('Conversation', ConversationSchema);
