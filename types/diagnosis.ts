/**
 * Severity level of a diagnosis.
 */
export type SeverityLevel = 'low' | 'moderate' | 'high' | 'critical';

/**
 * A single crop disease diagnosis.
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
 * Full response from the diagnosis pipeline.
 */
export interface DiagnosisResponse {
  /** Whether the system needs more information */
  requiresClarification: boolean;
  /** Follow-up questions if clarification is needed */
  followUpQuestions?: string[];
  /** The diagnosis (present when clarification is not needed) */
  diagnosis?: Diagnosis;
}
