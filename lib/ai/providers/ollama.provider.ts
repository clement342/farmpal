import type { ChatMessage } from '@/types';
import { AIServiceError } from '@/utils/errors';
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
  private availabilityCache: AvailabilityCache | null = null;

  constructor(baseUrl: string, model: string) {
    // Strip trailing slash for consistent URL construction
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.model = model;
    this.name = `ollama-${model}`;
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
   * @param messages - Conversation history (system + user/assistant turns).
   * @param options  - Optional generation parameters.
   * @returns The model's response text.
   * @throws AIServiceError on non-2xx response or network failure.
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

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      throw new AIServiceError(
        `Ollama returned ${response.status}: ${errorText}`,
      );
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
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Performs the actual health probe against GET /api/tags.
   * Never throws — returns false on any error.
   */
  private async probe(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        // Short timeout: if Ollama is down we should fail fast
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as OllamaTagsResponse;
      const models: OllamaModelInfo[] = data?.models ?? [];

      // Check that the configured model tag is in the list.
      // Ollama model names are case-insensitive and may include a digest
      // suffix (e.g. "gemma4:latest@sha256:..."), so we check with startsWith.
      const targetLower = this.model.toLowerCase();
      return models.some((m) =>
        m.name.toLowerCase().startsWith(targetLower.split(':')[0]),
      );
    } catch {
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
