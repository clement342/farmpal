/**
 * AI infrastructure configuration.
 *
 * All environment variables used by the AI layer are read and validated
 * here. Nothing else in `lib/ai/` reads `process.env` directly — this
 * centralises configuration, makes it easy to audit, and keeps individual
 * modules free of environment coupling.
 *
 * ## Environment variables
 *
 * | Variable        | Required | Default                | Description                                       |
 * |-----------------|----------|------------------------|---------------------------------------------------|
 * | OLLAMA_BASE_URL | No       | http://localhost:11434 | Base URL of the local Ollama server               |
 * | OLLAMA_MODEL    | No       | gemma4:latest          | Model tag to load for local inference             |
 * | GOOGLE_API_KEY  | No       | —                      | Google AI Studio API key for cloud fallback       |
 * | GOOGLE_MODEL    | No       | gemini-2.0-flash       | Gemini model to use for cloud inference           |
 *
 * All variables are optional at the module level. The application degrades
 * gracefully: if only Ollama config is present, cloud is skipped; if only
 * Google config is present, Ollama health checks will fail and cloud is used.
 * If neither is configured, inference calls throw `AIServiceError`.
 */
const _googleApiKey = process.env.GOOGLE_API_KEY ?? '';

// Startup diagnostic — logs key presence without exposing the value.
console.log(
  '[ai:config] GOOGLE_API_KEY present:',
  _googleApiKey.length > 0,
  '| length:',
  _googleApiKey.length,
);

export const aiConfig = {
  ollama: {
    /** Base URL for the local Ollama server. */
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    /** Ollama model tag (e.g. 'gemma4:latest', 'gemma4:27b'). */
    model: process.env.OLLAMA_MODEL ?? 'gemma4:latest',
  },
  cloud: {
    /**
     * Google AI Studio API key.
     * Empty string means no cloud provider is configured.
     */
    apiKey: _googleApiKey,
    /**
     * Gemini/Gemma model to use for cloud inference.
     * Defaults to gemma-4-26b-a4b-it — hosted Gemma available via the Gemini API.
     * Also supported: gemma-4-31b-it, gemini-2.5-flash
     */
    model: process.env.GOOGLE_MODEL ?? 'gemma-4-26b-a4b-it',
  },
} as const;
