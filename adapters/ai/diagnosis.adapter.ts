import type { ChatMessage } from '@/types';
import type { Crop } from '@/types/crop';
import type { DiagnosisRequest, DiagnosisResponse, DiagnosisResult, PossibleCause, Recommendation, UrgencyLevel } from '@/types/diagnosis';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';

interface RawDiagnosisResult {
  possibleCauses?: Array<{ name?: string; confidence?: number; reasoning?: string }>;
  reasoning?: string;
  recommendations?: Array<{ text?: string; category?: string }>;
  urgency?: string;
  extensionOfficerAdvice?: string;
}

interface RawOutput {
  status?: string;
  question?: string;
  options?: string[];
  diagnosis?: RawDiagnosisResult;
}

export async function generateDiagnosis(
  request: DiagnosisRequest,
  crop?: Crop,
): Promise<DiagnosisResponse> {
  const cropContext = crop
    ? `Crop: ${crop.name}${crop.regions?.length ? `, Region: ${crop.regions.join(', ')}` : ''}`
    : undefined;

  const userMessages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: request.symptoms,
      createdAt: new Date().toISOString(),
    },
  ];

  const messages = buildSystemMessages('diagnosis', userMessages, cropContext);

  const rawText = await infer(messages, { task: 'diagnosis', temperature: 0.3 });

  return parseDiagnosisResponse(rawText);
}

function parseDiagnosisResponse(raw: string): DiagnosisResponse {
  const json = extractJson(raw);
  const parsed: RawOutput = JSON.parse(json);

  if (parsed.status === 'follow_up') {
    return {
      status: 'follow_up',
      question: parsed.question ?? 'Could you describe the symptoms in more detail?',
      options: parsed.options,
    };
  }

  return {
    status: 'diagnosis',
    diagnosis: buildDiagnosisResult(parsed.diagnosis),
  };
}

function extractJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = match ? match[1].trim() : text.trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('No JSON object found in AI response');
  }

  return candidate.slice(start, end + 1);
}

function buildDiagnosisResult(raw?: RawDiagnosisResult): DiagnosisResult {
  const possibleCauses: PossibleCause[] = (raw?.possibleCauses ?? []).map((c) => ({
    name: c.name ?? 'Unknown',
    confidence: typeof c.confidence === 'number' ? c.confidence : 0,
    reasoning: c.reasoning ?? '',
  }));

  const recommendations: Recommendation[] = (raw?.recommendations ?? []).map((r) => ({
    text: r.text ?? '',
    category: isValidCategory(r.category) ? r.category : 'immediate_action',
  }));

  const urgency = isValidUrgency(raw?.urgency) ? raw.urgency : 'moderate';

  return {
    possibleCauses: possibleCauses.length > 0
      ? possibleCauses
      : [{ name: 'Unknown', confidence: 0, reasoning: 'Could not parse diagnosis from AI response' }],
    reasoning: raw?.reasoning ?? 'No reasoning provided.',
    recommendations: recommendations.length > 0
      ? recommendations
      : [{ text: 'Monitor the affected plants and consult an expert if symptoms persist', category: 'consultation' }],
    urgency,
    extensionOfficerAdvice: raw?.extensionOfficerAdvice ?? 'Consult your local agricultural extension officer if symptoms worsen.',
  };
}

function isValidCategory(c?: string): c is 'immediate_action' | 'preventive' | 'consultation' {
  return c === 'immediate_action' || c === 'preventive' || c === 'consultation';
}

function isValidUrgency(u?: string): u is UrgencyLevel {
  return u === 'low' || u === 'moderate' || u === 'high' || u === 'critical';
}
