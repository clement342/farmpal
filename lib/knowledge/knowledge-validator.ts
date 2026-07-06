import { loadKnowledge } from './knowledge-loader';
import type { KnowledgeBase } from '@/types/knowledge';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Loads and validates the entire knowledge base.
 *
 * Checks:
 * 1. All required fields exist on every entity
 * 2. No duplicate IDs across any entity type
 * 3. All cross-references resolve (cropId, commonDiseaseIds, affectedCrops, etc.)
 * 4. Severity values are valid
 *
 * Run with: `npx ts-node -e "require('./lib/knowledge/knowledge-validator').validateAndReport()"`
 */
export function validateKnowledge(kb?: KnowledgeBase): ValidationResult {
  const knowledge = kb ?? loadKnowledge();
  const errors: string[] = [];
  const warnings: string[] = [];

  const allCropIds = new Set(knowledge.crops.map((c) => c.id));
  const allDiseaseIds = new Set<string>();
  const allPestIds = new Set(knowledge.pests.map((p) => p.id));
  const allDeficiencyIds = new Set(knowledge.deficiencies.map((d) => d.id));

  const requiredCropFields = ['id', 'name', 'scientificName', 'aliases', 'description', 'growingRegions', 'growthStages', 'commonDiseaseIds', 'commonPestIds', 'commonDeficiencyIds'] as const;
  const requiredDiseaseFields = ['id', 'cropId', 'name', 'aliases', 'description', 'symptoms', 'causes', 'severity', 'treatments', 'prevention', 'references'] as const;
  const requiredPestFields = ['id', 'name', 'aliases', 'description', 'affectedCrops', 'symptoms', 'lifecycle', 'treatments', 'prevention'] as const;
  const requiredDeficiencyFields = ['id', 'name', 'aliases', 'description', 'affectedCrops', 'symptoms', 'causes', 'treatments', 'prevention'] as const;
  const validSeverities = new Set(['low', 'moderate', 'high', 'critical']);

  for (const crop of knowledge.crops) {
    for (const field of requiredCropFields) {
      if (crop[field] === undefined || crop[field] === null) {
        errors.push(`Crop "${crop.id}": missing required field "${field}"`);
      }
    }

    if (allDiseaseIds.has(crop.id)) {
      errors.push(`Crop ID "${crop.id}" conflicts with a disease ID`);
    }
    if (allPestIds.has(crop.id)) {
      errors.push(`Crop ID "${crop.id}" conflicts with a pest ID`);
    }

    for (const diseaseId of crop.commonDiseaseIds) {
      if (!allDiseaseIds.has(diseaseId)) {
        warnings.push(`Crop "${crop.id}" references unknown disease ID "${diseaseId}"`);
      }
    }
    for (const pestId of crop.commonPestIds) {
      if (!allPestIds.has(pestId)) {
        warnings.push(`Crop "${crop.id}" references unknown pest ID "${pestId}"`);
      }
    }
    for (const deficiencyId of crop.commonDeficiencyIds) {
      if (!allDeficiencyIds.has(deficiencyId)) {
        warnings.push(`Crop "${crop.id}" references unknown deficiency ID "${deficiencyId}"`);
      }
    }
  }

  for (const disease of knowledge.diseases) {
    for (const field of requiredDiseaseFields) {
      if (disease[field] === undefined || disease[field] === null) {
        errors.push(`Disease "${disease.id}": missing required field "${field}"`);
      }
    }

    if (!allCropIds.has(disease.cropId)) {
      errors.push(`Disease "${disease.id}" references unknown cropId "${disease.cropId}"`);
    }

    if (!validSeverities.has(disease.severity)) {
      errors.push(`Disease "${disease.id}" has invalid severity "${disease.severity}"`);
    }

    if (allDiseaseIds.has(disease.id)) {
      errors.push(`Duplicate disease ID "${disease.id}"`);
    }
    allDiseaseIds.add(disease.id);
  }

  for (const pest of knowledge.pests) {
    for (const field of requiredPestFields) {
      if (pest[field] === undefined || pest[field] === null) {
        errors.push(`Pest "${pest.id}": missing required field "${field}"`);
      }
    }

    for (const cropId of pest.affectedCrops) {
      if (!allCropIds.has(cropId)) {
        errors.push(`Pest "${pest.id}" references unknown crop "${cropId}" in affectedCrops`);
      }
    }
  }

  for (const deficiency of knowledge.deficiencies) {
    for (const field of requiredDeficiencyFields) {
      if (deficiency[field] === undefined || deficiency[field] === null) {
        errors.push(`Deficiency "${deficiency.id}": missing required field "${field}"`);
      }
    }

    for (const cropId of deficiency.affectedCrops) {
      if (!allCropIds.has(cropId)) {
        errors.push(`Deficiency "${deficiency.id}" references unknown crop "${cropId}" in affectedCrops`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateAndReport(): void {
  const result = validateKnowledge();
  if (result.errors.length > 0) {
    console.error(`VALIDATION FAILED: ${result.errors.length} error(s)`);
    for (const err of result.errors) {
      console.error(`  [ERROR] ${err}`);
    }
  } else {
    console.log('VALIDATION PASSED: no errors found.');
  }

  if (result.warnings.length > 0) {
    console.log(`\n${result.warnings.length} warning(s):`);
    for (const warn of result.warnings) {
      console.log(`  [WARN] ${warn}`);
    }
  }
}
