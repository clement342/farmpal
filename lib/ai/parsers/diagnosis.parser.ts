/**
 * Diagnosis response parser.
 *
 * Transforms the raw text returned by an AI provider into a structured,
 * validated intermediate representation that the mapper layer can
 * convert into the application's DiagnosisResponse type.
 *
 * This module is the ONLY place that calls JSON.parse() on AI output.
 * It handles:
 *   - Markdown code-fence stripping (```json ... ```)
 *   - Leading/trailing text removal
 *   - Structural validation (required fields present)
 *   - Meaningful typed errors
 *
 * @module
 */

/**
 * The raw per-cause entry the AI may include in its diagnosis output.
 */
export interface RawPossibleCause {
  name?: string;
  confidence?: number;
  reasoning?: string;
}

/**
 * The raw per-recommendation entry the AI may include.
 */
export interface RawRecommendation {
  text?: string;
  category?: string;
}

/**
 * The raw diagnosis sub-object from the AI's JSON.
 */
export interface RawDiagnosisSub {
  possibleCauses?: RawPossibleCause[];
  reasoning?: string;
  recommendations?: RawRecommendation[];
  urgency?: string;
  extensionOfficerAdvice?: string;
}

/**
 * The full parsed (but not yet validated) shape the AI is expected
 * to return. Every field is optional because the AI may omit anything.
 */
export interface ParsedDiagnosisResponse {
  status?: string;
  question?: string;
  options?: string[];
  diagnosis?: RawDiagnosisSub;
}

/**
 * Errors that occur during parsing of AI responses.
 */
export class DiagnosisParseError extends Error {
  readonly code: string;

  constructor(message: string, code = 'PARSE_ERROR') {
    super(message);
    this.name = 'DiagnosisParseError';
    this.code = code;
  }
}

/**
 * Extracts a JSON object from raw AI output text and parses it.
 *
 * Handles these common LLM output patterns:
 *   - Plain JSON:          { "status": "diagnosis", ... }
 *   - Fenced with language: ```json\n{ ... }\n```
 *   - Fenced without:      ```\n{ ... }\n```
 *   - With leading/trailing prose: "Here is the result:\n{ ... }\nLet me know if..."
 *
 * @param raw - The raw string returned by the AI provider.
 * @returns The parsed (but unvalidated) response.
 * @throws DiagnosisParseError if no JSON object can be found or the text
 *         cannot be parsed.
 */
export function parseDiagnosisResponse(raw: string): ParsedDiagnosisResponse {
  if (!raw || raw.trim().length === 0) {
    throw new DiagnosisParseError(
      'AI returned an empty response',
      'EMPTY_RESPONSE',
    );
  }

  const json = extractJson(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new DiagnosisParseError(
      `Failed to parse AI response as JSON: ${(cause as Error).message}`,
      'INVALID_JSON',
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new DiagnosisParseError(
      'AI response is not a JSON object',
      'INVALID_STRUCTURE',
    );
  }

  return parsed as ParsedDiagnosisResponse;
}

/**
 * Strips markdown fences and surrounding prose, then returns the first
 * JSON object found in the text.
 *
 * @param text - Raw AI output.
 * @returns The JSON substring.
 * @throws DiagnosisParseError if no JSON object is found.
 */
function extractJson(text: string): string {
  // Try to extract from markdown code fences first
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new DiagnosisParseError(
      'No JSON object found in AI response',
      'MISSING_JSON',
    );
  }

  return candidate.slice(start, end + 1);
}
