import type { ChatMessage } from '@/types';

/**
 * Options passed to every completion request.
 *
 * Providers are free to ignore options they do not support — the
 * interface intentionally uses optional fields so callers do not
 * need to know which model is running under the hood.
 */
export interface CompletionOptions {
  /**
   * Sampling temperature (0 = deterministic, 1 = creative).
   * Defaults to a provider-specific value when omitted.
   */
  temperature?: number;

  /**
   * Maximum number of tokens to generate.
   * Defaults to a provider-specific value when omitted.
   */
  maxTokens?: number;

  /**
   * Nucleus sampling probability mass (0–1).
   * Providers that do not support top-p will ignore this.
   */
  topP?: number;

  /**
   * Logical task hint. Allows providers (or the router) to
   * apply task-specific defaults (e.g., lower temperature for
   * diagnosis, higher for general chat).
   */
  task?: 'diagnosis' | 'chat';
}

/**
 * The contract every AI provider must implement.
 *
 * The inference router works exclusively against this interface —
 * it never imports a concrete provider class. This makes it trivial
 * to add new providers (Vertex AI, WebGPU, ONNX, mocks for tests)
 * without touching any routing or service code.
 *
 * @example
 * ```ts
 * class MockProvider implements AIProvider {
 *   readonly name = 'mock';
 *   readonly priority = 0;
 *   async isAvailable() { return true; }
 *   async complete() { return 'mock response'; }
 * }
 * ```
 */
export interface AIProvider {
  /**
   * Human-readable provider identifier. Used in logs and error messages.
   * Should be unique within a registry (e.g. 'ollama-gemma4', 'google-ai-studio').
   */
  readonly name: string;

  /**
   * Selection priority. Lower numbers are tried first.
   * Providers with the same priority are tried in registration order.
   *
   * Recommended values:
   *   0 — on-device (WebGPU, ONNX)
   *   1 — local network (Ollama)
   *   2 — cloud / remote
   */
  readonly priority: number;

  /**
   * Reports whether this provider is currently reachable and ready.
   *
   * Implementations should:
   * - Return quickly (< 2 s). Use cached state where possible.
   * - Not throw — return false on any connectivity or config error.
   * - Cache the result with a short TTL to avoid repeated probes
   *   on every inference call.
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generates a completion for the given conversation history.
   *
   * @param messages - Full conversation history including the system prompt.
   * @param options  - Optional generation parameters.
   * @returns        - The model's plain-text response.
   * @throws AIServiceError if the provider fails after being confirmed available.
   */
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<string>;
}
