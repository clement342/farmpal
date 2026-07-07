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
 * The service layer only sees `generateDiagnosis()` and `streamDiagnosis()` —
 * none of the above steps are visible outside this class.
 *
 * ## Streaming
 *
 * `streamDiagnosis()` returns an `AsyncGenerator` that yields raw text chunks
 * as they become available. Currently the provider infrastructure returns the
 * full response at once, so the generator yields a single chunk. When the
 * provider layer gains true streaming support, this method can yield chunks
 * incrementally — no service or controller changes required.
 *
 * ## Adding a new AI provider
 *
 * If a new provider (e.g. Cloud Gemma) needs different prompt construction,
 * parsing, or mapping, extend this class or create a new adapter that
 * implements the same public interface. Swap via the adapter factory.
 *
 * TODO:
 * - Add configurable temperature / maxTokens via constructor options.
 * - Add telemetry / tracing for adapter latency.
 *
 * @module
 */

import type { ChatMessage } from '@/types';
import type { Crop } from '@/types/crop';
import type { DiagnosisRequest, DiagnosisResponse } from '@/types/diagnosis';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';
import { parseDiagnosisResponse } from '@/lib/ai/parsers/diagnosis-response.parser';
import { mapToDiagnosisResponse } from './mapper';
import { knowledgeService } from '@/services/knowledge.service';

/**
 * Human-readable identifier persisted in diagnosis records.
 */
export const PROVIDER_NAME = 'ai';

export class DiagnosisAIAdapter {
  /**
   * Generates a diagnosis response from the AI provider.
   *
   * For single-turn use, pass the request with symptoms and optional crop.
   * For multi-turn conversations, also pass `existingMessages` — the adapter
   * appends the new user message to the existing history before sending.
   *
   * @param request           - The diagnosis request containing symptoms and crop ID.
   * @param crop              - Optional crop document for context injection.
   * @param existingMessages  - Prior conversation history (for multi-turn).
   * @returns A fully-formed DiagnosisResponse.
   * @throws DiagnosisResponseParseError if the AI output cannot be parsed.
   */
  async generateDiagnosis(
    request: DiagnosisRequest,
    crop?: Crop,
    existingMessages?: ChatMessage[],
  ): Promise<DiagnosisResponse> {
    const messages = this.buildRequestMessages(request, crop, existingMessages);

    const rawText = await infer(messages, {
      task: 'diagnosis',
      temperature: 0.3,
    });

    const result = parseDiagnosisResponse(rawText);

    if (!result.success) {
      throw result.error;
    }

    return mapToDiagnosisResponse(result.data);
  }

  /**
   * Streams a diagnosis response from the AI provider.
   *
   * Yields raw text chunks as they become available. When the provider
   * layer gains true streaming support, chunks will arrive incrementally.
   * Currently yields the complete response as a single chunk (wrapping
   * the non-streaming `infer()` call).
   *
   * The caller is responsible for:
   *   - Collecting chunks into the complete text
   *   - Parsing the complete text via `parseDiagnosisResponse()`
   *   - Handling persistence after the generator exhausts
   *
   * @param request           - The diagnosis request.
   * @param crop              - Optional crop document for context.
   * @param existingMessages  - Prior conversation history (multi-turn).
   * @yields Raw text chunks from the AI provider.
   */
  async *streamDiagnosis(
    request: DiagnosisRequest,
    crop?: Crop,
    existingMessages?: ChatMessage[],
  ): AsyncGenerator<string> {
    const messages = this.buildRequestMessages(request, crop, existingMessages);

    const rawText = await infer(messages, {
      task: 'diagnosis',
      temperature: 0.3,
    });

    yield rawText;
  }

  /**
   * Builds the full ChatMessage array for the AI provider.
   *
   * Includes:
   *   - The diagnosis system prompt (injected by buildSystemMessages)
   *   - Optional crop/region context
   *   - Prior conversation history (if continuing a conversation)
   *   - The new user symptom description
   */
  private buildRequestMessages(
    request: DiagnosisRequest,
    crop?: Crop,
    existingMessages?: ChatMessage[],
  ): ChatMessage[] {
    // ── Build crop context ───────────────────────────────────────
    const parts: string[] = [];

    if (crop) {
      const regionStr = crop.regions?.length
        ? `, Region: ${crop.regions.join(', ')}`
        : '';
      parts.push(`Crop: ${crop.name}${regionStr}`);
    }

    // ── Inject offline knowledge for RAG ─────────────────────────
    const cropId = crop?.id ?? request.cropId;
    const knowledgeContext = knowledgeService.buildContext(cropId, request.symptoms);
    if (knowledgeContext) {
      parts.push(knowledgeContext);
    }

    const extraContext = parts.length > 0 ? parts.join('\n\n') : undefined;

    // ── Build messages ───────────────────────────────────────────
    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: request.symptoms,
      createdAt: new Date().toISOString(),
    };

    const history = existingMessages ?? [];
    const allMessages = [...history, newMessage];

    return buildSystemMessages('diagnosis', allMessages, extraContext);
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
 * @param request           - Diagnosis request payload.
 * @param crop              - Optional crop context.
 * @param existingMessages  - Prior conversation history (for multi-turn).
 * @returns A diagnosis response.
 */
export async function generateDiagnosis(
  request: DiagnosisRequest,
  crop?: Crop,
  existingMessages?: ChatMessage[],
): Promise<DiagnosisResponse> {
  return defaultAdapter.generateDiagnosis(request, crop, existingMessages);
}

/**
 * Streams a diagnosis from the AI provider, yielding raw text chunks.
 *
 * @param request           - Diagnosis request payload.
 * @param crop              - Optional crop context.
 * @param existingMessages  - Prior conversation history (multi-turn).
 * @yields Raw text chunks.
 */
export async function* streamDiagnosis(
  request: DiagnosisRequest,
  crop?: Crop,
  existingMessages?: ChatMessage[],
): AsyncGenerator<string> {
  yield* defaultAdapter.streamDiagnosis(request, crop, existingMessages);
}
