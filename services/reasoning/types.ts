import type { ChatMessage, Crop } from '@/types';
import type { DiagnosisRequest } from '@/types/diagnosis';
import type { KnowledgeDisease, KnowledgeDeficiency } from '@/types/knowledge';

export interface KnowledgeSearchResult {
  diseases: KnowledgeDisease[];
  deficiencies: KnowledgeDeficiency[];
  matchedSymptomCount: number;
  totalKeywordHits: number;
}

export interface ConfidenceEvaluation {
  score: number;
  threshold: number;
  isHighConfidence: boolean;
  reason: string;
}

export interface ReasoningLogEntry {
  knowledgeConfidence: number;
  knowledgeHits: number;
  usedAI: boolean;
  fallbackTriggered: boolean;
  provider: string;
  latencyMs: number;
}

export interface AnswerDiagnosisParams {
  request: DiagnosisRequest;
  crop?: Crop;
  existingMessages?: ChatMessage[];
}

export type AnswerGeneralQuestionParams = {
  messages: ChatMessage[];
  cropContext?: { cropId: string; cropName: string };
};
