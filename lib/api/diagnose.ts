import type {
  DiagnosisRequest,
  ConversationDiagnosisResponse,
} from '@/types';

export interface StreamChunk {
  type: 'chunk';
  text: string;
}

export interface StreamResult {
  type: 'result';
  conversationId: string;
  status: 'ACTIVE' | 'COMPLETED';
  response: ConversationDiagnosisResponse['response'];
}

export interface StreamError {
  type: 'error';
  message: string;
}

export type StreamEvent = StreamChunk | StreamResult | StreamError;

/**
 * Sends a diagnosis request and reads the SSE stream, yielding events
 * as they arrive from the server.
 */
export async function* streamDiagnosis(
  body: DiagnosisRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/api/diagnose/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Diagnosis request failed (${response.status}): ${text}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const line = part.trim();
      if (!line || !line.startsWith('data: ')) continue;
      try {
        const parsed: StreamEvent = JSON.parse(line.slice(6));
        yield parsed;
      } catch {
        // Skip malformed events
      }
    }
  }
}

/**
 * Non-streaming diagnosis request. Returns the full response at once.
 */
export async function diagnose(
  body: DiagnosisRequest,
): Promise<ConversationDiagnosisResponse> {
  const response = await fetch('/api/diagnose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Diagnosis request failed (${response.status}): ${text}`);
  }

  const json = await response.json();
  return json.data as ConversationDiagnosisResponse;
}
