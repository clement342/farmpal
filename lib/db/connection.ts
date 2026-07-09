import mongoose from 'mongoose';

/**
 * Database connection module.
 *
 * Manages a singleton MongoDB connection via Mongoose.
 * During development, the connection is cached in the global scope
 * to avoid re-initialising on every hot-reload.
 *
 * Configuration:
 *   Reads MONGODB_URI from environment variables.
 *   Defaults to localhost:27017/farmpal if not set.
 *
 * ## Offline backoff
 *
 * When a connection attempt fails, the manager records the failure
 * timestamp and refuses further attempts for RECONNECT_BACKOFF_MS
 * (30 seconds). Callers receive the original error immediately
 * rather than waiting for another timeout on every request.
 *
 * After the backoff window expires the next call retries normally.
 * A successful connection clears the backoff state.
 */

const MONGODB_URI: string =
  process.env.MONGODB_URI ??
  'mongodb://farmpal:farmpal_secret@localhost:27017/farmpal?authSource=admin';

/** How long to wait after a failure before retrying (milliseconds). */
const RECONNECT_BACKOFF_MS = 30_000;

/**
 * Global cache to persist the connection across hot reloads in development.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnection: Promise<typeof mongoose> | undefined;
}

const cachedConnection: {
  promise?: Promise<typeof mongoose>;
  /** Unix timestamp (ms) of the last connection failure, or 0. */
  failedAt: number;
  /** The error thrown by the last failed attempt — rethrown during backoff. */
  lastError?: unknown;
} = { failedAt: 0 };

/**
 * Connects to MongoDB and returns the Mongoose instance.
 *
 * Uses a cached connection when available. Returns the cached error
 * immediately if a recent failure is within the backoff window —
 * no new network attempt is made until the window expires.
 *
 * @returns The connected Mongoose instance
 * @throws If the connection fails or is within the backoff window
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  // Return the live connection promise if one exists.
  if (cachedConnection.promise) {
    return cachedConnection.promise;
  }

  // If the last failure is recent, skip the retry and rethrow immediately.
  const now = Date.now();
  if (cachedConnection.failedAt > 0 && now - cachedConnection.failedAt < RECONNECT_BACKOFF_MS) {
    const remaining = Math.ceil((RECONNECT_BACKOFF_MS - (now - cachedConnection.failedAt)) / 1000);
    console.warn(`[DB] MongoDB unavailable — skipping reconnect, retrying in ${remaining}s`);
    throw cachedConnection.lastError ?? new Error('MongoDB connection unavailable (backoff active)');
  }

  cachedConnection.promise = mongoose
    .connect(MONGODB_URI)
    .then((instance) => {
      // Successful connection — clear failure state.
      cachedConnection.failedAt = 0;
      cachedConnection.lastError = undefined;
      console.log('[DB] Connected to MongoDB');
      return instance;
    })
    .catch((error) => {
      // Record the failure timestamp so the backoff window can be enforced.
      cachedConnection.failedAt = Date.now();
      cachedConnection.lastError = error;
      cachedConnection.promise = undefined;
      console.error('[DB] Failed to connect to MongoDB:', error instanceof Error ? error.message : String(error));
      throw error;
    });

  // Persist across hot reloads in development.
  if (process.env.NODE_ENV !== 'production') {
    globalThis._mongooseConnection = cachedConnection.promise;
  }

  return cachedConnection.promise;
}

/**
 * Disconnects from MongoDB and resets all cached state.
 *
 * Useful for graceful shutdown in tests and serverless cleanup.
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (cachedConnection.promise) {
    await mongoose.disconnect();
    cachedConnection.promise = undefined;
    cachedConnection.failedAt = 0;
    cachedConnection.lastError = undefined;
    console.log('[DB] Disconnected from MongoDB');
  }
}

