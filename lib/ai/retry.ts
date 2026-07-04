/**
 * Exponential backoff retry utility for the FarmPal AI layer.
 *
 * Provides a single `withRetry()` function that wraps any async operation
 * with configurable retry behaviour: max attempts, base delay, jitter, and
 * a predicate to decide which errors are retryable.
 *
 * ## Design notes
 *
 * - **No external dependencies.** Uses `setTimeout` via a small `sleep()`
 *   helper so tests can swap it out without patching globals.
 * - **Full jitter** is applied by default. This avoids thundering-herd
 *   problems when many requests fail simultaneously (e.g. Ollama restart).
 * - **Non-retryable errors** (e.g. 4xx HTTP, schema errors) are re-thrown
 *   immediately without consuming retry budget.
 *
 * ## Usage
 *
 * ```ts
 * import { withRetry } from '@/lib/ai/retry';
 *
 * const result = await withRetry(
 *   () => fetch(url, { method: 'POST', body: JSON.stringify(payload) }),
 *   { maxAttempts: 3, baseDelayMs: 500 },
 * );
 * ```
 *
 * @module
 */

import { createLogger } from './logger';

const log = createLogger('ai:retry');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /**
   * Maximum number of attempts (including the first).
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Initial delay before the first retry (milliseconds).
   * Each subsequent retry doubles this value before jitter is applied.
   * @default 300
   */
  baseDelayMs?: number;

  /**
   * Hard cap on the delay between retries (milliseconds).
   * Prevents runaway backoff for long-lived processes.
   * @default 10_000
   */
  maxDelayMs?: number;

  /**
   * Multiplier applied to the delay on each retry.
   * @default 2
   */
  backoffFactor?: number;

  /**
   * When true, adds a random fraction of the computed delay (full jitter).
   * Helps distribute retries when many clients hit the same server.
   * @default true
   */
  jitter?: boolean;

  /**
   * Optional predicate. Return `true` to allow a retry, `false` to
   * rethrow immediately. Useful for skipping retries on 4xx errors.
   *
   * @default () => true (retry all errors)
   */
  isRetryable?: (error: unknown, attempt: number) => boolean;

  /**
   * Human-readable label for log messages (e.g. 'Ollama /api/chat').
   */
  label?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns a promise that resolves after `ms` milliseconds. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Computes the delay before the next attempt.
 *
 * Formula: min(baseDelay * factor^(attempt-1), maxDelay) with optional jitter.
 */
function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number,
  jitter: boolean,
): number {
  const exponential = baseDelayMs * Math.pow(backoffFactor, attempt - 1);
  const capped = Math.min(exponential, maxDelayMs);
  return jitter ? Math.random() * capped : capped;
}

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

/**
 * Executes `fn` with exponential backoff retry on failure.
 *
 * @param fn      - The async operation to retry.
 * @param options - Retry configuration.
 * @returns The resolved value of `fn` on success.
 * @throws The last error encountered after all attempts are exhausted.
 *
 * @example
 * ```ts
 * const response = await withRetry(
 *   () => fetch('http://localhost:11434/api/chat', { method: 'POST', body }),
 *   { maxAttempts: 3, baseDelayMs: 500, label: 'Ollama /api/chat' },
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 10_000,
    backoffFactor = 2,
    jitter = true,
    isRetryable = () => true,
    label = 'operation',
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const retryable = isRetryable(err, attempt);
      const isLastAttempt = attempt === maxAttempts;

      if (!retryable || isLastAttempt) {
        if (!retryable) {
          log.debug('Non-retryable error, aborting', {
            label,
            attempt,
            error: err instanceof Error ? err.message : String(err),
          });
        } else {
          log.warn('All retry attempts exhausted', {
            label,
            attempt,
            maxAttempts,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        throw err;
      }

      const delayMs = computeDelay(attempt, baseDelayMs, maxDelayMs, backoffFactor, jitter);

      log.debug('Attempt failed, retrying', {
        label,
        attempt,
        maxAttempts,
        delayMs: Math.round(delayMs),
        error: err instanceof Error ? err.message : String(err),
      });

      await sleep(delayMs);
    }
  }

  // TypeScript path — unreachable at runtime but needed for the type checker
  throw lastError;
}
