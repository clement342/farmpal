import type { ChatMessage } from '@/types';
import { AIServiceError } from '@/utils/errors';
import type { AIProvider, CompletionOptions } from './provider.interface';

// ---------------------------------------------------------------------------
// Google AI Studio REST API types
//
// Reference: https://ai.google.dev/api/generate-content
// ---------------------------------------------------------------------------

/** A single content part (text only — we don't send images). */
interface GoogleContentPart {
  text: string;
}

/** A single turn in the conversation (user or model). */
interface GoogleContent {
  /** "user" or "model" — Google uses "model" where OpenAI uses "assistant". */
  role: 'user' | 'model';
  parts: GoogleContentPart[];
}

/** Full request body for POST generateContent. */
interface GoogleGenerateContentRequest {
  contents: GoogleContent[];
  systemInstruction?: {
    parts: GoogleContentPart[];
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
}

/** Minimal subset of the generateContent response we actually need. */
interface GoogleGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// ---------------------------------------------------------------------------
// CloudProvider — Google AI Studio implementation
// ---------------------------------------------------------------------------

/**
 * AI provider that routes inference to Google AI Studio via the
 * generateContent REST API.
 *
 * ## Configuration (environment variables)
 *
 * | Variable       | Default            | Description                              |
 * |----------------|--------------------|------------------------------------------|
 * | GOOGLE_API_KEY | —                  | Google AI Studio API key (required)      |
 * | GOOGLE_MODEL   | gemini-2.0-flash   | Gemini model to use for inference        |
 *
 * ## Availability
 *
 * `isAvailable()` is a pure config check — it returns true when
 * `GOOGLE_API_KEY` is set. No network probe is performed so the router
 * can skip cloud quickly in offline-first mode without a TCP timeout.
 *
 * ## Message mapping
 *
 * Google's generateContent API separates system instructions from the
 * conversation turns. This provider:
 *   - Extracts leading `system` messages into `systemInstruction`
 *   - Maps `user` → `role: "user"` and `assistant` → `role: "model"`
 *   - Skips any remaining system messages (after the first non-system turn)
 *     because Google does not allow system turns mid-conversation
 */
export class CloudProvider implements AIProvider {
  readonly name = 'google-ai-studio';
  readonly priority = 2;

  private readonly apiKey: string;
  private readonly model: string;

  /** Base URL for the Google AI Studio generateContent endpoint. */
  private static readonly BASE_URL =
    'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  // -------------------------------------------------------------------------
  // AIProvider: isAvailable
  // -------------------------------------------------------------------------

  /**
   * Returns true when a Google API key is configured.
   * No network call is made — this is intentionally a fast config check.
   */
  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

  // -------------------------------------------------------------------------
  // AIProvider: complete
  // -------------------------------------------------------------------------

  /**
   * Sends a generateContent request to Google AI Studio.
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
    const url = `${CloudProvider.BASE_URL}/${this.model}:generateContent`;
    console.log(
      '[cloud:complete] POST', url,
      '| apiKey length:', this.apiKey.length,
      '| messages:', messages.length,
    );
    const body = this.buildRequestBody(messages, options);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new AIServiceError(
        `Google AI Studio request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error(
        '[cloud:complete] Google AI Studio error | status:',
        response.status,
        '| body:',
        errorText.slice(0, 500),
      );
      throw new AIServiceError(
        `Google AI Studio returned ${response.status}: ${errorText}`,
      );
    }

    let data: GoogleGenerateContentResponse;
    try {
      data = (await response.json()) as GoogleGenerateContentResponse;
    } catch {
      throw new AIServiceError(
        'Google AI Studio returned a non-JSON response',
      );
    }

    const content = this.extractContent(data);
    if (!content || content.trim().length === 0) {
      throw new AIServiceError(
        'Google AI Studio returned an empty or malformed completion',
      );
    }

    return content.trim();
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Converts ChatMessage[] into the Google generateContent request body.
   *
   * System messages are pulled out into `systemInstruction` (Google's
   * preferred location). The remaining messages alternate user/model turns.
   */
  private buildRequestBody(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): GoogleGenerateContentRequest {
    // Collect all leading system messages into systemInstruction
    let i = 0;
    const systemParts: GoogleContentPart[] = [];
    while (i < messages.length && messages[i].role === 'system') {
      systemParts.push({ text: messages[i].content });
      i++;
    }

    // Map the remaining turns — skip any stray system messages mid-conversation
    const contents: GoogleContent[] = [];
    for (; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'system') continue; // Google doesn't allow system mid-turn
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }

    const body: GoogleGenerateContentRequest = { contents };

    if (systemParts.length > 0) {
      body.systemInstruction = { parts: systemParts };
    }

    if (
      options?.temperature !== undefined ||
      options?.maxTokens !== undefined ||
      options?.topP !== undefined
    ) {
      body.generationConfig = {
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(options.maxTokens !== undefined && { maxOutputTokens: options.maxTokens }),
        ...(options.topP !== undefined && { topP: options.topP }),
      };
    }

    return body;
  }

  /**
   * Extracts the text content from a Google generateContent response.
   * Path: candidates[0].content.parts[0].text
   */
  private extractContent(data: GoogleGenerateContentResponse): string | undefined {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text;
  }
}
