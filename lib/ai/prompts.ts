import type { ChatMessage } from '@/types';

/**
 * System prompt templates for FarmPal's AI interactions.
 *
 * Prompts are treated as code: versioned, documented, and reviewed.
 * The intent is that these move to a `lib/ai/prompts/` directory as
 * they grow — one file per task type, with typed builder functions.
 *
 * ## Current prompts
 * - DIAGNOSIS_SYSTEM_PROMPT — for the crop disease diagnosis pipeline
 * - CHAT_SYSTEM_PROMPT      — for general agricultural Q&A
 *
 * ## Usage
 *
 * Use `buildSystemMessages()` to prepend the correct system prompt to
 * a conversation history before calling `infer()`:
 *
 * ```ts
 * import { buildSystemMessages } from '@/lib/ai/prompts';
 * import { infer } from '@/lib/ai';
 *
 * const messages = buildSystemMessages('diagnosis', userMessages);
 * const reply = await infer(messages, { task: 'diagnosis' });
 * ```
 */

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

/**
 * System prompt for the crop disease diagnosis pipeline.
 *
 * Optimized for offline inference on small models (gemma4:e2b).
 * Plain imperative sentences reduce instruction-following errors.
 * The two-shape JSON contract is unchanged — the parser depends on it.
 *
 * Output must be raw JSON only. No prose, no markdown, no code fences.
 */
export const DIAGNOSIS_SYSTEM_PROMPT = `
You are a crop disease expert. Respond with ONLY a valid JSON object. No text before or after the JSON. No markdown. No code fences.

If the farmer's message tells you: (1) which crop, (2) which plant part is affected, and (3) what the symptoms look like — give a diagnosis.
If any of those three are missing — ask for them. Maximum 3 questions.

Diagnosis format:
{"requiresClarification":false,"diagnosis":{"diseaseName":"...","confidence":0.0,"reasoning":"one or two sentences","severity":"low|moderate|high|critical","immediateActions":["action 1","action 2"],"preventiveMeasures":["measure 1","measure 2"],"extensionOfficerAdvice":"..."}}

Clarification format:
{"requiresClarification":true,"followUpQuestions":["question 1","question 2"]}

Constraints:
- confidence: number 0.0 to 1.0
- severity: must be exactly one of low, moderate, high, critical
- immediateActions: 2 to 4 items, short and actionable
- preventiveMeasures: 2 to 4 items, short
- extensionOfficerAdvice: include only when professional help is genuinely needed, otherwise omit the field
- Do not ask questions the farmer already answered
`.trim();

/**
 * System prompt for the general agricultural chat feature.
 *
 * Optimized for offline inference on small models (gemma4:e2b).
 * Explicit length constraint reduces token generation and latency.
 */
export const CHAT_SYSTEM_PROMPT = `
You are FarmPal, an agricultural assistant for farmers. Answer questions about crops, pests, soil, and farming practices.

Rules:
- Keep every answer under 150 words unless the farmer explicitly asks for more detail.
- Be direct and practical. Lead with the most useful information.
- If a question requires more detail to answer well, ask one clarifying question.
- If the topic is not related to farming or agriculture, say so briefly and offer to help with a farming question instead.
`.trim();

// ---------------------------------------------------------------------------
// Prompt selection
// ---------------------------------------------------------------------------

/**
 * Returns the system prompt string for the given task.
 *
 * @param task - 'diagnosis' | 'chat'
 */
export function getSystemPrompt(task: 'diagnosis' | 'chat'): string {
  switch (task) {
    case 'diagnosis':
      return DIAGNOSIS_SYSTEM_PROMPT;
    case 'chat':
      return CHAT_SYSTEM_PROMPT;
  }
}

// ---------------------------------------------------------------------------
// Message builder
// ---------------------------------------------------------------------------

/**
 * Prepends a system message to the given conversation history.
 *
 * The system message uses a stable synthetic ID ('__system__') so that
 * repeated calls with the same conversation do not append duplicate
 * system turns.
 *
 * @param task         - Which system prompt to inject.
 * @param userMessages - The conversation history (user + assistant turns).
 * @param extraContext - Optional extra text appended to the system prompt
 *                       (e.g. crop name, region, growth stage).
 * @returns A new array with the system message prepended.
 *
 * @example
 * ```ts
 * const messages = buildSystemMessages('diagnosis', userMessages, 'Crop: Maize, Region: Kenya');
 * const reply = await infer(messages, { task: 'diagnosis' });
 * ```
 */
export function buildSystemMessages(
  task: 'diagnosis' | 'chat',
  userMessages: ChatMessage[],
  extraContext?: string,
): ChatMessage[] {
  const systemContent = extraContext
    ? `${getSystemPrompt(task)}\n\n${extraContext}`
    : getSystemPrompt(task);

  const systemMessage: ChatMessage = {
    id: '__system__',
    role: 'system',
    content: systemContent,
    createdAt: new Date().toISOString(),
  };

  // Avoid duplicating the system message if the caller already included one
  const hasSystemMessage = userMessages.some((m) => m.role === 'system');
  if (hasSystemMessage) {
    return userMessages;
  }

  return [systemMessage, ...userMessages];
}

// ---------------------------------------------------------------------------
// Legacy alias (backward compat — remove when services are updated)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `getSystemPrompt(task)` instead.
 */
export function getPrompt(task: 'diagnosis' | 'chat'): string {
  return getSystemPrompt(task);
}
