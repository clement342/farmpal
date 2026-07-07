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
 */

const MONGODB_URI: string =
  process.env.MONGODB_URI ??
  'mongodb://farmpal:farmpal_secret@localhost:27017/farmpal?authSource=admin';

/**
 * Global cache to persist the connection across hot reloads in development.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnection: Promise<typeof mongoose> | undefined;
}

const cachedConnection: { promise?: Promise<typeof mongoose> } = {};

/**
 * Connects to MongoDB and returns the Mongoose instance.
 *
 * Uses a cached connection when available. In development mode the
 * cache is stored on `globalThis` to survive hot module replacement.
 *
 * @returns The connected Mongoose instance
 * @throws If the connection fails
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cachedConnection.promise) {
    return cachedConnection.promise;
  }

  cachedConnection.promise = mongoose
    .connect(MONGODB_URI, {
      // Mongoose 8 uses the new URL parser and unified topology by default.
    })
    .then((instance) => {
      console.log('[DB] Connected to MongoDB');
      return instance;
    })
    .catch((error) => {
      console.error('[DB] Failed to connect to MongoDB:', error);
      cachedConnection.promise = undefined;
      throw error;
    });

  // Persist across hot reloads in development
  if (process.env.NODE_ENV !== 'production') {
    globalThis._mongooseConnection = cachedConnection.promise;
  }

  return cachedConnection.promise;
}

/**
 * Disconnects from MongoDB.
 *
 * Useful for graceful shutdown in tests and serverless cleanup.
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (cachedConnection.promise) {
    await mongoose.disconnect();
    cachedConnection.promise = undefined;
    console.log('[DB] Disconnected from MongoDB');
  }
}
