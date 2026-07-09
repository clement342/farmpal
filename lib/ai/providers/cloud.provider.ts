import type { ChatMessage } from '@/types';
import { AIServiceError } from '@/utils/errors';
import type { AIProvider, CompletionOptions } from './provider.interface';

// ---------------------------------------------------------------------------
// Google AI Studio REST API types
// ---------------------------------------------------------------------------

/** A single content part (text only). */
interface GoogleContentPart {
  text: string;
}

/** A single conversation turn. Google uses "model" where OpenAI uses "assistant". */
interface GoogleContent {
  role: 'user' | 'model';
  parts: GoogleContentPart[];
}

/** POST body for generateContent. */
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

/** Minimal response shape we need. */
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
// CloudProvider — Google AI Studio
// ---------------------------------------------------------------------------

/**
 * Routes inference to Google AI Studio via the generateContent REST API.
 *
 * Authentication: x-goog-api-key header (works for both AIza... and AQ... keys).
 * This matches the official Google AI Studio cURL example:
 *
 *   curl "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent" \
 *     -H "Content-Type: application/json" \
 *     -H "x-goog-api-key: YOUR_API_KEY" \
 *     -X POST \
 *     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
 *
 * Configuration:
 *   GOOGLE_API_KEY  — API key from Google AI Studio (required)
 *   GOOGLE_MODEL    — model name, e.g. gemma-4-26b-a4b-it (optional)
 */
export class CloudProvider implements AIProvider {
  readonly name = 'google-ai-studio';
  readonly priority = 2;

  private readonly apiKey: string;
  private readonly model: string;

  private static readonly BASE_URL =
    'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0;
  }

async complete(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): Promise<string> {
    const url = `${CloudProvider.BASE_URL}/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    console.log(
      '[cloud:complete] POST', url.split('?')[0],
      '| keyPrefix:', this.apiKey.substring(0, 4),
      '| messages:', messages.length,
    );

    const body = this.buildRequestBody(messages, options);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      console.error("FULL GOOGLE FETCH ERROR:", cause);

      throw new AIServiceError(
        `Google AI Studio request failed: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      console.error(
        '[cloud:complete] error | status:', response.status,
        '| body:', errorText.slice(0, 500),
      );
      throw new AIServiceError(
        `Google AI Studio returned ${response.status}: ${errorText}`,
      );
    }

    let data: GoogleGenerateContentResponse;
    try {
      data = (await response.json()) as GoogleGenerateContentResponse;
    } catch {
      throw new AIServiceError('Google AI Studio returned a non-JSON response');
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
   * Maps ChatMessage[] to Google's contents/parts format.
   * Leading system messages go into systemInstruction.
   * Subsequent system messages are dropped (Google rejects mid-turn system roles).
   */
  private buildRequestBody(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): GoogleGenerateContentRequest {
    let i = 0;
    const systemParts: GoogleContentPart[] = [];

    while (i < messages.length && messages[i].role === 'system') {
      systemParts.push({ text: messages[i].content });
      i++;
    }

    const contents: GoogleContent[] = [];
    for (; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === 'system') continue;
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

  /** candidates[0].content.parts[0].text */
  private extractContent(data: GoogleGenerateContentResponse): string | undefined {
    return data?.candidates?.[0]?.content?.parts?.[0]?.text;
  }
}
