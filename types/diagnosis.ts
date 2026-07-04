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
 * Request payload to initiate a diagnosis.
 */
export interface DiagnosisRequest {
  /** Symptoms described by the farmer */
  symptoms: string;
  /** The affected crop */
  cropId: string;
  /** Optional image URLs for visual analysis */
  imageUrls?: string[];
  /** Additional context provided by the farmer */
  context?: Record<string, string>;
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
