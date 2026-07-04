/**
 * Public API for the FarmPal AI inference layer.
 *
 * This is the only module that application code (services, server actions)
 * should import from. Everything inside `lib/ai/providers/`, `lib/ai/registry/`,
 * and `lib/ai/router/` is an implementation detail.
 *
 * ## Usage
 *
 * ```ts
 * import { infer } from '@/lib/ai';
 *
 * const response = await infer(messages, { task: 'diagnosis' });
 * ```
 *
 * ## How provider selection works
 *
 * 1. OllamaProvider (priority 1) is tried first.
 *    - If Ollama is running locally with the configured model, inference
 *      is fully offline — no internet required.
 * 2. CloudProvider (priority 2) is the fallback.
 *    - Only used when Ollama is unavailable and cloud credentials are set.
 * 3. If neither provider is available, an `AIServiceError` is thrown.
 *
 * ## Adding a new provider
 *
 * 1. Implement the `AIProvider` interface in `lib/ai/providers/`.
 * 2. Register it in `defaultRegistry` below with the desired priority.
 * 3. Add any required env variables to `lib/ai/config.ts`.
 * Nothing else needs to change.
 *
 * @module
 */

import type { ChatMessage } from '@/types';
import { aiConfig } from './config';
import { OllamaProvider } from './providers/ollama.provider';
import { CloudProvider } from './providers/cloud.provider';
import { ProviderRegistry } from './registry/provider.registry';
import { InferenceRouter } from './router/inference.router';
import type { CompletionOptions } from './providers/provider.interface';

// ---------------------------------------------------------------------------
// Singleton setup
//
// The registry and router are module-level singletons. In Next.js, module
// scope is re-evaluated once per server worker — this is fine because:
//   - OllamaProvider caches its availability result with a TTL (not per-request)
//   - CloudProvider's isAvailable() is a pure config check (no network call)
//   - No mutable state is shared across requests
// ---------------------------------------------------------------------------

/**
 * The default provider registry, built from environment configuration.
 *
 * Providers are registered in natural priority order. The OllamaProvider
 * always comes first (offline-first), followed by the CloudProvider.
 *
 * The CloudProvider is always registered but `isAvailable()` will return
 * false if `GEMMA_CLOUD_ENDPOINT` or `GEMMA_CLOUD_API_KEY` are not set —
 * so an unconfigured cloud provider is silently skipped.
 */
export const defaultRegistry = new ProviderRegistry()
  .register(
    new OllamaProvider(aiConfig.ollama.baseUrl, aiConfig.ollama.model),
  )
  .register(
    new CloudProvider(
      aiConfig.cloud.endpoint,
      aiConfig.cloud.apiKey,
      aiConfig.cloud.model,
      aiConfig.cloud.name,
    ),
  );

/**
 * The default inference router, backed by the default registry.
 *
 * Services should call `infer()` below rather than using this directly.
 * Export it for cases where you need to pass the router to a constructor
 * (e.g. a service that takes a router for testability).
 */
export const defaultRouter = new InferenceRouter(defaultRegistry);

// ---------------------------------------------------------------------------
// Public inference function
// ---------------------------------------------------------------------------

/**
 * Generates a completion from the best available AI provider.
 *
 * Tries local Ollama first. Falls back to the configured cloud endpoint
 * if Ollama is unreachable. Throws `AIServiceError` if no provider can
 * serve the request.
 *
 * @param messages - Full conversation history. Should include the system
 *                   prompt as the first message with `role: 'system'`.
 * @param options  - Optional generation parameters (temperature, maxTokens, etc.).
 * @returns        - The model's plain-text response.
 *
 * @throws AIServiceError if all providers are unavailable or fail.
 *
 * @example
 * ```ts
 * import { infer } from '@/lib/ai';
 *
 * const messages: ChatMessage[] = [
 *   { id: 'sys', role: 'system', content: systemPrompt, createdAt: new Date().toISOString() },
 *   { id: 'u1',  role: 'user',   content: 'My maize leaves have holes.', createdAt: new Date().toISOString() },
 * ];
 *
 * const reply = await infer(messages, { task: 'diagnosis', temperature: 0.3 });
 * ```
 */
export async function infer(
  messages: ChatMessage[],
  options?: CompletionOptions,
): Promise<string> {
  return defaultRouter.complete(messages, options);
}

// ---------------------------------------------------------------------------
// Re-exports for consumers that need the types
// ---------------------------------------------------------------------------

export type { CompletionOptions } from './providers/provider.interface';
export type { AIProvider } from './providers/provider.interface';
export { ProviderRegistry } from './registry/provider.registry';
export { InferenceRouter } from './router/inference.router';
export { OllamaProvider } from './providers/ollama.provider';
export { CloudProvider } from './providers/cloud.provider';
export { aiConfig } from './config';
