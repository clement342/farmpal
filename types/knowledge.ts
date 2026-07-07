/**
 * Static knowledge base types for the Offline Knowledge Engine.
 *
 * These types describe agricultural knowledge bundled with the
 * application as static JSON — they are NOT stored in MongoDB.
 */

/** Knowledge base entry for a crop */
export interface KnowledgeCrop {
  id: string;
  name: string;
  scientificName: string;
  aliases: string[];
  description: string;
  growingRegions: string[];
  growthStages: string[];
  commonDiseaseIds: string[];
  commonPestIds: string[];
  commonDeficiencyIds: string[];
}

/** Knowledge base entry for a disease */
export interface KnowledgeDisease {
  id: string;
  cropId: string;
  name: string;
  scientificName?: string;
  aliases: string[];
  description: string;
  symptoms: string[];
  causes: string[];
  severity: 'low' | 'moderate' | 'high' | 'critical';
  seasonality?: string[];
  treatments: string[];
  prevention: string[];
  references: string[];
}

/** Knowledge base entry for a pest */
export interface KnowledgePest {
  id: string;
  name: string;
  scientificName?: string;
  aliases: string[];
  description: string;
  affectedCrops: string[];
  symptoms: string[];
  lifecycle: string[];
  treatments: string[];
  prevention: string[];
}

/** Knowledge base entry for a nutrient deficiency */
export interface KnowledgeDeficiency {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  affectedCrops: string[];
  symptoms: string[];
  causes: string[];
  treatments: string[];
  prevention: string[];
}

/** Knowledge base entry for a treatment / remedy */
export interface KnowledgeRemedy {
  id: string;
  name: string;
  type: 'chemical' | 'organic' | 'cultural' | 'biological';
  description: string;
  applicationMethod: string;
  safetyInterval?: string;
  targetIds: string[];
  targetType: 'disease' | 'pest' | 'deficiency';
}

/** Glossary term */
export interface KnowledgeGlossaryTerm {
  term: string;
  definition: string;
  category: string;
}

/** Metadata about the knowledge base itself */
export interface KnowledgeMetadata {
  version: string;
  lastUpdated: string;
  cropCount: number;
  diseaseCount: number;
  pestCount: number;
  deficiencyCount: number;
  remedyCount: number;
  glossaryCount: number;
}

/** The full in-memory knowledge base */
export interface KnowledgeBase {
  crops: KnowledgeCrop[];
  diseases: KnowledgeDisease[];
  pests: KnowledgePest[];
  deficiencies: KnowledgeDeficiency[];
  remedies: KnowledgeRemedy[];
  glossary: KnowledgeGlossaryTerm[];
  metadata: KnowledgeMetadata;
}
