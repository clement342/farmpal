/**
 * Production AI adapter for crop disease diagnosis.
 *
 * This is the default adapter used when `USE_MOCK_AI` is not set to `true`.
 * It orchestrates the full AI-driven diagnosis pipeline:
 *
 *   1. Build a system message with crop context via `buildSystemMessages()`
 *   2. Send the conversation to the AI provider via `infer()`
 *   3. Parse the raw provider output via `parseDiagnosisResponse()`
 *   4. Map the parsed output to `DiagnosisResponse` via `mapToDiagnosisResponse()`
 *
 * The service layer only sees `generateDiagnosis()` — none of the above
 * steps are visible outside this class.
 *
 * ## Adding a new AI provider
 *
 * If a new provider (e.g. Cloud Gemma) needs different prompt construction,
 * parsing, or mapping, extend this class or create a new adapter that
 * implements the same public interface. Swap via the adapter factory.
 *
 * TODO:
 * - Add configurable temperature / maxTokens via constructor options.
 * - Add support for multi-turn conversations (pass conversation history).
 * - Add telemetry / tracing for adapter latency.
 *
 * @module
 */

import type { ChatMessage } from '@/types';
import type { Crop } from '@/types/crop';
import type { DiagnosisRequest, DiagnosisResponse } from '@/types/diagnosis';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';
import { parseDiagnosisResponse, DiagnosisParseError } from '@/lib/ai/parsers/diagnosis.parser';
import { mapToDiagnosisResponse } from './mapper';

/**
 * Human-readable identifier persisted in diagnosis records.
 */
export const PROVIDER_NAME = 'ai';

export class DiagnosisAIAdapter {
  /**
   * Generates a diagnosis response from the AI provider.
   *
   * @param request - The diagnosis request containing symptoms and crop ID.
   * @param crop    - Optional crop document for context injection.
   * @returns A fully-formed DiagnosisResponse.
   * @throws DiagnosisParseError if the AI output cannot be parsed.
   */
  async generateDiagnosis(
    request: DiagnosisRequest,
    crop?: Crop,
  ): Promise<DiagnosisResponse> {
    const messages = this.buildRequestMessages(request, crop);

    const rawText = await infer(messages, {
      task: 'diagnosis',
      temperature: 0.3,
    });

    const parsed = parseDiagnosisResponse(rawText);
    return mapToDiagnosisResponse(parsed);
  }

  /**
   * Builds the full ChatMessage array for the AI provider.
   *
   * Includes:
   *   - The diagnosis system prompt (injected by buildSystemMessages)
   *   - Optional crop/region context
   *   - The user's symptom description
   */
  private buildRequestMessages(
    request: DiagnosisRequest,
    crop?: Crop,
  ): ChatMessage[] {
    const cropContext = crop
      ? `Crop: ${crop.name}${crop.regions?.length ? `, Region: ${crop.regions.join(', ')}` : ''}`
      : undefined;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: request.symptoms,
      createdAt: new Date().toISOString(),
    };

    return buildSystemMessages('diagnosis', [userMessage], cropContext);
  }
}

/**
 * Module-level singleton adapter instance.
 *
 * Used by the adapter factory so it can reference a single named export
 * without needing to know about class instantiation.
 */
const defaultAdapter = new DiagnosisAIAdapter();

/**
 * Convenience function matching the `GenerateDiagnosisFn` signature
 * consumed by the adapter factory.
 *
 * @param request - Diagnosis request payload.
 * @param crop    - Optional crop context.
 * @returns A diagnosis response.
 */
export async function generateDiagnosis(
  request: DiagnosisRequest,
  crop?: Crop,
): Promise<DiagnosisResponse> {
  return defaultAdapter.generateDiagnosis(request, crop);
}
