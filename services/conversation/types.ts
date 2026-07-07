import type { ChatMessage } from '@/types';
import type { ConversationDocument } from '@/lib/db/models/conversation.model';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import type {
  KnowledgeCrop,
  KnowledgeDisease,
  KnowledgeDeficiency,
  KnowledgeGlossaryTerm,
} from '@/types/knowledge';

// ── Lifecycle / Stage ──────────────────────────────────────────

export type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export type ConversationStage =
  | 'NEW'
  | 'COLLECTING_SYMPTOMS'
  | 'AWAITING_CLARIFICATION'
  | 'DIAGNOSING'
  | 'SHOWING_RESULT'
  | 'FOLLOW_UP'
  | 'CLOSED';

// ── Intent ─────────────────────────────────────────────────────

export type ConversationIntent =
  | 'NEW_DIAGNOSIS'
  | 'FOLLOW_UP_QUESTION'
  | 'CLARIFICATION_RESPONSE'
  | 'GENERAL_AGRICULTURE_QUESTION'
  | 'DIAGNOSIS_CORRECTION'
  | 'UNKNOWN';

export type RuleName =
  | 'QUESTION_START'
  | 'HAS_PREVIOUS_DIAGNOSIS'
  | 'NO_SYMPTOM_KEYWORDS'
  | 'SYMPTOM_MATCH'
  | 'CORRECTION_MARKER'
  | 'GENERAL_AG_KEYWORD'
  | 'SHORT_CLARIFICATION'
  | 'STAGE_AWAITING_CLARIFICATION'
  | 'KNOWLEDGE_LOOKUP';

export interface IntentClassification {
  intent: ConversationIntent;
  confidence: number;
  matchedRules: RuleName[];
  reason: string;
}

// ── Workflow / Action ──────────────────────────────────────────

export type Workflow = 'DIAGNOSIS' | 'FOLLOW_UP' | 'GENERAL_QA';

export type NextAction =
  | 'START_DIAGNOSIS'
  | 'CONTINUE_DIAGNOSIS'
  | 'ANSWER_FOLLOWUP'
  | 'ANSWER_GENERAL_QA'
  | 'ASK_CLARIFICATION';

// ── Decision ───────────────────────────────────────────────────

export interface ConversationDecision {
  status: ConversationStatus | null;
  stage: ConversationStage;
  intent: ConversationIntent;
  confidence: number;
  nextAction: NextAction;
  matchedRules: RuleName[];
  reason: string;
}

// ── Orchestrator Result ────────────────────────────────────────

export interface OrchestratorResult {
  decision: ConversationDecision;
  context: ConversationContext;
}

// ── Context ────────────────────────────────────────────────────

export interface KnowledgeContext {
  crops: KnowledgeCrop[];
  diseases: KnowledgeDisease[];
  deficiencies: KnowledgeDeficiency[];
  glossary: KnowledgeGlossaryTerm[];
  hasDirectAnswer?: string;
}

export interface ConversationContext {
  conversationId?: string;
  conversation?: ConversationDocument;
  status: ConversationStatus | null;
  stage: ConversationStage;
  latestUserMessage: string;
  recentMessages: ChatMessage[];
  latestAIResponse?: string;
  latestDiagnosis?: DiagnosisDocument;
  currentCrop?: KnowledgeCrop;
  knowledgeContext?: KnowledgeContext;
  previousRecommendations: string[];
  requiresClarification: boolean;
}

// ── State resolver ─────────────────────────────────────────────

export interface StateResult {
  status: ConversationStatus | null;
  stage: ConversationStage;
  requiresClarification: boolean;
}

// ── Loader ─────────────────────────────────────────────────────

export interface LoaderResult {
  conversation?: ConversationDocument;
  conversationId?: string;
  status: ConversationStatus | null;
}
