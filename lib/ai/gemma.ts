/**
 * @deprecated
 * This file was the original Gemma client stub.
 *
 * It has been superseded by the hybrid provider architecture in:
 *   - lib/ai/providers/ollama.provider.ts   ← local Ollama + Gemma 4
 *   - lib/ai/providers/cloud.provider.ts    ← cloud / remote endpoint
 *   - lib/ai/index.ts                       ← public infer() function
 *
 * This file will be removed in a future cleanup pass once all callers
 * have migrated to `import { infer } from '@/lib/ai'`.
 */

export {};
