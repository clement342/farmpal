import type { ChatMessage } from '@/types';
import { AIServiceError } from '@/utils/errors';
import type { AIProvider, CompletionOptions } from './provider.interface';

// ---------------------------------------------------------------------------
// Generic cloud provider message/response types
//
// The cloud provider speaks an OpenAI-compatible chat completions schema.
// Google AI Studio (Gemma), most hosted Gemma endpoints, and many cloud
// providers either natively use this schema or expose a compatibility layer.
//
// If a target provider uses a different wire format, subclass CloudProvider
// and override `buildRequestBody()` and `extractContent()`.
// ---------------------------------------------------------------------------

/** Message format for OpenAI-compatible chat completion endpoints. */
interface CloudChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Request body for POST /v1/chat/completions (OpenAI-compatible schema). */
interface CloudChatRequest {
  model?: string;
  messages: CloudChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

/** Minimal subset of the OpenAI-compatible response we actually need. */
interface CloudChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ---------------------------------------------------------------------------
// CloudProvider
// ---------------------------------------------------------------------------

/**
 * AI provider that routes inference to a remote HTTP endpoint.
 *
 * Uses an OpenAI-compatible chat completions schema by default, which covers:
 * - Google AI Studio (Gemma via REST)
 * - Vertex AI (with OpenAI-compatible endpoint)
 * - Any self-hosted Gemma endpoint fronted by an OpenAI-compatible proxy
 *
 * The provider is intentionally generic: the endpoint URL, API key, and
 * optional model name are all injected at construction time. This means
 * switching cloud providers is a configuration change, not a code change.
 *
 * ## Configuration (environment variables)
 *
 * | Variable               | Default | Description                                    |
 * |------------------------|---------|------------------------------------------------|
 * | GEMMA_CLOUD_ENDPOINT   | —       | Full URL of the chat completions endpoint      |
 * | GEMMA_CLOUD_API_KEY    | —       | Bearer token / API key for authentication      |
 * | GEMMA_CLOUD_MODEL      | —       | Optional model name to include in the request  |
 *
 * `GEMMA_CLOUD_MODEL` is optional because some endpoints infer the model
 * from the route itself (e.g. Google AI Studio's `models/gemma-4` path).
 *
 * ## Availability
 *
 * `isAvailable()` is a lightweight config check: the provider is available
 * when both an endpoint URL and an API key are present. No network probe is
 * performed on every call — the cloud is assumed reachable unless a request
 * fails. This keeps the fallback path fast in offline-first mode (we do not
 * want to wait for a cloud timeout before deciding to stay local).
 *
 * @example
 * ```ts
 * const provider = new CloudProvider(
 *   'https://generativelanguage.googleapis.com/v1beta/models/gemma-4:generateContent',
 *   'YOUR_API_KEY',
 *   'gemma-4',
 *   'google-ai-studio',
 * );
 * ```
 */
export class CloudProvider implements AIProvider {
  readonly name: string;
  readonly priority = 2;

  private readonly endpoint: string;
  private readonly apiKey: string;
  /** Optional model name to include in the request body. */
  private readonly model: string | undefined;

  constructor(
    endpoint: string,
    apiKey: string,
    model?: string,
    name?: string,
  ) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model;
    this.name = name ?? 'cloud-gemma';
  }

  // -------------------------------------------------------------------------
  // AIProvider: isAvailable
  // -------------------------------------------------------------------------

  /**
   * Returns true when both the endpoint URL and API key are configured.
   *
   * No network probe is performed — the cloud is assumed reachable if
   * config is present. This is intentional: in offline-first mode we
   * want to skip the cloud quickly (by detecting missing config) rather
   * than waiting for a TCP timeout.
   */
  async isAvailable(): Promise<boolean> {
    return this.endpoint.length > 0 && this.apiKey.length > 0;
  }

  // -------------------------------------------------------------------------
  // AIProvider: complete
  // -------------------------------------------------------------------------

  /**
   * Sends a chat completion request to the configured cloud endpoint.
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
    const body = this.buildRequestBody(messages, options);

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new AIServiceError(
        `Cloud provider (${this.name}) request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new AIServiceError(
        `Cloud provider (${this.name}) returned ${response.status}: ${errorText}`,
      );
    }

    let data: CloudChatResponse;
    try {
      data = (await response.json()) as CloudChatResponse;
    } catch {
      throw new AIServiceError(
        `Cloud provider (${this.name}) returned a non-JSON response`,
      );
    }

    const content = this.extractContent(data);
    if (!content || content.trim().length === 0) {
      throw new AIServiceError(
        `Cloud provider (${this.name}) returned an empty or malformed completion`,
      );
    }

    return content.trim();
  }

  // -------------------------------------------------------------------------
  // Protected: override points for provider-specific formats
  // -------------------------------------------------------------------------

  /**
   * Builds the request body from messages and options.
   *
   * Override this in a subclass to target a provider that uses a different
   * wire format (e.g. Google AI Studio's `generateContent` schema).
   */
  protected buildRequestBody(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): CloudChatRequest {
    const body: CloudChatRequest = {
      messages: this.toCloudMessages(messages),
      ...(this.model && { model: this.model }),
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
      ...(options?.topP !== undefined && { top_p: options.topP }),
    };
    return body;
  }

  /**
   * Extracts the assistant's text content from the response body.
   *
   * Override this in a subclass to handle a different response schema.
   */
  protected extractContent(data: CloudChatResponse): string | undefined {
    return data?.choices?.[0]?.message?.content;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Converts internal `ChatMessage[]` to the cloud provider's message format.
   */
  private toCloudMessages(messages: ChatMessage[]): CloudChatMessage[] {
    return messages.map((m) => ({
      role: m.role as CloudChatMessage['role'],
      content: m.content,
    }));
  }
}
