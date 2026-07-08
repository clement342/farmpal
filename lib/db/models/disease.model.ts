import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

/**
 * Mongoose document interface for a Disease.
 */
export interface DiseaseDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  scientificName?: string;
  affectedCrops: string[];
  symptoms: string[];
  causes: string[];
  severity: 'low' | 'moderate' | 'high' | 'critical';
  treatments: string[];
  prevention: string[];
  regions: string[];
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DiseaseSchema = new Schema<DiseaseDocument>(
  {
    name: { type: String, required: true, unique: true, index: true },
    scientificName: { type: String },
    affectedCrops: [{ type: String, index: true }],
    symptoms: [{ type: String }],
    causes: [{ type: String }],
    severity: {
      type: String,
      required: true,
      enum: ['low', 'moderate', 'high', 'critical'],
    },
    treatments: [{ type: String }],
    prevention: [{ type: String }],
    regions: [{ type: String, index: true }],
    imageUrl: { type: String },
  },
  {
    timestamps: true,
    collection: 'diseases',
  },
);

DiseaseSchema.index({ name: 'text' });
DiseaseSchema.index({ affectedCrops: 1 });

/**
 * Mongoose model for diseases.
 *
 * Uses the existing model if one has already been compiled
 * (avoids "Cannot overwrite model" errors during hot reload).
 */
export const DiseaseModel: Model<DiseaseDocument> =
  mongoose.models.Disease ??
  mongoose.model<DiseaseDocument>('Disease', DiseaseSchema);
