import type { KnowledgeBase } from '@/types/knowledge';
import { loadKnowledge } from './knowledge-loader';

let instance: KnowledgeBase | null = null;

/**
 * Returns the singleton KnowledgeBase, loading it from disk on first call.
 *
 * All subsequent calls return the same in-memory object. This ensures
 * the knowledge files are read exactly once during the application
 * lifecycle, avoiding repeated filesystem I/O on every diagnosis request.
 *
 * The cache is never evicted — knowledge is static data bundled with
 * the application. For development, call `refreshKnowledge()` to reload.
 */
export function getKnowledge(): KnowledgeBase {
  if (!instance) {
    instance = loadKnowledge();
  }
  return instance;
}

/**
 * Forces a reload of all knowledge files.
 *
 * Useful in development when knowledge files change, or if a future
 * runtime update mechanism is implemented.
 */
export function refreshKnowledge(): KnowledgeBase {
  instance = loadKnowledge();
  return instance;
}

/**
 * Resets the cache (primarily for testing).
 */
export function resetKnowledgeCache(): void {
  instance = null;
}
