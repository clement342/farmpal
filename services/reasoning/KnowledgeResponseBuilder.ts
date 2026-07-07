import type { DiagnosisResponse, PossibleCause, Recommendation } from '@/types';
import type { KnowledgeSearchResult } from './types';

export class KnowledgeResponseBuilder {
  buildDiagnosisResponse(result: KnowledgeSearchResult, cropName?: string): DiagnosisResponse {
    const possibleCauses: PossibleCause[] = [];
    const recommendations: Recommendation[] = [];

    for (const disease of result.diseases.slice(0, 3)) {
      possibleCauses.push({
        name: disease.name,
        confidence: 0.6,
        reasoning: disease.description.split('.')[0] + '.',
      });

      for (const treatment of disease.treatments.slice(0, 2)) {
        recommendations.push({ text: treatment, category: 'immediate_action' });
      }
      for (const prevention of disease.prevention.slice(0, 2)) {
        recommendations.push({ text: prevention, category: 'preventive' });
      }
    }

    for (const def of result.deficiencies.slice(0, 2)) {
      possibleCauses.push({
        name: def.name,
        confidence: 0.4,
        reasoning: def.description.split('.')[0] + '.',
      });

      for (const treatment of def.treatments.slice(0, 1)) {
        recommendations.push({ text: treatment, category: 'immediate_action' });
      }
    }

    if (possibleCauses.length === 0) {
      const cropPrefix = cropName ? ` regarding your ${cropName}` : '';
      const question = `Thank you for the details${cropPrefix}. I can see something is affecting your plant, but I need more specific information to identify the problem. Could you tell me:\n\n1. Which part of the plant is affected — roots, leaves, stem, or fruit?\n2. What do the symptoms look like — spots, wilting, rot, discoloration?\n3. How long have you noticed these symptoms?\n4. Have there been recent weather changes like heavy rain or drought?`;
      return {
        status: 'follow_up',
        question,
        options: [
          'Leaves have spots or discoloration',
          'Roots are rotting or mushy',
          'Stem has lesions or wilting',
          'Whole plant looks unhealthy',
        ],
      };
    }

    if (recommendations.length === 0) {
      recommendations.push({
        text: 'Monitor the affected plants and consult an expert if symptoms persist',
        category: 'consultation',
      });
    }

    const reasoning = result.diseases.length > 0
      ? `Based on the symptoms described, the following conditions may be affecting your ${cropName ?? 'crop'}.`
      : 'The symptoms match several possible conditions. Review the possible causes below.';

    return {
      status: 'diagnosis',
      diagnosis: {
        possibleCauses,
        reasoning,
        recommendations,
        urgency: 'moderate',
        extensionOfficerAdvice: 'If symptoms worsen despite applying the recommended actions, consult your local agricultural extension officer.',
      },
    };
  }

  buildFollowUpResponse(question: string, options?: string[]): DiagnosisResponse {
    return {
      status: 'follow_up',
      question,
      options,
    };
  }
}
