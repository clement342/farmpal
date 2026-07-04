/**
 * GET /api/health
 *
 * Standalone health check endpoint for the FarmPal AI layer.
 *
 * Returns the availability status of all configured AI providers so that
 * load balancers, container orchestrators (Kubernetes liveness/readiness),
 * and monitoring dashboards can surface AI backend health in real time.
 *
 * ## Response shape
 *
 * ```json
 * {
 *   "status": "ok" | "degraded" | "unavailable",
 *   "timestamp": "2025-01-01T00:00:00.000Z",
 *   "providers": {
 *     "ollama": {
 *       "status": "ok" | "unavailable",
 *       "serverReachable": true,
 *       "modelLoaded": true,
 *       "inferenceOk": true,
 *       "latencyMs": 42,
 *       "detail": "3 model(s) loaded: gemma4:latest, ..."
 *     },
 *     "cloud": {
 *       "status": "ok" | "unconfigured" | "unavailable",
 *       "latencyMs": 150,
 *       "detail": "HTTP 200"
 *     }
 *   }
 * }
 * ```
 *
 * ## HTTP status codes
 *
 * | Condition                          | Status |
 * |------------------------------------|--------|
 * | At least one provider is healthy   | 200    |
 * | All providers are down/unconfigured| 503    |
 *
 * ## Performance
 *
 * Provider checks run in parallel. Total response time is dominated by the
 * slowest individual probe (typically the Ollama tags call, ~5 s timeout).
 * The endpoint itself has a hard cap of 10 s before returning a 503.
 */

import { NextResponse } from 'next/server';
import { aiConfig } from '@/lib/ai/config';
import { checkOllamaConnectivity, checkCloudConnectivity } from '@/lib/ai/connectivity';
import { createLogger } from '@/lib/ai/logger';

const log = createLogger('api:health');

// Hard cap on total probe time. Must be under typical load-balancer timeouts.
const HEALTH_CHECK_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

type ProviderStatus = 'ok' | 'unavailable' | 'unconfigured';
type OverallStatus = 'ok' | 'degraded' | 'unavailable';

interface OllamaHealth {
  status: ProviderStatus;
  serverReachable: boolean;
  modelLoaded: boolean;
  inferenceOk: boolean;
  latencyMs: number;
  detail: string;
}

interface CloudHealth {
  status: ProviderStatus;
  latencyMs: number;
  detail: string;
}

interface HealthResponse {
  status: OverallStatus;
  timestamp: string;
  providers: {
    ollama: OllamaHealth;
    cloud: CloudHealth;
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const timestamp = new Date().toISOString();
  log.info('Health check requested');

  // -------------------------------------------------------------------------
  // Run provider checks in parallel with a hard timeout
  // -------------------------------------------------------------------------

  const ollamaCheck = checkOllamaConnectivity(
    aiConfig.ollama.baseUrl,
    aiConfig.ollama.model,
    // Skip inference probe on health endpoint — we only need to know if Ollama
    // is up and the model is loaded. Full inference probes are too slow for a
    // liveness check and consume resources unnecessarily.
    { skipInferenceProbe: true, probeTimeoutMs: 5_000 },
  );

  const cloudConfigured =
    aiConfig.cloud.endpoint.length > 0 && aiConfig.cloud.apiKey.length > 0;

  const cloudCheck = cloudConfigured
    ? checkCloudConnectivity(aiConfig.cloud.endpoint, aiConfig.cloud.apiKey, {
        timeoutMs: 8_000,
      })
    : Promise.resolve({ reachable: false, latencyMs: 0, detail: 'Not configured' });

  // Race all checks against the hard timeout
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Health check timed out')), HEALTH_CHECK_TIMEOUT_MS),
  );

  let ollamaResult: Awaited<typeof ollamaCheck>;
  let cloudResult: Awaited<typeof cloudCheck>;

  try {
    [ollamaResult, cloudResult] = await Promise.race([
      Promise.all([ollamaCheck, cloudCheck]),
      timeout,
    ]);
  } catch (err) {
    log.error('Health check timed out or threw unexpectedly', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Return a degraded response rather than a 500
    const fallback: HealthResponse = {
      status: 'unavailable',
      timestamp,
      providers: {
        ollama: {
          status: 'unavailable',
          serverReachable: false,
          modelLoaded: false,
          inferenceOk: false,
          latencyMs: 0,
          detail: 'Health check timed out',
        },
        cloud: {
          status: cloudConfigured ? 'unavailable' : 'unconfigured',
          latencyMs: 0,
          detail: 'Health check timed out',
        },
      },
    };
    return NextResponse.json(fallback, { status: 503 });
  }

  // -------------------------------------------------------------------------
  // Build response
  // -------------------------------------------------------------------------

  const ollamaHealth: OllamaHealth = {
    status: ollamaResult.healthy ? 'ok' : 'unavailable',
    serverReachable: ollamaResult.serverReachable,
    modelLoaded: ollamaResult.modelLoaded,
    inferenceOk: ollamaResult.inferenceOk,
    latencyMs: ollamaResult.phases.tags.latencyMs,
    detail: ollamaResult.phases.tags.detail,
  };

  const cloudHealth: CloudHealth = {
    status: !cloudConfigured ? 'unconfigured' : cloudResult.reachable ? 'ok' : 'unavailable',
    latencyMs: cloudResult.latencyMs,
    detail: cloudResult.detail,
  };

  // Overall status logic:
  //   ok         — at least one provider is fully healthy
  //   degraded   — at least one provider ok but another is down
  //   unavailable — no provider is healthy
  const providerStatuses = [ollamaHealth.status, cloudHealth.status];
  const healthyCount = providerStatuses.filter((s) => s === 'ok').length;
  const configuredCount = providerStatuses.filter((s) => s !== 'unconfigured').length;
  const downCount = providerStatuses.filter((s) => s === 'unavailable').length;

  let overallStatus: OverallStatus;
  if (healthyCount === 0) {
    overallStatus = 'unavailable';
  } else if (healthyCount < configuredCount && downCount > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'ok';
  }

  const body: HealthResponse = {
    status: overallStatus,
    timestamp,
    providers: { ollama: ollamaHealth, cloud: cloudHealth },
  };

  const httpStatus = overallStatus === 'unavailable' ? 503 : 200;

  log.info('Health check complete', {
    status: overallStatus,
    ollamaOk: ollamaResult.healthy,
    cloudOk: cloudHealth.status === 'ok',
  });

  return NextResponse.json(body, { status: httpStatus });
}
