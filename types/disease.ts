/**
 * A crop disease entry in the knowledge base.
 */
export interface Disease {
  /** Unique identifier */
  id: string;
  /** Common name of the disease */
  name: string;
  /** Scientific name (if applicable) */
  scientificName?: string;
  /** Affected crop IDs */
  affectedCrops: string[];
  /** Common symptoms */
  symptoms: string[];
  /** Typical causes */
  causes: string[];
  /** Severity assessment */
  severity: 'low' | 'moderate' | 'high' | 'critical';
  /** Recommended treatments */
  treatments: string[];
  /** Preventive measures */
  prevention: string[];
  /** Regions where the disease is prevalent */
  regions: string[];
  /** Image URL reference for visual identification */
  imageUrl?: string;
}
