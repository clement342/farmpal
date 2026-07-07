import type { ChatMessage } from '@/types';
import { AIServiceError } from '@/utils/errors';
import { createLogger } from '../logger';
import { withRetry, type RetryOptions } from '../retry';
import type { AIProvider, CompletionOptions } from './provider.interface';

// ---------------------------------------------------------------------------
// Ollama REST API types (subset needed for chat completions)
// ---------------------------------------------------------------------------

/** A single message in the Ollama /api/chat request format. */
interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Request body for POST /api/chat. */
interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
}

/** Successful response body from POST /api/chat (stream: false). */
interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/** Shape of a single entry in GET /api/tags response. */
interface OllamaModelInfo {
  name: string;
}

/** Response body from GET /api/tags. */
interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

// ---------------------------------------------------------------------------
// Availability cache
// ---------------------------------------------------------------------------

/**
 * In-memory availability cache entry.
 * Prevents a health-check probe on every inference call when Ollama is
 * known to be up or down.
 */
interface AvailabilityCache {
  available: boolean;
  /** Unix timestamp (ms) when this entry expires. */
  expiresAt: number;
}

/** How long to trust a cached availability result (milliseconds). */
const AVAILABILITY_CACHE_TTL_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// OllamaProviderOptions
// ---------------------------------------------------------------------------

/**
 * Optional configuration for `OllamaProvider`.
 *
 * All fields are optional; sensible defaults are applied when omitted.
 */
export interface OllamaProviderOptions {
  /**
   * Abort timeout for the health probe (`GET /api/tags`) in milliseconds.
   * @default 5_000
   */
  probeTimeoutMs?: number;

  /**
   * Abort timeout for chat completion requests (`POST /api/chat`) in milliseconds.
   * Local models can be slow to generate — set this high enough that a large
   * response doesn't time out mid-stream.
   * @default 120_000 (2 minutes)
   */
  completionTimeoutMs?: number;

  /**
   * Retry configuration for chat completion requests.
   * Pass `false` to disable retries entirely.
   *
   * Retries are **not** applied to the availability probe — a slow probe
   * should simply return `false` so the router falls through quickly.
   *
   * @default { maxAttempts: 3, baseDelayMs: 300 }
   */
  retry?: Partial<RetryOptions> | false;
}

// ---------------------------------------------------------------------------
// OllamaProvider
// ---------------------------------------------------------------------------

/**
 * AI provider that routes inference through a locally running Ollama instance.
 *
 * Ollama exposes a REST API compatible with standard chat completion semantics.
 * This provider communicates with that API using the global `fetch` (available
 * in Node 18+ and all Next.js runtimes) — no additional npm dependency needed.
 *
 * ## Configuration (environment variables)
 *
 * | Variable        | Default                    | Description                        |
 * |-----------------|----------------------------|------------------------------------|
 * | OLLAMA_BASE_URL | http://localhost:11434     | Ollama server base URL             |
 * | OLLAMA_MODEL    | gemma4:latest              | Model tag to use for completions   |
 *
 * ## Health check strategy
 *
 * `isAvailable()` calls `GET /api/tags` and checks that the configured model
 * tag appears in the response. This verifies both that Ollama is running *and*
 * that the specific model is loaded — a running Ollama instance without the
 * model would produce a misleading "available" signal.
 *
 * Results are cached for {@link AVAILABILITY_CACHE_TTL_MS} to avoid hammering
 * the health endpoint on every inference request.
 *
 * @example
 * ```ts
 * const provider = new OllamaProvider(
 *   'http://localhost:11434',
 *   'gemma4:latest',
 * );
 * if (await provider.isAvailable()) {
 *   const text = await provider.complete(messages);
 * }
 * ```
 */
export class OllamaProvider implements AIProvider {
  readonly name: string;
  readonly priority = 1;

  private readonly baseUrl: string;
  private readonly model: string;
  private readonly probeTimeoutMs: number;
  private readonly completionTimeoutMs: number;
  private readonly retryOptions: RetryOptions | false;
  private availabilityCache: AvailabilityCache | null = null;
  private readonly log = createLogger('ai:ollama');

  /**
   * @param baseUrl - Base URL of the Ollama server (e.g. `http://localhost:11434`).
   * @param model   - Model tag to use (e.g. `gemma4:latest`).
   * @param options - Optional timeout and retry configuration.
   */
  constructor(baseUrl: string, model: string, options: OllamaProviderOptions = {}) {
    // Strip trailing slash for consistent URL construction
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.name = `ollama-${model}`;
    this.probeTimeoutMs = options.probeTimeoutMs ?? 5_000;
    this.completionTimeoutMs = options.completionTimeoutMs ?? 120_000;
    this.retryOptions =
      options.retry === false
        ? false
        : { maxAttempts: 3, baseDelayMs: 300, label: `Ollama /api/chat (${model})`, ...options.retry };
  }

  // -------------------------------------------------------------------------
  // AIProvider: isAvailable
  // -------------------------------------------------------------------------

  /**
   * Checks whether Ollama is running and the configured model is loaded.
   * Result is cached for {@link AVAILABILITY_CACHE_TTL_MS}.
   */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();

    // Return cached result if still fresh
    if (this.availabilityCache && now < this.availabilityCache.expiresAt) {
      return this.availabilityCache.available;
    }

    const available = await this.probe();
    this.availabilityCache = {
      available,
      expiresAt: now + AVAILABILITY_CACHE_TTL_MS,
    };
    return available;
  }

  // -------------------------------------------------------------------------
  // AIProvider: complete
  // -------------------------------------------------------------------------

  /**
   * Sends a chat completion request to Ollama.
   *
   * Applies configurable timeout and optional exponential-backoff retry.
   * On network failure the availability cache is invalidated immediately
   * so the router can fall through to the next provider without waiting
   * for the TTL to expire.
   *
   * @param messages - Conversation history (system + user/assistant turns).
   * @param options  - Optional generation parameters.
   * @returns The model's response text.
   * @throws AIServiceError on non-2xx response, network failure, or empty reply.
   */
  async complete(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;
    const body: OllamaChatRequest = {
      model: this.model,
      messages: this.toOllamaMessages(messages),
      stream: false,
      options: {
        ...(options?.temperature !== undefined && { temperature: options.temperature }),
        ...(options?.maxTokens !== undefined && { num_predict: options.maxTokens }),
        ...(options?.topP !== undefined && { top_p: options.topP }),
      },
    };

    this.log.debug('Sending completion request', {
      model: this.model,
      messageCount: messages.length,
      completionTimeoutMs: this.completionTimeoutMs,
    });

    const startMs = Date.now();

    const attempt = async (): Promise<string> => {
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.completionTimeoutMs),
        });
      } catch (cause) {
        // Mark provider as unavailable immediately so the next call skips it
        this.invalidateCache();
        throw new AIServiceError(
          `Ollama request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown error');
        // 5xx errors are retryable (transient); 4xx are not
        const err = new AIServiceError(`Ollama returned ${response.status}: ${errorText}`);
        if (response.status < 500) {
          // Attach a non-retryable marker so withRetry bails immediately
          (err as AIServiceError & { retryable: boolean }).retryable = false;
        }
        throw err;
      }

      let data: OllamaChatResponse;
      try {
        data = (await response.json()) as OllamaChatResponse;
      } catch {
        throw new AIServiceError('Ollama returned a non-JSON response');
      }

      const content = data.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new AIServiceError('Ollama returned an empty or malformed completion');
      }

      return content.trim();
    };

    let result: string;
    if (this.retryOptions === false) {
      result = await attempt();
    } else {
      result = await withRetry(attempt, {
        ...this.retryOptions,
        isRetryable: (err) => {
          // Honor the non-retryable marker set for 4xx responses
          if (typeof (err as Record<string, unknown>).retryable === 'boolean') {
            return (err as { retryable: boolean }).retryable;
          }
          return true;
        },
      });
    }

    this.log.info('Completion succeeded', {
      model: this.model,
      durationMs: Date.now() - startMs,
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Performs the actual health probe against GET /api/tags.
   * Never throws — returns false on any error.
   */
  private async probe(): Promise<boolean> {
    const startMs = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.probeTimeoutMs),
      });

      if (!response.ok) {
        this.log.debug('Probe returned non-OK status', { status: response.status });
        return false;
      }

      const data = (await response.json()) as OllamaTagsResponse;
      const models: OllamaModelInfo[] = data?.models ?? [];

      // Match the configured model tag exactly.
      //
      // Ollama model names are case-insensitive and may carry a digest suffix
      // separated by '@' (e.g. "gemma4:e2b@sha256:abc123..."). We strip the
      // digest before comparing so that both "gemma4:e2b" and
      // "gemma4:e2b@sha256:..." match the configured tag "gemma4:e2b".
      //
      // We do NOT match on just the name part (before ':') because that would
      // treat "gemma4:27b" as a valid match for a configured "gemma4:e2b",
      // causing complete() to send the wrong model tag to Ollama.
      const targetLower = this.model.toLowerCase();
      const found = models.some((m) => {
        // Strip digest suffix if present, then compare full tag
        const tagWithoutDigest = m.name.toLowerCase().split('@')[0];
        return tagWithoutDigest === targetLower;
      });

      this.log.debug('Probe completed', {
        available: found,
        modelCount: models.length,
        durationMs: Date.now() - startMs,
      });

      return found;
    } catch (err) {
      this.log.debug('Probe failed', {
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startMs,
      });
      return false;
    }
  }

  /**
   * Forces the next `isAvailable()` call to re-probe instead of using cache.
   * Called after a failed `complete()` so the router can immediately try
   * the next provider without waiting for the cache TTL to expire.
   */
  private invalidateCache(): void {
    this.availabilityCache = null;
    this.log.debug('Availability cache invalidated');
  }

  /**
   * Converts internal `ChatMessage[]` to Ollama's message format.
   * Ollama expects the same role names ('system', 'user', 'assistant')
   * so this is a clean projection with no lossy mapping.
   */
  private toOllamaMessages(messages: ChatMessage[]): OllamaChatMessage[] {
    return messages.map((m) => ({
      role: m.role as OllamaChatMessage['role'],
      content: m.content,
    }));
  }
}
