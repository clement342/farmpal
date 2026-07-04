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
 *   - Meaningful typed errors via ParseResult (no thrown exceptions)
 *
 * @module
 */

/**
 * Discriminated union representing either a successful parse or a
 * typed failure. Use this instead of try/catch for predictable
 * error handling.
 */
export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: DiagnosisResponseParseError };

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
 * Typed error for parsing failures. Carries a machine-readable `code`
 * so callers can handle specific failure modes without parsing the
 * message string.
 */
export class DiagnosisResponseParseError extends Error {
  readonly code: string;

  constructor(message: string, code = 'PARSE_ERROR') {
    super(message);
    this.name = 'DiagnosisResponseParseError';
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
 * Returns a `ParseResult` rather than throwing, making error handling
 * predictable and composable for the caller.
 *
 * @param raw - The raw string returned by the AI provider.
 * @returns A ParseResult containing either the parsed response or a
 *          typed error.
 */
export function parseDiagnosisResponse(
  raw: string,
): ParseResult<ParsedDiagnosisResponse> {
  if (!raw || raw.trim().length === 0) {
    return failure('AI returned an empty response', 'EMPTY_RESPONSE');
  }

  const json = extractJson(raw);
  if (!json.success) {
    return json;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(json.data);
  } catch (cause) {
    return failure(
      `Failed to parse AI response as JSON: ${(cause as Error).message}`,
      'INVALID_JSON',
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return failure('AI response is not a JSON object', 'INVALID_STRUCTURE');
  }

  return { success: true, data: parsed as ParsedDiagnosisResponse };
}

/**
 * Attempts to extract the first JSON object from raw AI text.
 *
 * Strips markdown code fences and surrounding prose before searching
 * for the outermost `{ }` pair.
 *
 * @returns A ParseResult containing the JSON substring on success.
 */
function extractJson(text: string): ParseResult<string> {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return failure('No JSON object found in AI response', 'MISSING_JSON');
  }

  return { success: true, data: candidate.slice(start, end + 1) };
}

/**
 * Convenience helper for creating failure results.
 */
function failure(message: string, code: string): ParseResult<never> {
  return {
    success: false,
    error: new DiagnosisResponseParseError(message, code),
  };
}
