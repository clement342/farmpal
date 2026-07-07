import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * Mongoose document interface for a Diagnosis.
 * Mirrors the shared Diagnosis type while adding Mongoose-specific fields.
 */
export interface DiagnosisDocument extends Document {
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
  /** AI provider used for this diagnosis */
  aiProvider?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DiagnosisSchema = new Schema<DiagnosisDocument>(
  {
    diseaseName: { type: String, required: true, index: true },
    cropName: { type: String, required: true, index: true },
    cropId: { type: String, required: true, index: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    reasoning: { type: String, required: true },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'moderate', 'high', 'critical'],
    },
    immediateActions: [{ type: String }],
    preventiveMeasures: [{ type: String }],
    extensionOfficerAdvice: { type: String },
    conversationId: { type: String, index: true },
    symptoms: { type: String, required: true },
    aiProvider: { type: String },
  },
  {
    timestamps: true,
    collection: 'diagnoses',
  },
);

DiagnosisSchema.index({ createdAt: -1 });

/**
 * Mongoose model for diagnoses.
 *
 * Uses the existing model if one has already been compiled
 * (avoids "Cannot overwrite model" errors during hot reload).
 */
export const DiagnosisModel: Model<DiagnosisDocument> =
  mongoose.models.Diagnosis ??
  mongoose.model<DiagnosisDocument>('Diagnosis', DiagnosisSchema);
