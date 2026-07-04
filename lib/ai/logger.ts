/**
 * Structured logger for the FarmPal AI layer.
 *
 * Wraps the platform's console output with a consistent JSON-friendly
 * structure. Every log entry carries:
 *   - `level`   — severity ('debug' | 'info' | 'warn' | 'error')
 *   - `ns`      — namespace string (e.g. 'ai:ollama', 'ai:router')
 *   - `msg`     — human-readable message
 *   - `ts`      — ISO-8601 timestamp
 *   - any extra key/value context passed by the caller
 *
 * ## Why not a third-party library?
 *
 * FarmPal has no runtime logging dependency yet. This thin wrapper keeps
 * the AI layer self-contained and is easy to swap for `pino` or `winston`
 * later without changing call sites — just update `emit()` below.
 *
 * ## Log levels
 *
 * The active minimum level is controlled by the `LOG_LEVEL` environment
 * variable. Valid values (case-insensitive): `debug`, `info`, `warn`, `error`.
 * Defaults to `info` in production and `debug` in development.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured log entry shape written to stdout/stderr. */
export interface LogEntry {
  level: LogLevel;
  ns: string;
  msg: string;
  ts: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Level ordering
// ---------------------------------------------------------------------------

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? '').toLowerCase();
  if (raw in LEVEL_ORDER) return raw as LogLevel;
  // Default: debug in development, info otherwise
  return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

const MIN_LEVEL: LogLevel = resolveMinLevel();

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

/**
 * Writes a structured log entry.
 *
 * In production (NODE_ENV=production) entries are serialised to JSON on a
 * single line so log aggregators (CloudWatch, Datadog, etc.) can parse them.
 * In development they are pretty-printed with colour for readability.
 *
 * To integrate a full logging library, replace the body of this function.
 */
function emit(entry: LogEntry): void {
  if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[MIN_LEVEL]) return;

  if (process.env.NODE_ENV === 'production') {
    // Single-line JSON — easy to ingest by log aggregators
    const line = JSON.stringify(entry);
    if (entry.level === 'error' || entry.level === 'warn') {
      console.error(line);
    } else {
      console.log(line);
    }
    return;
  }

  // Development: human-readable format
  const { level, ns, msg, ts, ...rest } = entry;
  const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${ns}]`;
  const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  const line = `${prefix} ${msg}${extras}`;

  switch (level) {
    case 'debug': console.debug(line); break;
    case 'info':  console.info(line);  break;
    case 'warn':  console.warn(line);  break;
    case 'error': console.error(line); break;
  }
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

/**
 * A namespaced logger instance.
 *
 * @example
 * ```ts
 * const log = createLogger('ai:ollama');
 * log.info('probe succeeded', { model: 'gemma4:latest', durationMs: 42 });
 * log.error('request failed', { status: 503, attempt: 2 });
 * ```
 */
export interface Logger {
  debug(msg: string, context?: Record<string, unknown>): void;
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
  /** Returns a child logger with an extended namespace. */
  child(subNs: string): Logger;
}

/**
 * Creates a logger scoped to the given namespace string.
 *
 * @param ns - Namespace, e.g. `'ai:router'`, `'ai:ollama'`.
 */
export function createLogger(ns: string): Logger {
  const log = (level: LogLevel, msg: string, context?: Record<string, unknown>): void => {
    emit({ level, ns, msg, ts: new Date().toISOString(), ...context });
  };

  return {
    debug: (msg, ctx) => log('debug', msg, ctx),
    info:  (msg, ctx) => log('info',  msg, ctx),
    warn:  (msg, ctx) => log('warn',  msg, ctx),
    error: (msg, ctx) => log('error', msg, ctx),
    child: (subNs) => createLogger(`${ns}:${subNs}`),
  };
}
