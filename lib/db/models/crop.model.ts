import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

/**
 * Mongoose document interface for a Crop.
 */
export interface CropDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  scientificName?: string;
  varieties?: string[];
  regions: string[];
  growthStages: string[];
  commonDiseaseIds: string[];
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CropSchema = new Schema<CropDocument>(
  {
    name: { type: String, required: true, unique: true, index: true },
    scientificName: { type: String },
    varieties: [{ type: String }],
    regions: [{ type: String, index: true }],
    growthStages: [{ type: String }],
    commonDiseaseIds: [{ type: String }],
    imageUrl: { type: String },
  },
  {
    timestamps: true,
    collection: 'crops',
  },
);

CropSchema.index({ name: 'text' });

/**
 * Mongoose model for crops.
 *
 * Uses the existing model if one has already been compiled
 * (avoids "Cannot overwrite model" errors during hot reload).
 */
export const CropModel: Model<CropDocument> =
  mongoose.models.Crop ??
  mongoose.model<CropDocument>('Crop', CropSchema);
