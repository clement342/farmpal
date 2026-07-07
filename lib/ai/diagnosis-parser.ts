/**
 * Parser for AI-generated diagnosis responses.
 *
 * Local models (gemma4:e2b and similar) frequently wrap JSON output in
 * markdown code fences, add a preamble sentence, or emit trailing prose
 * after the closing brace. This module isolates all that messiness from
 * the service layer.
 *
 * ## What it handles
 *
 * - Raw JSON: `{"requiresClarification":true,...}`
 * - Fenced JSON: ` ```json\n{...}\n``` `
 * - JSON with leading prose: `Here is my assessment:\n{...}`
 * - JSON with trailing prose: `{...}\nLet me know if you need more.`
 * - Nested quotes and escaped characters inside field values
 *
 * ## What it does NOT do
 *
 * - It does not repair malformed JSON (missing commas, unquoted keys, etc.)
 * - It does not retry inference — that is the caller's responsibility
 * - It does not throw — it returns `null` on any parse failure
 *
 * @module
 */

import type { DiagnosisResponse } from '@/types';
import type { SeverityLevel } from '@/types/diagnosis';
import { createLogger } from './logger';

const log = createLogger('ai:diagnosis-parser');

// ---------------------------------------------------------------------------
// Internal shape of the raw model JSON (before mapping to domain types)
// ---------------------------------------------------------------------------

/** Shape of the clarification branch from the model. */
interface RawClarificationResponse {
  requiresClarification: true;
  followUpQuestions: unknown[];
}

/** Shape of the diagnosis branch from the model. */
interface RawDiagnosisResponse {
  requiresClarification: false;
  diagnosis: {
    diseaseName: unknown;
    confidence: unknown;
    reasoning: unknown;
    severity: unknown;
    immediateActions: unknown;
    preventiveMeasures: unknown;
    extensionOfficerAdvice?: unknown;
  };
}

type RawModelResponse = RawClarificationResponse | RawDiagnosisResponse;

// ---------------------------------------------------------------------------
// Valid severity values
// ---------------------------------------------------------------------------

const VALID_SEVERITIES: SeverityLevel[] = ['low', 'moderate', 'high', 'critical'];

function isValidSeverity(value: unknown): value is SeverityLevel {
  return typeof value === 'string' && (VALID_SEVERITIES as string[]).includes(value);
}

// ---------------------------------------------------------------------------
// JSON extraction
// ---------------------------------------------------------------------------

/**
 * Extracts the first complete JSON object from a raw model output string.
 *
 * Tries three strategies in order:
 * 1. Direct parse (model returned clean JSON).
 * 2. Extract from a markdown code fence (```json ... ``` or ``` ... ```).
 * 3. Scan for the first `{` and last `}` and parse the substring.
 *
 * Returns `null` if all three strategies fail.
 */
function extractJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();

  // Strategy 1: direct parse
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }

  // Strategy 2: markdown code fence
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim()) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }

  // Strategy 3: first { ... last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Shape validation helpers
// ---------------------------------------------------------------------------

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function toStringArray(value: unknown): string[] | null {
  if (!isStringArray(value)) return null;
  return value.map((s) => s.trim()).filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

/**
 * Parses the raw string output from the diagnosis model into a typed
 * `DiagnosisResponse`.
 *
 * Returns `null` if the output cannot be parsed or fails shape validation.
 * Never throws.
 *
 * @param raw    - The raw string returned by `infer()`.
 * @param cropId - Used to populate `Diagnosis.cropName` (the model does not
 *                 know the crop name, only the symptoms).
 */
export function parseDiagnosisResponse(
  raw: string,
  cropId: string,
): DiagnosisResponse | null {
  // Step 1: extract a JSON object from the raw string
  const obj = extractJson(raw);
  if (!obj) {
    log.warn('Failed to extract JSON from model output', {
      rawLength: raw.length,
      rawPreview: raw.slice(0, 200),
    });
    return null;
  }

  // Step 2: check the top-level discriminator
  const { requiresClarification } = obj;

  if (requiresClarification === true) {
    return parseClarificationResponse(obj as unknown as RawClarificationResponse);
  }

  if (requiresClarification === false) {
    return parseDiagnosisFields(
      obj as unknown as RawDiagnosisResponse,
      cropId,
    );
  }

  log.warn('Model output missing requiresClarification field', {
    keys: Object.keys(obj).join(', '),
  });
  return null;
}

// ---------------------------------------------------------------------------
// Branch parsers
// ---------------------------------------------------------------------------

function parseClarificationResponse(
  obj: RawClarificationResponse,
): DiagnosisResponse | null {
  const questions = toStringArray(obj.followUpQuestions);
  if (!questions) {
    log.warn('Clarification response has invalid followUpQuestions', {
      value: JSON.stringify(obj.followUpQuestions),
    });
    return null;
  }

  // Enforce the prompt's maximum of 3 questions
  return {
    requiresClarification: true,
    followUpQuestions: questions.slice(0, 3),
  };
}

function parseDiagnosisFields(
  obj: RawDiagnosisResponse,
  cropId: string,
): DiagnosisResponse | null {
  const d = obj.diagnosis;
  if (!d || typeof d !== 'object') {
    log.warn('Diagnosis response missing diagnosis object');
    return null;
  }

  const diseaseName =
    typeof d.diseaseName === 'string' && d.diseaseName.trim().length > 0
      ? d.diseaseName.trim()
      : null;
  if (!diseaseName) {
    log.warn('Diagnosis missing diseaseName');
    return null;
  }

  const confidence =
    typeof d.confidence === 'number' &&
    d.confidence >= 0 &&
    d.confidence <= 1
      ? d.confidence
      : null;
  if (confidence === null) {
    log.warn('Diagnosis has invalid confidence', { value: d.confidence });
    return null;
  }

  const reasoning =
    typeof d.reasoning === 'string' && d.reasoning.trim().length > 0
      ? d.reasoning.trim()
      : null;
  if (!reasoning) {
    log.warn('Diagnosis missing reasoning');
    return null;
  }

  if (!isValidSeverity(d.severity)) {
    log.warn('Diagnosis has invalid severity', { value: d.severity });
    return null;
  }

  const immediateActions = toStringArray(d.immediateActions);
  if (!immediateActions) {
    log.warn('Diagnosis has invalid immediateActions', {
      value: JSON.stringify(d.immediateActions),
    });
    return null;
  }

  const preventiveMeasures = toStringArray(d.preventiveMeasures);
  if (!preventiveMeasures) {
    log.warn('Diagnosis has invalid preventiveMeasures', {
      value: JSON.stringify(d.preventiveMeasures),
    });
    return null;
  }

  const extensionOfficerAdvice =
    typeof d.extensionOfficerAdvice === 'string' &&
    d.extensionOfficerAdvice.trim().length > 0
      ? d.extensionOfficerAdvice.trim()
      : undefined;

  return {
    requiresClarification: false,
    diagnosis: {
      id: crypto.randomUUID(),
      diseaseName,
      cropName: cropId,      // cropId is the best available identifier until a crop DB exists
      confidence,
      reasoning,
      severity: d.severity,
      immediateActions,
      preventiveMeasures,
      ...(extensionOfficerAdvice !== undefined && { extensionOfficerAdvice }),
      createdAt: new Date().toISOString(),
    },
  };
}
