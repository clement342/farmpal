/**
 * Connectivity test utility for the FarmPal AI layer.
 *
 * Provides standalone functions for testing Ollama (and optionally cloud)
 * reachability outside of the normal inference path. Useful for:
 *   - Application startup checks (log connectivity state on boot)
 *   - Health check API endpoints
 *   - CLI scripts / smoke tests run against a deployment
 *
 * This module intentionally has **no side effects** at import time.
 * All functions are async and can be called on demand.
 *
 * @module
 */

import { createLogger } from './logger';

const log = createLogger('ai:connectivity');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Outcome of a single connectivity probe. */
export interface ProbeResult {
  /** Whether the target was reachable and returned a healthy response. */
  reachable: boolean;
  /** Round-trip latency in milliseconds (0 if the probe failed immediately). */
  latencyMs: number;
  /** Human-readable status detail (e.g. model list or error message). */
  detail: string;
}

/** Full report from {@link checkOllamaConnectivity}. */
export interface OllamaConnectivityReport {
  /** Base URL that was probed. */
  baseUrl: string;
  /** Model name that was checked. */
  model: string;
  /** Whether the Ollama server responded to GET /api/tags. */
  serverReachable: boolean;
  /** Whether the configured model was found in the model list. */
  modelLoaded: boolean;
  /** Whether a minimal chat completion round-trip succeeded. */
  inferenceOk: boolean;
  /** Probe-level detail (per phase). */
  phases: {
    tags: ProbeResult;
    inference?: ProbeResult;
  };
  /** Overall health: true only when server is reachable AND model is loaded. */
  healthy: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Safely fetches a URL with a timeout, never throws. */
async function safeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<{ response: Response | null; latencyMs: number; error: string | null }> {
  const { timeoutMs = 5_000, ...fetchInit } = init;
  const start = Date.now();
  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { response, latencyMs: Date.now() - start, error: null };
  } catch (err) {
    return {
      response: null,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// checkOllamaConnectivity
// ---------------------------------------------------------------------------

/**
 * Runs a multi-phase connectivity check against an Ollama server.
 *
 * **Phases:**
 * 1. `tags` — GET /api/tags to verify the server is up and list loaded models.
 * 2. `inference` — POST /api/chat with a minimal prompt to verify end-to-end
 *    generation. Only runs when `phases.tags` succeeds and the model is found.
 *    Can be skipped by setting `options.skipInferenceProbe = true`.
 *
 * The function never throws — all errors are captured in the result object.
 *
 * @param baseUrl - Ollama server URL (e.g. `http://localhost:11434`).
 * @param model   - Model tag to check (e.g. `gemma4:latest`).
 * @param options - Optional probe configuration.
 * @returns A detailed {@link OllamaConnectivityReport}.
 *
 * @example
 * ```ts
 * import { checkOllamaConnectivity } from '@/lib/ai/connectivity';
 *
 * const report = await checkOllamaConnectivity('http://localhost:11434', 'gemma4:latest');
 * console.log(report.healthy); // true | false
 * ```
 */
export async function checkOllamaConnectivity(
  baseUrl: string,
  model: string,
  options: {
    /**
     * Timeout for the GET /api/tags probe (milliseconds).
     * @default 5_000
     */
    probeTimeoutMs?: number;
    /**
     * Timeout for the POST /api/chat inference probe (milliseconds).
     * @default 30_000
     */
    inferenceTimeoutMs?: number;
    /**
     * When true, skips the inference round-trip and only checks server+model.
     * Faster but less thorough.
     * @default false
     */
    skipInferenceProbe?: boolean;
  } = {},
): Promise<OllamaConnectivityReport> {
  const {
    probeTimeoutMs = 5_000,
    inferenceTimeoutMs = 30_000,
    skipInferenceProbe = false,
  } = options;

  const cleanBase = baseUrl.replace(/\/$/, '');
  log.info('Starting Ollama connectivity check', { baseUrl: cleanBase, model });

  // -------------------------------------------------------------------------
  // Phase 1: GET /api/tags
  // -------------------------------------------------------------------------

  const tagsUrl = `${cleanBase}/api/tags`;
  const { response: tagsResponse, latencyMs: tagsLatency, error: tagsError } =
    await safeFetch(tagsUrl, { timeoutMs: probeTimeoutMs });

  let serverReachable = false;
  let modelLoaded = false;
  let tagsDetail = '';

  if (tagsError || !tagsResponse) {
    tagsDetail = tagsError ?? 'No response';
  } else if (!tagsResponse.ok) {
    tagsDetail = `HTTP ${tagsResponse.status}`;
  } else {
    serverReachable = true;
    try {
      const data = (await tagsResponse.json()) as { models?: Array<{ name: string }> };
      const models = data?.models ?? [];
      const targetLower = model.toLowerCase();
      // Match the full tag exactly, stripping any digest suffix (e.g. "@sha256:...")
      // so "gemma4:e2b@sha256:abc" still matches configured tag "gemma4:e2b".
      modelLoaded = models.some((m) => {
        const tagWithoutDigest = m.name.toLowerCase().split('@')[0];
        return tagWithoutDigest === targetLower;
      });
      const names = models.map((m) => m.name).join(', ') || '(none)';
      tagsDetail = `${models.length} model(s) loaded: ${names}`;
    } catch {
      tagsDetail = 'Could not parse /api/tags response';
    }
  }

  const tagsProbe: ProbeResult = {
    reachable: serverReachable,
    latencyMs: tagsLatency,
    detail: tagsDetail,
  };

  log.debug('Phase 1 (tags) complete', {
    serverReachable,
    modelLoaded,
    latencyMs: tagsLatency,
    detail: tagsDetail,
  });

  // -------------------------------------------------------------------------
  // Phase 2: POST /api/chat (inference round-trip)
  // -------------------------------------------------------------------------

  let inferenceOk = false;
  let inferenceProbe: ProbeResult | undefined;

  if (serverReachable && modelLoaded && !skipInferenceProbe) {
    const chatUrl = `${cleanBase}/api/chat`;
    const body = JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
      stream: false,
      options: { num_predict: 5 },
    });

    const { response: chatResponse, latencyMs: chatLatency, error: chatError } =
      await safeFetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: inferenceTimeoutMs,
      });

    let inferenceDetail = '';

    if (chatError || !chatResponse) {
      inferenceDetail = chatError ?? 'No response';
    } else if (!chatResponse.ok) {
      inferenceDetail = `HTTP ${chatResponse.status}`;
    } else {
      try {
        const data = (await chatResponse.json()) as {
          message?: { content?: string };
        };
        const content = data?.message?.content?.trim() ?? '';
        inferenceOk = content.length > 0;
        inferenceDetail = inferenceOk
          ? `Response received (${content.length} chars)`
          : 'Empty response body';
      } catch {
        inferenceDetail = 'Could not parse /api/chat response';
      }
    }

    inferenceProbe = {
      reachable: inferenceOk,
      latencyMs: chatLatency,
      detail: inferenceDetail,
    };

    log.debug('Phase 2 (inference) complete', {
      inferenceOk,
      latencyMs: chatLatency,
      detail: inferenceDetail,
    });
  }

  const report: OllamaConnectivityReport = {
    baseUrl: cleanBase,
    model,
    serverReachable,
    modelLoaded,
    inferenceOk,
    phases: {
      tags: tagsProbe,
      ...(inferenceProbe ? { inference: inferenceProbe } : {}),
    },
    healthy: serverReachable && modelLoaded,
  };

  log.info('Connectivity check complete', {
    healthy: report.healthy,
    serverReachable,
    modelLoaded,
    inferenceOk,
  });

  return report;
}

// ---------------------------------------------------------------------------
// checkCloudConnectivity
// ---------------------------------------------------------------------------

/** Google AI Studio base URL — same constant used by CloudProvider. */
const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Lightweight availability check for Google AI Studio.
 *
 * Sends a HEAD request to the generateContent endpoint for the configured
 * model. Any HTTP response — including 4xx — means the host is reachable.
 * No inference call is made; this only verifies network reachability.
 *
 * @param apiKey  - Google AI Studio API key (`GOOGLE_API_KEY`).
 * @param model   - Gemini model name (e.g. `gemini-2.0-flash`).
 * @param options - Optional probe configuration.
 * @returns A {@link ProbeResult} describing the probe outcome.
 *
 * @example
 * ```ts
 * const result = await checkCloudConnectivity(process.env.GOOGLE_API_KEY!, 'gemini-2.0-flash');
 * console.log(result.reachable); // true if host responds
 * ```
 */
export async function checkCloudConnectivity(
  apiKey: string,
  model: string,
  options: {
    /**
     * Timeout for the HEAD probe (milliseconds).
     * @default 8_000
     */
    timeoutMs?: number;
  } = {},
): Promise<ProbeResult> {
  const { timeoutMs = 8_000 } = options;

  if (!apiKey) {
    return {
      reachable: false,
      latencyMs: 0,
      detail: 'GOOGLE_API_KEY not configured',
    };
  }

  // Build the same endpoint URL CloudProvider uses, appending the API key
  // as a query parameter (Google AI Studio's authentication scheme).
  const endpoint = `${GOOGLE_BASE_URL}/${model}:generateContent`;

  log.info('Starting Google AI Studio connectivity check', { model });

  const { response, latencyMs, error } = await safeFetch(endpoint, {
    method: 'HEAD',
    headers: { 'x-goog-api-key': apiKey },
    timeoutMs,
  });

  if (error || !response) {
    const detail = error ?? 'No response';
    log.warn('Google AI Studio connectivity check failed', { model, detail });
    return { reachable: false, latencyMs, detail };
  }

  // Any HTTP response means the host is reachable (even 400/403/405).
  const detail = `HTTP ${response.status}`;
  log.info('Google AI Studio connectivity check complete', { model, detail, latencyMs });
  return { reachable: true, latencyMs, detail };
}
