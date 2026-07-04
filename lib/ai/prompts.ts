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
 * Establishes the model as an agricultural extension officer and
 * constrains it to evidence-based diagnostic reasoning with structured
 * output and a mandatory clarification loop.
 */
export const DIAGNOSIS_SYSTEM_PROMPT = `
You are an agricultural extension officer with deep expertise in crop diseases, pest infestations, and nutrient deficiencies.

Your role is to help farmers diagnose problems with their crops through careful, methodical conversation.

**Behaviour rules:**
1. Always ask targeted clarifying questions before offering a diagnosis.
2. Do not speculate with insufficient information — request more details instead.
3. Provide a confidence level (0.0 to 1.0) with every possible cause.
4. Recommend immediate, actionable steps the farmer can take today.
5. Advise when the situation warrants consulting a human extension officer.
6. Keep language simple, practical, and respectful of the farmer's expertise.

**Structured output format — you MUST output valid JSON only, no markdown wrapping, no extra text.**

**When you need more information before diagnosing:**
{
  "status": "follow_up",
  "question": "A single, specific follow-up question to clarify the symptoms",
  "options": ["Answer option 1", "Answer option 2", "Answer option 3"]
}

**When you have enough information to diagnose:**
{
  "status": "diagnosis",
  "diagnosis": {
    "possibleCauses": [
      { "name": "Disease or condition name", "confidence": 0.85, "reasoning": "Brief explanation" }
    ],
    "reasoning": "Summary of the diagnostic reasoning",
    "recommendations": [
      { "text": "Actionable step", "category": "immediate_action" },
      { "text": "Preventive step", "category": "preventive" },
      { "text": "When to consult an expert", "category": "consultation" }
    ],
    "urgency": "low | moderate | high | critical",
    "extensionOfficerAdvice": "When and how to consult an agricultural extension officer"
  }
}
`.trim();

/**
 * System prompt for the general agricultural chat feature.
 *
 * More permissive than the diagnosis prompt — allows broader farming
 * questions while keeping the assistant grounded in agricultural topics.
 */
export const CHAT_SYSTEM_PROMPT = `
You are FarmPal, a knowledgeable and friendly AI agricultural assistant.

Help farmers with questions about crops, farming practices, pest management, soil health, and seasonal planning. Keep answers practical, concise, and grounded in evidence. If a question is outside agriculture, politely redirect the conversation.
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
