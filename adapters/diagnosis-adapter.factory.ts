import type { ChatMessage } from '@/types';
import type { DiagnosisRequest, DiagnosisResponse } from '@/types/diagnosis';
import type { Crop } from '@/types/crop';

export type GenerateDiagnosisFn = (
  request: DiagnosisRequest,
  crop?: Crop,
  existingMessages?: ChatMessage[],
) => Promise<DiagnosisResponse>;

export type StreamDiagnosisFn = (
  request: DiagnosisRequest,
  crop?: Crop,
  existingMessages?: ChatMessage[],
) => AsyncGenerator<string>;

let cachedAdapter: GenerateDiagnosisFn | null = null;
let cachedStreamAdapter: StreamDiagnosisFn | null = null;
let cachedProviderName: string = 'unknown';

function shouldUseMock(): boolean {
  return process.env.USE_MOCK_AI === 'true';
}

async function loadAdapter(): Promise<GenerateDiagnosisFn> {
  if (shouldUseMock()) {
    cachedProviderName = 'mock';
    const mod = await import('@/adapters/mock-ai/diagnosis.adapter');
    return mod.generateDiagnosis;
  }
  cachedProviderName = 'ai';
  const mod = await import('@/adapters/diagnosis/DiagnosisAIAdapter');
  return mod.generateDiagnosis;
}

async function loadStreamAdapter(): Promise<StreamDiagnosisFn> {
  if (shouldUseMock()) {
    // Mock adapter doesn't support native streaming — wrap generateDiagnosis
    const mod = await import('@/adapters/mock-ai/diagnosis.adapter');
    return async function* (request, crop?) {
      const result = await mod.generateDiagnosis(request, crop);
      yield JSON.stringify(result);
    };
  }
  const mod = await import('@/adapters/diagnosis/DiagnosisAIAdapter');
  return mod.streamDiagnosis;
}

export async function getDiagnosisAdapter(): Promise<GenerateDiagnosisFn> {
  if (!cachedAdapter) {
    cachedAdapter = await loadAdapter();
  }
  return cachedAdapter;
}

export async function getStreamDiagnosisAdapter(): Promise<StreamDiagnosisFn> {
  if (!cachedStreamAdapter) {
    cachedStreamAdapter = await loadStreamAdapter();
  }
  return cachedStreamAdapter;
}

export function getAdapterProviderName(): string {
  return cachedProviderName;
}

export function resetAdapterCache(): void {
  cachedAdapter = null;
  cachedStreamAdapter = null;
  cachedProviderName = 'unknown';
}
