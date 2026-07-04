import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Sub-document interface for a single chat message within a conversation.
 */
export interface MessageSubDocument {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
}

/**
 * Mongoose document interface for a Conversation.
 */
export interface ConversationDocument extends Document {
  messages: MessageSubDocument[];
  cropId?: string;
  cropName?: string;
  resolved: boolean;
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
    resolved: { type: Boolean, default: false, index: true },
    diagnosisId: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'conversations',
  },
);

ConversationSchema.index({ updatedAt: -1 });
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
