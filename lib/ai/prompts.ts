// TODO: Define and version all system prompts used for diagnosis and chat.
//       Prompts should be treated as code — versioned, tested, and reviewed.

/**
 * System prompt for the diagnosis pipeline.
 *
 * Establishes the AI as an agricultural extension officer and
 * constrains its behavior to diagnostic reasoning.
 *
 * TODO:
 * - Finalize role anchoring language
 * - Add structured output format instructions
 * - Add clarification loop instructions
 * - Add crop-specific knowledge injection mechanism
 * - Version prompt templates
 */
export const DIAGNOSIS_SYSTEM_PROMPT = `
You are an agricultural extension officer with expertise in crop diseases, pest infestations, and nutrient deficiencies.

Your role is to help farmers diagnose problems with their crops through conversation.

**Rules:**
1. Ask clarifying questions before offering a diagnosis.
2. Do not guess with insufficient information.
3. Provide confidence levels with every diagnosis.
4. Suggest immediate actionable steps.
5. Recommend when to consult a human extension officer.

**Output format:**
When ready to diagnose, provide:
- Diagnosis name
- Confidence level (0–1)
- Reasoning
- Immediate actions
- Preventive recommendations
- Extension officer consultation advice
`;

/**
 * System prompt for the general chat feature.
 *
 * TODO: Define a more permissive system prompt for non-diagnosis
 *       agricultural questions.
 */
export const CHAT_SYSTEM_PROMPT = `
You are FarmPal, an AI agricultural assistant. Help farmers with their questions about crops, farming practices, and pest management.
`;

/**
 * Returns the appropriate prompt template for a given task.
 *
 * @param task - The type of interaction
 * @returns The system prompt string
 *
 * TODO: Implement dynamic prompt selection and composition.
 *       Add support for injecting crop-specific context.
 */
export function getPrompt(task: 'diagnosis' | 'chat'): string {
  switch (task) {
    case 'diagnosis':
      return DIAGNOSIS_SYSTEM_PROMPT;
    case 'chat':
      return CHAT_SYSTEM_PROMPT;
    default:
      return CHAT_SYSTEM_PROMPT;
  }
}
