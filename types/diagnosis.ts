/**
 * Severity level of a diagnosis.
 */
export type SeverityLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * Urgency level communicated to the farmer.
 */
export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * A single possible cause within a diagnosis result.
 */
export interface PossibleCause {
  /** Name of the disease or condition */
  name: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Brief explanation of why this is suspected */
  reasoning: string;
}

/**
 * A recommendation returned alongside a diagnosis.
 */
export interface Recommendation {
  /** The recommendation text */
  text: string;
  /** Category for display purposes */
  category: 'immediate_action' | 'preventive' | 'consultation';
}

/**
 * The structured diagnosis result returned when the AI has enough information.
 */
export interface DiagnosisResult {
  /** Possible causes ranked by confidence */
  possibleCauses: PossibleCause[];
  /** Summary reasoning for the diagnosis */
  reasoning: string;
  /** Actionable recommendations */
  recommendations: Recommendation[];
  /** Urgency level for the farmer */
  urgency: UrgencyLevel;
  /** When to consult an agricultural extension officer */
  extensionOfficerAdvice?: string;
}

/**
 * A single crop disease diagnosis (persisted record).
 */
export interface Diagnosis {
  /** Unique identifier */
  id: string;
  /** The diagnosed disease or condition */
  diseaseName: string;
  /** Affected crop */
  cropName: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Reasoning behind the diagnosis */
  reasoning: string;
  /** Severity assessment */
  severity: SeverityLevel;
  /** Recommended actions */
  immediateActions: string[];
  /** Preventive recommendations */
  preventiveMeasures: string[];
  /** When to consult an expert */
  extensionOfficerAdvice?: string;
  /** ISO 8601 timestamp */
  createdAt: string;
}

/**
 * Request payload to initiate or continue a diagnosis.
 *
 * If `conversationId` is omitted a new conversation is created.
 * If provided the existing conversation is loaded and the new
 * message is appended before calling the AI.
 */
export interface DiagnosisRequest {
  /** Symptoms described by the farmer */
  symptoms: string;
  /** The affected crop (optional — omit to let the system infer from symptoms) */
  cropId?: string;
  /** Resume an existing conversation (optional — creates new if omitted) */
  conversationId?: string;
  /** Optional image URLs for visual analysis */
  imageUrls?: string[];
  /** Additional context provided by the farmer */
  context?: Record<string, string>;
}

/**
 * Response wrapper returned by the conversation-aware diagnosis endpoint.
 */
export interface ConversationDiagnosisResponse {
  /** The conversation this diagnosis belongs to */
  conversationId: string;
  /** Current conversation status */
  status: 'ACTIVE' | 'COMPLETED';
  /** The diagnosis result (follow_up or completed diagnosis) */
  response: DiagnosisResponse;
}

/**
 * Response from the diagnosis pipeline.
 *
 * Supports two states:
 * - `follow_up` — the AI needs more information before diagnosing
 * - `diagnosis` — the AI has reached a conclusion
 */
export type DiagnosisResponse =
  | {
      status: 'follow_up';
      /** Follow-up question for the farmer */
      question: string;
      /** Predefined answer options (optional) */
      options?: string[];
    }
  | {
      status: 'diagnosis';
      /** The structured diagnosis result */
      diagnosis: DiagnosisResult;
    };
