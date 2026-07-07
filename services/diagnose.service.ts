import type { ChatMessage } from '@/types';
import type { Diagnosis, DiagnosisRequest, DiagnosisResponse } from '@/types';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';
import { parseDiagnosisResponse } from '@/lib/ai/diagnosis-parser';
import { createLogger } from '@/lib/ai/logger';

const log = createLogger('service:diagnose');

/**
 * Diagnosis service.
 *
 * Orchestrates the crop disease diagnosis pipeline using the AI inference
 * layer. Routes through OllamaProvider (offline-first) with automatic
 * fallback to the configured cloud provider when Ollama is unavailable.
 *
 * ## Workflow
 *
 * 1. Build a user message from the diagnosis request (symptoms + context).
 * 2. Prepend the diagnosis system prompt via `buildSystemMessages()`.
 * 3. Call `infer()` at low temperature for deterministic output.
 * 4. Parse the model's JSON response via `parseDiagnosisResponse()`.
 * 5. If parsing fails, return a safe clarification fallback rather than 503.
 *
 * ## Single-request contract
 *
 * The API route and controller expect a single request → single response.
 * The clarification loop (farmer answers questions, sends another request)
 * is managed by the frontend — each call to this service is stateless.
 *
 * ## Error behaviour
 *
 * - `AIServiceError` is thrown when no provider is available (Ollama down,
 *   no cloud configured). The route handler maps this to HTTP 503.
 * - JSON parse failures are handled gracefully: the service returns a
 *   clarification response with a generic question rather than a 503.
 */

// ---------------------------------------------------------------------------
// Fallback response used when the model output cannot be parsed
// ---------------------------------------------------------------------------

const PARSE_FAILURE_FALLBACK: DiagnosisResponse = {
  requiresClarification: true,
  followUpQuestions: [
    'Could you describe the symptoms in more detail?',
    'Which part of the plant is affected — leaves, stem, roots, or fruit?',
    'How long ago did you first notice the problem?',
  ],
};

// ---------------------------------------------------------------------------
// createDiagnosis
// ---------------------------------------------------------------------------

/**
 * Initiates an AI-powered crop disease diagnosis.
 *
 * Sends the farmer's symptoms to the AI model and returns either a
 * completed diagnosis or targeted follow-up questions, depending on
 * whether the model has enough information to diagnose confidently.
 *
 * @param request - The validated diagnosis request.
 * @returns A `DiagnosisResponse` with either questions or a diagnosis.
 * @throws AIServiceError if no AI provider is available.
 */
export async function createDiagnosis(
  request: DiagnosisRequest,
): Promise<DiagnosisResponse> {
  const { symptoms, cropId, context } = request;

  // Build extra context to append to the system prompt.
  // This gives the model the crop ID and any additional key/value pairs
  // the caller supplied (e.g. region, growth stage) without requiring
  // changes to the system prompt template.
  const contextLines: string[] = [`Crop: ${cropId}`];
  if (context && Object.keys(context).length > 0) {
    for (const [key, value] of Object.entries(context)) {
      contextLines.push(`${key}: ${value}`);
    }
  }
  const extraContext = contextLines.join('\n');

  // The user message is the raw symptom description. Keep it plain —
  // the system prompt already frames the task for the model.
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: symptoms.trim(),
    createdAt: new Date().toISOString(),
  };

  const messages = buildSystemMessages('diagnosis', [userMessage], extraContext);

  log.info('Starting diagnosis inference', {
    cropId,
    symptomsLength: symptoms.length,
    hasContext: !!context,
  });

  // temperature: 0.2 — deterministic enough for structured JSON output
  // while allowing the model some flexibility in phrasing. Lower than
  // chat (0.7) because JSON schema compliance matters more than creativity.
  const raw = await infer(messages, { task: 'diagnosis', temperature: 0.2 });

  log.debug('Raw diagnosis response received', {
    length: raw.length,
    preview: raw.slice(0, 150),
  });

  const parsed = parseDiagnosisResponse(raw, cropId);

  if (!parsed) {
    // The model produced output but it could not be parsed as valid JSON
    // matching the expected schema. Log the full raw output for debugging
    // and return a safe clarification response rather than a 503.
    log.warn('Diagnosis parse failed — returning clarification fallback', {
      cropId,
      rawLength: raw.length,
      raw,
    });
    return PARSE_FAILURE_FALLBACK;
  }

  log.info('Diagnosis inference complete', {
    cropId,
    requiresClarification: parsed.requiresClarification,
    ...(parsed.diagnosis && {
      diseaseName: parsed.diagnosis.diseaseName,
      confidence: parsed.diagnosis.confidence,
      severity: parsed.diagnosis.severity,
    }),
  });

  return parsed;
}

// ---------------------------------------------------------------------------
// getDiagnosisById
// ---------------------------------------------------------------------------

/**
 * Retrieves a single diagnosis by its ID.
 *
 * @param id - The diagnosis identifier.
 * @returns The diagnosis record, or null if not found.
 *
 * TODO: Implement database lookup once persistence is added.
 */
export async function getDiagnosisById(id: string): Promise<Diagnosis | null> {
  void id;
  return null;
}
