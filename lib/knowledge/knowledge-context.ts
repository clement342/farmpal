import type { KnowledgeCrop, KnowledgeDisease } from '@/types/knowledge';
import { findCrop, findDiseasesByCrop, findByKeyword } from './knowledge-search';

/**
 * Builds a concise knowledge context string suitable for AI prompt injection.
 *
 * The produced string is appended to the system prompt as `extraContext`,
 * giving the AI concrete agricultural facts to reference during diagnosis.
 *
 * @param cropId   - The crop ID (e.g. "maize")
 * @param symptoms - Optional symptom description for keyword matching
 * @returns A formatted context block or an empty string if no data is found.
 */
export function buildKnowledgeContext(cropId?: string, symptoms?: string): string {
  const parts: string[] = [];

  // ── Crop Information ──────────────────────────────────────────────
  if (cropId) {
    const crop = findCrop(cropId);
    if (crop) {
      parts.push(formatCropBlock(crop));
    }
  }

  // ── Disease Information ───────────────────────────────────────────
  if (cropId) {
    const diseases = findDiseasesByCrop(cropId);
    if (diseases.length > 0) {
      parts.push(formatDiseaseBlock(diseases));
    }
  }

  // ── Symptom-based Keyword Match ───────────────────────────────────
  if (symptoms && symptoms.trim().length > 5) {
    const keywordResults = findByKeyword(symptoms);
    const matchedDiseases = keywordResults.diseases;

    // Only add symptom-matched diseases that aren't already listed
    const existingIds = new Set(
      cropId ? findDiseasesByCrop(cropId).map((d) => d.id) : [],
    );
    const additionalDiseases = matchedDiseases.filter(
      (d) => !existingIds.has(d.id),
    );

    if (additionalDiseases.length > 0) {
      parts.push(
        'Additional diseases matching described symptoms:\n' +
          additionalDiseases
            .slice(0, 3)
            .map((d) => `- ${d.name}: ${d.description.split('.')[0]}.`)
            .join('\n'),
      );
    }

    if (keywordResults.pests.length > 0) {
      parts.push(
        'Pests matching described symptoms:\n' +
          keywordResults.pests
            .slice(0, 2)
            .map((p) => `- ${p.name}: ${p.description.split('.')[0]}.`)
            .join('\n'),
      );
    }

    if (keywordResults.deficiencies.length > 0) {
      parts.push(
        'Nutrient deficiencies matching described symptoms:\n' +
          keywordResults.deficiencies
            .slice(0, 2)
            .map((d) => `- ${d.name}: ${d.description.split('.')[0]}.`)
            .join('\n'),
      );
    }
  }

  const output = parts.join('\n\n').trim();
  return output ? `Available Knowledge:\n\n${output}` : '';
}

function formatCropBlock(crop: KnowledgeCrop): string {
  const lines: string[] = [`Crop: ${crop.name} (${crop.scientificName})`];

  if (crop.aliases.length > 0) {
    lines.push(`Also known as: ${crop.aliases.join(', ')}`);
  }

  if (crop.growingRegions.length > 0) {
    lines.push(`Growing regions: ${crop.growingRegions.join(', ')}`);
  }

  if (crop.description) {
    lines.push(`Description: ${crop.description}`);
  }

  return lines.join('\n');
}

function formatDiseaseBlock(diseases: KnowledgeDisease[]): string {
  const lines = ['Known diseases affecting this crop:'];

  for (const disease of diseases) {
    lines.push('');
    lines.push(`  ${disease.name}${disease.scientificName ? ` (${disease.scientificName})` : ''}`);
    lines.push(`  Severity: ${disease.severity}`);

    if (disease.symptoms.length > 0) {
      lines.push(`  Common symptoms: ${disease.symptoms.slice(0, 3).join('; ')}`);
    }

    if (disease.treatments.length > 0) {
      lines.push(`  Treatments: ${disease.treatments.slice(0, 2).join('; ')}`);
    }

    if (disease.prevention.length > 0) {
      lines.push(`  Prevention: ${disease.prevention.slice(0, 2).join('; ')}`);
    }
  }

  return lines.join('\n');
}
