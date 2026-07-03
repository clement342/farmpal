import type { ChatMessage } from '@/types';
import { generateCompletion, isLocalModelAvailable } from './gemma';

// TODO: Implement connection manager for local vs. cloud routing.
// TODO: Add model selection logic based on task type.

/**
 * Inference orchestrator.
 *
 * Routes inference requests to the appropriate Gemma runtime
 * (local Ollama or cloud endpoint) based on availability and
 * configuration. Provides a unified interface for the rest of
 * the application.
 *
 * TODO:
 * - Implement automatic fallback from local to cloud
 * - Add request queuing and rate limiting
 * - Add telemetry hooks for monitoring
 * - Implement streaming response support
 */

/**
 * Sends a chat completion request to the available Gemma runtime.
 *
 * Attempts local inference first. Falls back to the cloud endpoint
 * if the local runtime is unavailable and a cloud URL is configured.
 *
 * @param messages - The conversation history
 * @returns The model's response text
 *
 * TODO: Implement fallback logic.
 *       Call isLocalModelAvailable() and route accordingly.
 */
export async function infer(messages: ChatMessage[]): Promise<string> {
  // TODO: Implement local-first routing
  // 1. Check if local model is available
  // 2. If yes, run inference locally via Ollama
  // 3. If no, check for cloud endpoint config
  // 4. If cloud is configured, run inference via cloud API
  // 5. If neither is available, throw AIServiceError

  return generateCompletion(messages);
}
