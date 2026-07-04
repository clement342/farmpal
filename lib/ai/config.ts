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
 * | Variable               | Required | Default                  | Description                                         |
 * |------------------------|----------|--------------------------|-----------------------------------------------------|
 * | OLLAMA_BASE_URL        | No       | http://localhost:11434   | Base URL of the local Ollama server                 |
 * | OLLAMA_MODEL           | No       | gemma4:latest            | Model tag to load for local inference               |
 * | GEMMA_CLOUD_ENDPOINT   | No       | —                        | Full URL of the cloud chat completions endpoint     |
 * | GEMMA_CLOUD_API_KEY    | No       | —                        | Bearer token / API key for cloud authentication     |
 * | GEMMA_CLOUD_MODEL      | No       | —                        | Optional model name to include in cloud requests    |
 * | GEMMA_CLOUD_NAME       | No       | cloud-gemma              | Human-readable label for the cloud provider         |
 *
 * All variables are optional at the module level. The application degrades
 * gracefully: if only Ollama config is present, cloud is skipped; if only
 * cloud config is present, Ollama health checks will fail and cloud is used.
 * If neither is configured, inference calls throw `AIServiceError`.
 */
export const aiConfig = {
  ollama: {
    /** Base URL for the local Ollama server. */
    baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    /** Ollama model tag (e.g. 'gemma4:latest', 'gemma4:27b'). */
    model: process.env.OLLAMA_MODEL ?? 'gemma4:latest',
  },
  cloud: {
    /**
     * Full URL of the cloud endpoint.
     * Empty string means no cloud provider is configured.
     */
    endpoint: process.env.GEMMA_CLOUD_ENDPOINT ?? '',
    /**
     * Bearer token / API key.
     * Empty string means no cloud provider is configured.
     */
    apiKey: process.env.GEMMA_CLOUD_API_KEY ?? '',
    /**
     * Optional model name to include in cloud request body.
     * Leave unset if the endpoint infers the model from the URL.
     */
    model: process.env.GEMMA_CLOUD_MODEL,
    /** Human-readable label used in logs and error messages. */
    name: process.env.GEMMA_CLOUD_NAME ?? 'cloud-gemma',
  },
} as const;
