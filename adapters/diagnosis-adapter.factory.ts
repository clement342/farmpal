import type { DiagnosisRequest, DiagnosisResponse } from '@/types/diagnosis';
import type { Crop } from '@/types/crop';

export type GenerateDiagnosisFn = (
  request: DiagnosisRequest,
  crop?: Crop,
) => Promise<DiagnosisResponse>;

let cachedAdapter: GenerateDiagnosisFn | null = null;
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

export async function getDiagnosisAdapter(): Promise<GenerateDiagnosisFn> {
  if (!cachedAdapter) {
    cachedAdapter = await loadAdapter();
  }
  return cachedAdapter;
}

export function getAdapterProviderName(): string {
  return cachedProviderName;
}

export function resetAdapterCache(): void {
  cachedAdapter = null;
  cachedProviderName = 'unknown';
}
