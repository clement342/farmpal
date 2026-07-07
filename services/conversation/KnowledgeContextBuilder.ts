import { knowledgeService } from '@/services/knowledge.service';
import type { ConversationContext, KnowledgeContext } from './types';

export class KnowledgeContextBuilder {
  async build(context: ConversationContext): Promise<KnowledgeContext | undefined> {
    try {
      const cropId = context.currentCrop?.id;
      const symptoms = context.latestUserMessage;

      const result: KnowledgeContext = {
        crops: [],
        diseases: [],
        deficiencies: [],
        glossary: [],
      };

      if (cropId) {
        result.diseases = knowledgeService.getDiseasesForCrop(cropId);
      }

      if (symptoms) {
        const searchResults = knowledgeService.search(symptoms);
        result.glossary = [];

        const directDiseaseMatch = searchResults.diseases.find(
          (d) => d.symptoms.some((s) => symptoms.toLowerCase().includes(s.toLowerCase())),
        );
        if (directDiseaseMatch && 'name' in directDiseaseMatch) {
          result.hasDirectAnswer = directDiseaseMatch.name;
        }

        result.crops = searchResults.crops;
        result.deficiencies = searchResults.deficiencies;
      }

      return result;
    } catch (error) {
      console.error('[KnowledgeContextBuilder] Failed to build knowledge context:', error);
      return undefined;
    }
  }
}
