/**
 * A crop type supported by the diagnostic system.
 */
export interface Crop {
  /** Unique identifier */
  id: string;
  /** Common name (e.g., "Maize", "Rice") */
  name: string;
  /** Scientific name */
  scientificName?: string;
  /** Varieties or cultivars */
  varieties?: string[];
  /** Typical growing regions */
  regions: string[];
  /** Growth stages relevant to diagnosis */
  growthStages: string[];
  /** Common disease IDs associated with this crop */
  commonDiseaseIds: string[];
  /** Image URL */
  imageUrl?: string;
}
