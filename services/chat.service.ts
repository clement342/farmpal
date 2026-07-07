import type { ChatMessage, ChatRequest, ChatResponse } from '@/types';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';

export async function processChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  const { messages, cropContext } = request;

  const extraContext = cropContext?.cropName
    ? `Crop: ${cropContext.cropName}`
    : undefined;

  const aiMessages = buildSystemMessages('chat', messages, extraContext);

  const rawText = await infer(aiMessages, {
    task: 'chat',
    temperature: 0.3,
  });

  const reply: ChatMessage = {
    id: crypto.randomUUID(),
    content: rawText,
    role: 'assistant',
    createdAt: new Date().toISOString(),
  };

  return {
    message: reply,
    suggestions: [
      'Tell me more about the symptoms',
      'Which crop is affected?',
      'When did you first notice this?',
    ],
  };
}
