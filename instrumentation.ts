/**
 * Next.js instrumentation hook.
 *
 * Next.js calls `register()` once per server worker process on startup,
 * before the first request is handled. This is the correct place for
 * one-time initialisation that must not affect request latency.
 *
 * ## What this does
 *
 * 1. Guards against the Edge runtime — the AI layer uses Node.js APIs
 *    (fetch with AbortSignal.timeout, process.env) that are available in
 *    Edge, but the provider singletons in `lib/ai/index.ts` are Node-only
 *    module-scope objects. We only run in the 'nodejs' runtime.
 *
 * 2. Fires a non-blocking connectivity check via `checkOllamaConnectivity()`
 *    and logs the result (server reachable, model loaded, latency).
 *
 * 3. Logs whether the cloud fallback is configured (no network probe —
 *    `CloudProvider.isAvailable()` is a pure config check).
 *
 * 4. Warms the availability cache for every registered provider by calling
 *    `isAvailable()` on each one. For `OllamaProvider` this populates the
 *    30-second TTL cache so the first real request skips the probe entirely.
 *    For `CloudProvider` it is a no-op (synchronous config check).
 *
 * ## Non-blocking guarantee
 *
 * `register()` returns `void` (not a Promise). The connectivity work is
 * kicked off with an unhandled Promise and any error is caught internally.
 * Next.js does not await `register()` results, and even if it did, we never
 * resolve until after startup completes. This means startup is never delayed
 * regardless of Ollama's response time.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { createLogger } from '@/lib/ai/logger';

const log = createLogger('startup');

export async function register(): Promise<void> {
  // Guard: only run in the Node.js server runtime.
  // NEXT_RUNTIME is 'nodejs' for the Node server worker and 'edge' for the
  // Edge runtime. We skip silently in Edge — no AI layer there.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // Kick off the startup check without awaiting it.
  // Any unhandled rejection is caught inside runStartupChecks().
  void runStartupChecks();
}

// ---------------------------------------------------------------------------
// Startup check implementation
// ---------------------------------------------------------------------------

async function runStartupChecks(): Promise<void> {
  try {
    // Dynamic imports keep these modules out of the Edge bundle entirely.
    // They also ensure the check runs after the module graph is fully
    // initialised, which matters for the defaultRegistry singleton.
    const [{ aiConfig }, { checkOllamaConnectivity }, { defaultRegistry }] =
      await Promise.all([
        import('@/lib/ai/config'),
        import('@/lib/ai/connectivity'),
        import('@/lib/ai/index'),
      ]);

    log.info('FarmPal AI startup check beginning', {
      ollamaBaseUrl: aiConfig.ollama.baseUrl,
      ollamaModel: aiConfig.ollama.model,
      cloudConfigured: aiConfig.cloud.apiKey.length > 0,
    });

    // -----------------------------------------------------------------------
    // 1. Ollama connectivity check (network probe)
    //    skipInferenceProbe = true — we only need server + model detection.
    //    A full inference round-trip at startup wastes resources and adds
    //    seconds of latency before the first log line appears.
    // -----------------------------------------------------------------------
    const ollamaReport = await checkOllamaConnectivity(
      aiConfig.ollama.baseUrl,
      aiConfig.ollama.model,
      { skipInferenceProbe: true, probeTimeoutMs: 5_000 },
    );

    if (ollamaReport.healthy) {
      log.info('Ollama: reachable and model loaded', {
        model: aiConfig.ollama.model,
        latencyMs: ollamaReport.phases.tags.latencyMs,
        detail: ollamaReport.phases.tags.detail,
      });
    } else if (ollamaReport.serverReachable && !ollamaReport.modelLoaded) {
      log.warn('Ollama: server reachable but configured model is not loaded', {
        model: aiConfig.ollama.model,
        detail: ollamaReport.phases.tags.detail,
        hint: `Run: ollama pull ${aiConfig.ollama.model}`,
      });
    } else {
      log.warn('Ollama: server unreachable', {
        baseUrl: aiConfig.ollama.baseUrl,
        detail: ollamaReport.phases.tags.detail,
        hint: 'Ensure Ollama is running. Cloud fallback will be used if configured.',
      });
    }

    // -----------------------------------------------------------------------
    // 2. Cloud fallback status (config-only check, no network call)
    // -----------------------------------------------------------------------
    const cloudConfigured = aiConfig.cloud.apiKey.length > 0;

    if (cloudConfigured) {
      log.info('Cloud fallback: configured (Google AI Studio)', {
        model: aiConfig.cloud.model,
      });
    } else {
      log.info('Cloud fallback: not configured (offline-only mode)');
    }

    // -----------------------------------------------------------------------
    // 3. Warm the availability cache for all registered providers.
    //    Calling isAvailable() here means the first real inference request
    //    gets a cached result instead of paying the probe cost inline.
    // -----------------------------------------------------------------------
    const providers = defaultRegistry.getAll();
    await Promise.all(
      providers.map(async (provider) => {
        try {
          const available = await provider.isAvailable();
          log.debug('Provider cache warmed', {
            provider: provider.name,
            available,
          });
        } catch (err) {
          // isAvailable() should never throw, but guard regardless.
          log.debug('Provider cache warm failed (non-fatal)', {
            provider: provider.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );

    log.info('FarmPal AI startup check complete', {
      ollamaHealthy: ollamaReport.healthy,
      cloudConfigured,
      providersWarmed: providers.length,
    });
  } catch (err) {
    // Startup checks are best-effort. A failure here must never crash the
    // server or affect request handling in any way.
    log.warn('FarmPal AI startup check encountered an unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
