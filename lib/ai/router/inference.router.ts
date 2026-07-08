import type { ChatMessage } from '@/types';
import { AIServiceError } from '@/utils/errors';
import { createLogger } from '../logger';
import type { CompletionOptions } from '../providers/provider.interface';
import type { ProviderRegistry } from '../registry/provider.registry';

const log = createLogger('ai:router');

// ---------------------------------------------------------------------------
// InferenceRouter
// ---------------------------------------------------------------------------

/**
 * Routes inference requests to the highest-priority available AI provider.
 *
 * The router iterates through providers in priority order (lowest number
 * first), skipping any that report themselves as unavailable, and returns
 * the first successful response. If a provider is available but throws
 * during `complete()`, the router logs the failure and falls through to
 * the next provider.
 *
 * ## Offline-first behaviour
 *
 * 1. `OllamaProvider` (priority 1) is checked first.
 *    - `isAvailable()` hits a cached health-check result; no network call
 *      is made on every inference request.
 *    - If Ollama is running locally with the configured model loaded,
 *      inference runs entirely offline.
 *
 * 2. `CloudProvider` (priority 2) is the fallback.
 *    - Only reached when Ollama is unreachable or misconfigured.
 *    - If no cloud credentials are configured, `isAvailable()` returns
 *      false and the router skips it without making any network call.
 *
 * 3. If no provider is available, an `AIServiceError` is thrown with an
 *    actionable message explaining what to check.
 *
 * ## Extending
 *
 * Add a new provider (e.g. WebGPU at priority 0) to the `ProviderRegistry`
 * and it will automatically be considered by this router — no changes here.
 *
 * @example
 * ```ts
 * const router = new InferenceRouter(defaultRegistry);
 * const text = await router.complete(messages, { task: 'diagnosis' });
 * ```
 */
export class InferenceRouter {
  constructor(private readonly registry: ProviderRegistry) {}

  /**
   * Generates a completion using the best available provider.
   *
   * Tries providers in priority order. Falls through to the next provider
   * on availability failure or runtime error.
   *
   * @param messages - The full conversation history including the system prompt.
   * @param options  - Optional generation parameters forwarded to the provider.
   * @returns The model's plain-text response.
   * @throws AIServiceError when no provider is able to serve the request.
   */
  async complete(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<string> {
    const providers = this.registry.getAll();

    if (providers.length === 0) {
      throw new AIServiceError(
        'No AI providers are registered. Add at least one provider to the ProviderRegistry.',
      );
    }

    const attemptedProviders: string[] = [];

    for (const provider of providers) {
      // --- Availability check ---
      let available: boolean;
      try {
        available = await provider.isAvailable();
      } catch {
        // isAvailable() should never throw, but guard anyway
        available = false;
      }

      if (!available) {
        log.debug('Provider unavailable, skipping', { provider: provider.name });
        continue;
      }

      attemptedProviders.push(provider.name);

      // --- Inference attempt ---
      try {
        const startMs = Date.now();
        const result = await provider.complete(messages, options);
        log.info('Provider completed request', {
          provider: provider.name,
          durationMs: Date.now() - startMs,
        });
        return result;
      } catch (err) {
        log.error('Provider failed during completion', {
          provider: provider.name,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue to next provider
      }
    }

    // All providers exhausted
    const providerList = providers.map((p) => p.name).join(', ');
    const attemptedList =
      attemptedProviders.length > 0
        ? `Attempted: ${attemptedProviders.join(', ')}.`
        : 'No providers reported themselves as available.';

    throw new AIServiceError(
      `No AI provider could serve the request. ${attemptedList} ` +
        `Registered providers: ${providerList}. ` +
        `Ensure Ollama is running with the configured model, or set GOOGLE_API_KEY for Google AI Studio fallback.`,
    );
  }
}
