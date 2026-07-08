import { knowledgeService } from '@/services/knowledge.service';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';
import { parseDiagnosisResponse } from '@/lib/ai/parsers/diagnosis-response.parser';
import { mapToDiagnosisResponse } from '@/adapters/diagnosis/mapper';
import { KnowledgeResponseBuilder } from './KnowledgeResponseBuilder';
import { ConfidenceEvaluator } from './ConfidenceEvaluator';
import type { KnowledgeSearchResult, AnswerDiagnosisParams, AnswerGeneralQuestionParams, ReasoningLogEntry } from './types';
import type { DiagnosisResponse, ChatResponse, ChatMessage } from '@/types';
import type { KnowledgeDisease, KnowledgeDeficiency } from '@/types/knowledge';

export class ReasoningEngine {
  private knowledgeBuilder = new KnowledgeResponseBuilder();
  private confidenceEvaluator: ConfidenceEvaluator;

  constructor(options?: { threshold?: number }) {
    this.confidenceEvaluator = new ConfidenceEvaluator({ threshold: options?.threshold ?? 0.7 });
  }

  async answerDiagnosis(params: AnswerDiagnosisParams): Promise<DiagnosisResponse> {
    const startTime = Date.now();
    const { request, crop } = params;

    const knowledgeResult = this.searchKnowledge(request.symptoms, request.cropId);
    const evaluation = this.confidenceEvaluator.evaluate(knowledgeResult, request.cropId);

    let response: DiagnosisResponse;
    let usedAI = false;
    let fallbackTriggered = false;

    if (evaluation.isHighConfidence) {
      response = this.knowledgeBuilder.buildDiagnosisResponse(knowledgeResult, crop?.name);
    } else {
      usedAI = true;
      try {
        response = await this.invokeAI(request, crop, params.existingMessages, knowledgeResult);
      } catch {
        fallbackTriggered = true;
        response = this.knowledgeBuilder.buildDiagnosisResponse(knowledgeResult, crop?.name);
      }
    }

    const latencyMs = Date.now() - startTime;
    this.log({
      knowledgeConfidence: evaluation.score,
      knowledgeHits: knowledgeResult.totalKeywordHits,
      usedAI,
      fallbackTriggered,
      provider: usedAI ? 'ai' : 'knowledge',
      latencyMs,
    });

    return response;
  }

  async answerGeneralQuestion(params: AnswerGeneralQuestionParams): Promise<ChatResponse> {
    const startTime = Date.now();
    const { messages, cropContext } = params;

    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const cropId = cropContext?.cropId;
    const knowledgeResult = this.searchKnowledge(lastUserMessage, cropId);
    const evaluation = this.confidenceEvaluator.evaluate(knowledgeResult, cropId);

    let response: ChatResponse;
    let usedAI = false;
    let fallbackTriggered = false;

    if (evaluation.isHighConfidence && knowledgeResult.diseases.length > 0) {
      const kbResponse = this.knowledgeBuilder.buildDiagnosisResponse(knowledgeResult);
      const text = kbResponse.status === 'diagnosis'
        ? kbResponse.diagnosis.reasoning
        : kbResponse.question;
      response = {
        message: {
          id: crypto.randomUUID(),
          content: text,
          role: 'assistant',
          createdAt: new Date().toISOString(),
        },
        suggestions: ['Tell me more', 'What should I do?', 'Is this serious?'],
      };
    } else {
      usedAI = true;
      try {
        const extraContext = cropContext?.cropName
          ? `Crop: ${cropContext.cropName}`
          : undefined;
        const aiMessages = buildSystemMessages('chat', messages, extraContext);
        const rawText = await infer(aiMessages, { task: 'chat', temperature: 0.3 });
        response = {
          message: {
            id: crypto.randomUUID(),
            content: rawText,
            role: 'assistant',
            createdAt: new Date().toISOString(),
          },
          suggestions: [
            'Tell me more about the symptoms',
            'Which crop is affected?',
            'When did you first notice this?',
          ],
        };
      } catch {
        fallbackTriggered = true;
        const fallbackText = knowledgeResult.diseases.length > 0
          ? knowledgeResult.diseases.map(d => `- ${d.name}: ${d.description.split('.')[0]}.`).join('\n')
          : 'I found some general information that might help. Could you describe the issue in more detail?';
        response = {
          message: {
            id: crypto.randomUUID(),
            content: fallbackText,
            role: 'assistant',
            createdAt: new Date().toISOString(),
          },
        };
      }
    }

    const latencyMs = Date.now() - startTime;
    this.log({
      knowledgeConfidence: evaluation.score,
      knowledgeHits: knowledgeResult.totalKeywordHits,
      usedAI,
      fallbackTriggered,
      provider: usedAI ? 'ai' : 'knowledge',
      latencyMs,
    });

    return response;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all',
      'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been',
      'some', 'what', 'when', 'where', 'which', 'their', 'there', 'about',
      'would', 'could', 'should', 'with', 'from', 'that', 'this', 'they',
      'your', 'will', 'more', 'than', 'into', 'them', 'just', 'also', 'very',
      'what', 'does', 'get', 'its', 'than', 'been', 'being', 'were', 'their',
      'like', 'over', 'such', 'don', 'here', 'there', 'after', 'then']);
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  private searchKnowledge(symptoms: string, cropId?: string): KnowledgeSearchResult {
    const keywords = this.extractKeywords(symptoms);

    if (keywords.length === 0) {
      return { diseases: [], deficiencies: [], matchedSymptomCount: 0, totalKeywordHits: 0 };
    }

    if (cropId) {
      return this.searchWithCrop(keywords, cropId);
    }

    return this.searchWithoutCrop(keywords, symptoms);
  }

  private searchWithCrop(
    keywords: string[],
    cropId: string,
  ): KnowledgeSearchResult {
    const allDiseases = knowledgeService.getDiseasesForCrop(cropId);

    const diseaseMatches = allDiseases.filter(d =>
      keywords.some(kw =>
        d.name.toLowerCase().includes(kw) ||
        d.description.toLowerCase().includes(kw) ||
        d.symptoms.some(s => s.toLowerCase().includes(kw)),
      ),
    );

    const defMatches = knowledgeService.getDeficienciesForCrop(cropId).filter(d =>
      keywords.some(kw =>
        d.name.toLowerCase().includes(kw) ||
        d.description.toLowerCase().includes(kw) ||
        d.symptoms.some(s => s.toLowerCase().includes(kw)),
      ),
    );

    const totalHits = diseaseMatches.length + defMatches.length;
    const matchedKeywords = keywords.filter(kw =>
      diseaseMatches.some(d =>
        d.name.toLowerCase().includes(kw) ||
        d.symptoms.some(s => s.toLowerCase().includes(kw)),
      ) || defMatches.some(d =>
        d.name.toLowerCase().includes(kw) ||
        d.symptoms.some(s => s.toLowerCase().includes(kw)),
      ),
    );

    return {
      diseases: diseaseMatches,
      deficiencies: defMatches,
      matchedSymptomCount: matchedKeywords.length,
      totalKeywordHits: totalHits,
    };
  }

  private searchWithoutCrop(
    keywords: string[],
    symptoms: string,
  ): KnowledgeSearchResult {
    const cropInference = knowledgeService.inferCrop(symptoms);
    if (cropInference.detected && cropInference.crop) {
      return this.searchWithCrop(keywords, cropInference.crop.id);
    }

    return { diseases: [], deficiencies: [], matchedSymptomCount: 0, totalKeywordHits: 0 };
  }

  private async invokeAI(
    request: { symptoms: string; cropId?: string },
    crop?: { id?: string; name?: string; regions?: string[] },
    existingMessages?: ChatMessage[],
    knowledge?: KnowledgeSearchResult,
  ): Promise<DiagnosisResponse> {
    const messages = this.buildAIPrompt(request, crop, existingMessages, knowledge);
    const rawText = await infer(messages, { task: 'diagnosis', temperature: 0.3 });
    const parsed = parseDiagnosisResponse(rawText);

    if (!parsed.success) {
      throw parsed.error;
    }

    return mapToDiagnosisResponse(parsed.data);
  }

  private buildAIPrompt(
    request: { symptoms: string; cropId?: string },
    crop?: { id?: string; name?: string; regions?: string[] },
    existingMessages?: ChatMessage[],
    knowledge?: KnowledgeSearchResult,
  ): ChatMessage[] {
    const parts: string[] = [];

    if (crop?.name) {
      parts.push(`Crop: ${crop.name}`);
    }

    if (knowledge && knowledge.diseases.length > 0) {
      const diseaseContext = knowledge.diseases.slice(0, 3).map(d =>
        `- ${d.name}: ${d.description.split('.')[0]}.`,
      ).join('\n');
      parts.push(`Known conditions that may be relevant:\n${diseaseContext}`);
    }

    const extraContext = parts.length > 0 ? parts.join('\n\n') : undefined;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: request.symptoms,
      createdAt: new Date().toISOString(),
    };

    const history = existingMessages ?? [];
    const allMessages = [...history, newMessage];

    return buildSystemMessages('diagnosis', allMessages, extraContext);
  }

  private log(entry: ReasoningLogEntry): void {
    console.log('[ReasoningEngine]', JSON.stringify(entry));
  }
}

export const reasoningEngine = new ReasoningEngine();
