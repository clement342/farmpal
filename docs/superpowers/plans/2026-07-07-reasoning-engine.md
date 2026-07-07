# Reasoning Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the environment-variable AI/knowledge routing with a runtime-adaptive `ReasoningEngine` that always queries the Knowledge Engine first and falls back gracefully when AI is unavailable.

**Architecture:** Introduce `services/reasoning/ReasoningEngine.ts` as the single decision point. Controllers, DiagnosisService, ChatService, and ConversationOrchestrator stop routing AI vs knowledge — they delegate to ReasoningEngine. The engine searches knowledge first, evaluates confidence, attempts AI only when confidence is low, and falls back to knowledge when AI fails.

**Tech Stack:** TypeScript, existing `knowledgeService`, existing `infer()` from `lib/ai`, existing `DiagnosisResponse`/`ChatResponse` types.

---

### Task 1: Create Reasoning Engine types

**Files:**
- Create: `services/reasoning/types.ts`

**Reasoning:** The engine needs its own types for confidence evaluation, knowledge responses, and logging — keeping them separate from orchestrator types and diagnosis types avoids coupling.

- [ ] **Step 1: Write types**

```typescript
import type { DiagnosisResponse, ChatResponse, DiagnosisRequest } from '@/types';
import type { ChatMessage, Crop } from '@/types';
import type { KnowledgeDisease, KnowledgeDeficiency } from '@/types/knowledge';

export interface KnowledgeSearchResult {
  diseases: KnowledgeDisease[];
  deficiencies: KnowledgeDeficiency[];
  matchedSymptomCount: number;
  totalKeywordHits: number;
}

export interface ConfidenceEvaluation {
  score: number;
  threshold: number;
  isHighConfidence: boolean;
  reason: string;
}

export interface ReasoningLogEntry {
  knowledgeConfidence: number;
  knowledgeHits: number;
  usedAI: boolean;
  fallbackTriggered: boolean;
  provider: string;
  latencyMs: number;
}

export interface AnswerDiagnosisParams {
  request: DiagnosisRequest;
  crop?: Crop;
  existingMessages?: ChatMessage[];
}

export type AnswerGeneralQuestionParams = {
  messages: ChatMessage[];
  cropContext?: { cropId: string; cropName: string };
};
```

- [ ] **Step 2: Commit**

```bash
git add services/reasoning/types.ts
git commit -m "feat: add ReasoningEngine types"
```

---

### Task 2: Create KnowledgeResponseBuilder

**Files:**
- Create: `services/reasoning/KnowledgeResponseBuilder.ts`

**Reasoning:** Maps knowledge search results into `DiagnosisResponse` or `ChatResponse` when the engine decides to answer from knowledge (no AI needed). Keeps the mapping logic out of the engine itself.

- [ ] **Step 1: Write the builder — diagnosis from knowledge**

Builds a `DiagnosisResponse` from knowledge search results. Uses matched disease names, descriptions, treatments, and prevention as the structured output.

```typescript
import type { DiagnosisResponse, DiagnosisResult, PossibleCause, Recommendation } from '@/types';
import type { KnowledgeDisease, KnowledgeDeficiency } from '@/types/knowledge';
import type { KnowledgeSearchResult } from './types';

export class KnowledgeResponseBuilder {
  buildDiagnosisResponse(result: KnowledgeSearchResult, cropName?: string): DiagnosisResponse {
    const possibleCauses: PossibleCause[] = [];
    const recommendations: Recommendation[] = [];

    for (const disease of result.diseases.slice(0, 3)) {
      possibleCauses.push({
        name: disease.name,
        confidence: 0.6,
        reasoning: disease.description.split('.')[0] + '.',
      });

      for (const treatment of disease.treatments.slice(0, 2)) {
        recommendations.push({ text: treatment, category: 'immediate_action' });
      }
      for (const prevention of disease.prevention.slice(0, 2)) {
        recommendations.push({ text: prevention, category: 'preventive' });
      }
    }

    for (const def of result.deficiencies.slice(0, 2)) {
      possibleCauses.push({
        name: def.name,
        confidence: 0.4,
        reasoning: def.description.split('.')[0] + '.',
      });

      for (const treatment of def.treatments.slice(0, 1)) {
        recommendations.push({ text: treatment, category: 'immediate_action' });
      }
    }

    if (possibleCauses.length === 0) {
      return {
        status: 'follow_up',
        question: 'Could you describe the symptoms in more detail? Which part of the plant is affected?',
        options: [
          'Leaves (spots, yellowing, curling)',
          'Stem or trunk',
          'Roots',
          'Whole plant looks unhealthy',
        ],
      };
    }

    if (recommendations.length === 0) {
      recommendations.push({
        text: 'Monitor the affected plants and consult an expert if symptoms persist',
        category: 'consultation',
      });
    }

    const reasoning = result.diseases.length > 0
      ? `Based on the symptoms described, the following conditions may be affecting your ${cropName ?? 'crop'}.`
      : 'The symptoms match several possible conditions. Review the possible causes below.';

    return {
      status: 'diagnosis',
      diagnosis: {
        possibleCauses,
        reasoning,
        recommendations,
        urgency: 'moderate',
        extensionOfficerAdvice: 'If symptoms worsen despite applying the recommended actions, consult your local agricultural extension officer.',
      },
    };
  }

  buildFollowUpResponse(question: string, options?: string[]): DiagnosisResponse {
    return {
      status: 'follow_up',
      question,
      options,
    };
  }
}
```

- [ ] **Step 2: Write test**

```typescript
// tests/unit/reasoning/KnowledgeResponseBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { KnowledgeResponseBuilder } from '@/services/reasoning/KnowledgeResponseBuilder';
import type { KnowledgeSearchResult } from '@/services/reasoning/types';

describe('KnowledgeResponseBuilder', () => {
  const builder = new KnowledgeResponseBuilder();

  it('builds diagnosis from matched diseases', () => {
    const result: KnowledgeSearchResult = {
      diseases: [
        {
          id: 'cassava-mosaic',
          cropId: 'cassava',
          name: 'Cassava Mosaic Disease',
          description: 'Viral disease causing mosaic pattern on leaves.',
          symptoms: ['mosaic', 'yellow', 'curling'],
          causes: ['Virus'],
          severity: 'high',
          treatments: ['Remove infected plants', 'Use resistant varieties'],
          prevention: ['Use disease-free cuttings', 'Control whiteflies'],
          aliases: [],
          references: [],
        },
      ],
      deficiencies: [],
      matchedSymptomCount: 2,
      totalKeywordHits: 3,
    };

    const response = builder.buildDiagnosisResponse(result, 'Cassava');
    expect(response.status).toBe('diagnosis');
    if (response.status === 'diagnosis') {
      expect(response.diagnosis.possibleCauses[0].name).toBe('Cassava Mosaic Disease');
      expect(response.diagnosis.recommendations.length).toBeGreaterThan(0);
    }
  });

  it('returns follow_up when no diseases matched', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [],
      matchedSymptomCount: 0,
      totalKeywordHits: 0,
    };

    const response = builder.buildDiagnosisResponse(result);
    expect(response.status).toBe('follow_up');
  });

  it('includes deficiency entries in possible causes', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [
        {
          id: 'nitrogen-deficiency',
          name: 'Nitrogen Deficiency',
          description: 'Yellowing of older leaves due to lack of nitrogen.',
          symptoms: ['yellow', 'stunted'],
          causes: ['Poor soil'],
          treatments: ['Apply nitrogen fertilizer'],
          prevention: ['Use compost'],
          aliases: [],
          affectedCrops: ['maize'],
        },
      ],
      matchedSymptomCount: 1,
      totalKeywordHits: 1,
    };

    const response = builder.buildDiagnosisResponse(result);
    expect(response.status).toBe('diagnosis');
    if (response.status === 'diagnosis') {
      expect(response.diagnosis.possibleCauses[0].name).toBe('Nitrogen Deficiency');
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/reasoning/KnowledgeResponseBuilder.test.ts
```

- [ ] **Step 4: Create the implementation file**

```bash
mkdir -p services/reasoning tests/unit/reasoning
```

Then write the test file from Step 2 and the implementation from Step 1.

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm vitest run tests/unit/reasoning/KnowledgeResponseBuilder.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/reasoning/ tests/unit/reasoning/
git commit -m "feat: add KnowledgeResponseBuilder for knowledge-only diagnosis responses"
```

---

### Task 3: Implement ConfidenceEvaluator

**Files:**
- Create: `services/reasoning/ConfidenceEvaluator.ts`

**Reasoning:** Centralizes the confidence scoring logic. The engine calls this to decide whether knowledge is sufficient or AI is needed. Separating it from the engine keeps the scoring logic testable and configurable.

- [ ] **Step 1: Write the test first**

```typescript
// tests/unit/reasoning/ConfidenceEvaluator.test.ts
import { describe, it, expect } from 'vitest';
import { ConfidenceEvaluator } from '@/services/reasoning/ConfidenceEvaluator';
import type { KnowledgeSearchResult } from '@/services/reasoning/types';

describe('ConfidenceEvaluator', () => {
  const evaluator = new ConfidenceEvaluator({ threshold: 0.7 });

  it('returns high confidence when many diseases match with symptoms', () => {
    const result: KnowledgeSearchResult = {
      diseases: [{ id: 'd1', name: 'Disease 1', symptoms: ['yellow'] } as any],
      deficiencies: [],
      matchedSymptomCount: 3,
      totalKeywordHits: 5,
    };
    const evaluation = evaluator.evaluate(result);
    expect(evaluation.isHighConfidence).toBe(true);
    expect(evaluation.score).toBeGreaterThanOrEqual(0.7);
  });

  it('returns low confidence when no diseases match', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [],
      matchedSymptomCount: 0,
      totalKeywordHits: 0,
    };
    const evaluation = evaluator.evaluate(result);
    expect(evaluation.isHighConfidence).toBe(false);
    expect(evaluation.score).toBe(0);
  });

  it('returns low confidence when only deficiencies match without disease', () => {
    const result: KnowledgeSearchResult = {
      diseases: [],
      deficiencies: [{ id: 'n1', name: 'Nitrogen Deficiency' } as any],
      matchedSymptomCount: 1,
      totalKeywordHits: 1,
    };
    const evaluation = evaluator.evaluate(result);
    expect(evaluation.isHighConfidence).toBe(false);
  });

  it('uses configured threshold', () => {
    const highThreshold = new ConfidenceEvaluator({ threshold: 0.9 });
    const result: KnowledgeSearchResult = {
      diseases: [{ id: 'd1', name: 'D1', symptoms: ['spot'] } as any],
      deficiencies: [],
      matchedSymptomCount: 1,
      totalKeywordHits: 2,
    };
    expect(highThreshold.evaluate(result).isHighConfidence).toBe(false);

    const lowThreshold = new ConfidenceEvaluator({ threshold: 0.3 });
    expect(lowThreshold.evaluate(result).isHighConfidence).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/reasoning/ConfidenceEvaluator.test.ts
```

- [ ] **Step 3: Write the implementation**

```typescript
import type { KnowledgeSearchResult, ConfidenceEvaluation } from './types';

export interface ConfidenceEvaluatorOptions {
  threshold: number;
}

export class ConfidenceEvaluator {
  private threshold: number;

  constructor(options?: ConfidenceEvaluatorOptions) {
    this.threshold = options?.threshold ?? 0.7;
  }

  evaluate(result: KnowledgeSearchResult): ConfidenceEvaluation {
    let score = 0;

    // Base score from disease matches
    if (result.diseases.length > 0) {
      score += Math.min(result.diseases.length * 0.25, 0.5);
    }

    // Boost from symptom keyword matches
    if (result.matchedSymptomCount > 0) {
      score += Math.min(result.matchedSymptomCount * 0.15, 0.3);
    }

    // Boost from total keyword hits
    if (result.totalKeywordHits > 0) {
      score += Math.min(result.totalKeywordHits * 0.05, 0.2);
    }

    // Deficiency alone is low confidence
    if (result.diseases.length === 0 && result.deficiencies.length > 0) {
      score = Math.min(score, 0.4);
    }

    const clamped = Math.min(Math.max(score, 0), 1);

    return {
      score: clamped,
      threshold: this.threshold,
      isHighConfidence: clamped >= this.threshold,
      reason: clamped >= this.threshold
        ? `Knowledge confidence ${(clamped * 100).toFixed(0)}% meets threshold of ${(this.threshold * 100).toFixed(0)}%`
        : `Knowledge confidence ${(clamped * 100).toFixed(0)}% below threshold of ${(this.threshold * 100).toFixed(0)}%`,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/unit/reasoning/ConfidenceEvaluator.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/reasoning/ConfidenceEvaluator.ts tests/unit/reasoning/ConfidenceEvaluator.test.ts
git commit -m "feat: add ConfidenceEvaluator for knowledge-based routing decisions"
```

---

### Task 4: Implement ReasoningEngine (core)

**Files:**
- Create: `services/reasoning/ReasoningEngine.ts`

**Reasoning:** The main orchestration component. It combines KnowledgeResponseBuilder, ConfidenceEvaluator, and the AI `infer()` function into the adaptive pipeline. This is the component controllers and services call instead of adapter factories or direct AI calls.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/reasoning/ReasoningEngine.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReasoningEngine } from '@/services/reasoning/ReasoningEngine';

vi.mock('@/lib/knowledge/knowledge-search', () => ({
  findByKeyword: vi.fn(),
  findCrop: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
  infer: vi.fn(),
}));

vi.mock('@/services/knowledge.service', () => ({
  knowledgeService: {
    search: vi.fn(),
    getCrop: vi.fn(),
  },
}));

describe('ReasoningEngine', () => {
  let engine: ReasoningEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ReasoningEngine({ threshold: 0.7 });
  });

  it('answers from knowledge when confidence is high', async () => {
    const { knowledgeService } = await import('@/services/knowledge.service');
    vi.mocked(knowledgeService.search).mockReturnValue({
      crops: [],
      diseases: [
        {
          id: 'cassava-mosaic',
          cropId: 'cassava',
          name: 'Cassava Mosaic Disease',
          description: 'Viral disease.',
          symptoms: ['mosaic', 'yellow'],
          causes: ['Virus'],
          severity: 'high',
          treatments: ['Remove infected plants'],
          prevention: ['Use resistant varieties'],
          aliases: [],
          references: [],
        },
      ],
      pests: [],
      deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'mosaic yellow leaves', cropId: 'cassava' },
    });

    expect(response.status).toBe('diagnosis');
  });

  it('falls back to AI when confidence is low', async () => {
    const { infer } = await import('@/lib/ai');
    vi.mocked(infer).mockResolvedValue(JSON.stringify({
      status: 'follow_up',
      question: 'Can you describe the spots?',
      options: ['Round', 'Angular'],
    }));

    const { knowledgeService } = await import('@/services/knowledge.service');
    vi.mocked(knowledgeService.search).mockReturnValue({
      crops: [],
      diseases: [],
      pests: [],
      deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'something wrong with my plant', cropId: 'cassava' },
    });

    expect(response.status).toBe('follow_up');
    expect(infer).toHaveBeenCalledOnce();
  });

  it('returns knowledge response when AI fails', async () => {
    const { infer } = await import('@/lib/ai');
    vi.mocked(infer).mockRejectedValue(new Error('AI unavailable'));

    const { knowledgeService } = await import('@/services/knowledge.service');
    vi.mocked(knowledgeService.search).mockReturnValue({
      crops: [],
      diseases: [
        {
          id: 'cassava-mosaic',
          cropId: 'cassava',
          name: 'Cassava Mosaic Disease',
          description: 'Viral disease.',
          symptoms: ['mosaic', 'yellow'],
          causes: ['Virus'],
          severity: 'high',
          treatments: ['Remove infected plants'],
          prevention: ['Use resistant varieties'],
          aliases: [],
          references: [],
        },
      ],
      pests: [],
      deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'mosaic yellow leaves', cropId: 'cassava' },
    });

    expect(response.status).toBe('diagnosis');
    if (response.status === 'diagnosis') {
      expect(response.diagnosis.possibleCauses[0].name).toBe('Cassava Mosaic Disease');
    }
  });

  it('returns follow_up from knowledge when nothing matches and AI fails', async () => {
    const { infer } = await import('@/lib/ai');
    vi.mocked(infer).mockRejectedValue(new Error('AI unavailable'));

    const { knowledgeService } = await import('@/services/knowledge.service');
    vi.mocked(knowledgeService.search).mockReturnValue({
      crops: [], diseases: [], pests: [], deficiencies: [],
    });

    const response = await engine.answerDiagnosis({
      request: { symptoms: 'weird growth on stem' },
    });

    expect(response.status).toBe('follow_up');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run tests/unit/reasoning/ReasoningEngine.test.ts
```

- [ ] **Step 3: Write the implementation**

```typescript
import { knowledgeService } from '@/services/knowledge.service';
import { infer } from '@/lib/ai';
import { buildSystemMessages } from '@/lib/ai/prompts';
import { parseDiagnosisResponse } from '@/lib/ai/parsers/diagnosis-response.parser';
import { mapToDiagnosisResponse } from '@/adapters/diagnosis/mapper';
import { KnowledgeResponseBuilder } from './KnowledgeResponseBuilder';
import { ConfidenceEvaluator } from './ConfidenceEvaluator';
import type { KnowledgeSearchResult, AnswerDiagnosisParams, AnswerGeneralQuestionParams, ReasoningLogEntry } from './types';
import type { DiagnosisResponse, ChatResponse, ChatMessage } from '@/types';
import type { KnowledgeDisease, KnowledgeDeficiency } from '@/types/knowledge';

export class ReasoningEngine {
  private knowledgeBuilder = new KnowledgeResponseBuilder();
  private confidenceEvaluator: ConfidenceEvaluator;

  constructor(options?: { threshold?: number }) {
    this.confidenceEvaluator = new ConfidenceEvaluator({ threshold: options?.threshold ?? 0.7 });
  }

  async answerDiagnosis(params: AnswerDiagnosisParams): Promise<DiagnosisResponse> {
    const startTime = Date.now();
    const { request, crop } = params;

    // 1. Always search knowledge first
    const knowledgeResult = this.searchKnowledge(request.symptoms, request.cropId);

    // 2. Evaluate confidence
    const evaluation = this.confidenceEvaluator.evaluate(knowledgeResult);

    let response: DiagnosisResponse;
    let usedAI = false;
    let fallbackTriggered = false;

    if (evaluation.isHighConfidence) {
      // 3. High confidence — answer from knowledge
      response = this.knowledgeBuilder.buildDiagnosisResponse(knowledgeResult, crop?.name);
    } else {
      // 4. Low confidence — attempt AI inference
      usedAI = true;
      try {
        response = await this.invokeAI(request, crop, params.existingMessages, knowledgeResult);
      } catch {
        // 5. AI failed — fall back to best knowledge response
        fallbackTriggered = true;
        response = this.knowledgeBuilder.buildDiagnosisResponse(knowledgeResult, crop?.name);
      }
    }

    const latencyMs = Date.now() - startTime;
    this.log({
      knowledgeConfidence: evaluation.score,
      knowledgeHits: knowledgeResult.totalKeywordHits,
      usedAI,
      fallbackTriggered,
      provider: usedAI ? 'ai' : 'knowledge',
      latencyMs,
    });

    return response;
  }

  async answerGeneralQuestion(params: AnswerGeneralQuestionParams): Promise<ChatResponse> {
    const startTime = Date.now();
    const { messages, cropContext } = params;

    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
    const knowledgeResult = this.searchKnowledge(lastUserMessage, cropContext?.cropId);
    const evaluation = this.confidenceEvaluator.evaluate(knowledgeResult);

    let response: ChatResponse;
    let usedAI = false;
    let fallbackTriggered = false;

    if (evaluation.isHighConfidence && knowledgeResult.diseases.length > 0) {
      const kbResponse = this.knowledgeBuilder.buildDiagnosisResponse(knowledgeResult);
      const text = kbResponse.status === 'diagnosis'
        ? kbResponse.diagnosis.reasoning
        : kbResponse.question;
      response = {
        message: {
          id: crypto.randomUUID(),
          content: text,
          role: 'assistant',
          createdAt: new Date().toISOString(),
        },
        suggestions: ['Tell me more', 'What should I do?', 'Is this serious?'],
      };
    } else {
      usedAI = true;
      try {
        const extraContext = cropContext?.cropName
          ? `Crop: ${cropContext.cropName}`
          : undefined;
        const aiMessages = buildSystemMessages('chat', messages, extraContext);
        const rawText = await infer(aiMessages, { task: 'chat', temperature: 0.3 });
        response = {
          message: {
            id: crypto.randomUUID(),
            content: rawText,
            role: 'assistant',
            createdAt: new Date().toISOString(),
          },
          suggestions: [
            'Tell me more about the symptoms',
            'Which crop is affected?',
            'When did you first notice this?',
          ],
        };
      } catch {
        fallbackTriggered = true;
        const fallbackText = knowledgeResult.diseases.length > 0
          ? knowledgeResult.diseases.map(d => `- ${d.name}: ${d.description.split('.')[0]}.`).join('\n')
          : 'I found some general information that might help. Could you describe the issue in more detail?';
        response = {
          message: {
            id: crypto.randomUUID(),
            content: fallbackText,
            role: 'assistant',
            createdAt: new Date().toISOString(),
          },
        };
      }
    }

    const latencyMs = Date.now() - startTime;
    this.log({
      knowledgeConfidence: evaluation.score,
      knowledgeHits: knowledgeResult.totalKeywordHits,
      usedAI,
      fallbackTriggered,
      provider: usedAI ? 'ai' : 'knowledge',
      latencyMs,
    });

    return response;
  }

  private searchKnowledge(symptoms: string, cropId?: string): KnowledgeSearchResult {
    const searchResults = cropId
      ? this.searchWithCrop(symptoms, cropId)
      : this.searchWithoutCrop(symptoms);

    return searchResults;
  }

  private searchWithCrop(symptoms: string, cropId: string): KnowledgeSearchResult {
    const allDiseases = knowledgeService.getDiseasesForCrop(cropId);
    const keywordResults = knowledgeService.search(symptoms);

    const diseaseMatches = allDiseases.filter(d =>
      d.symptoms.some(s => symptoms.toLowerCase().includes(s.toLowerCase())),
    );

    const allMatches = [
      ...diseaseMatches,
      ...keywordResults.diseases.filter(kd => !diseaseMatches.some(d => d.id === kd.id)),
    ];

    const symptomKeywords = ['yellow', 'spot', 'wilt', 'curl', 'mosaic', 'blight', 'rot',
      'lesion', 'stunt', 'dieback', 'hole', 'mildew', 'rust', 'streak', 'brown', 'black'];

    const matchedSymptomCount = symptomKeywords.filter(kw =>
      symptoms.toLowerCase().includes(kw),
    ).length;

    return {
      diseases: allMatches,
      deficiencies: keywordResults.deficiencies,
      matchedSymptomCount,
      totalKeywordHits: allMatches.length + keywordResults.deficiencies.length + keywordResults.crops.length,
    };
  }

  private searchWithoutCrop(symptoms: string): KnowledgeSearchResult {
    const keywordResults = knowledgeService.search(symptoms);

    const symptomKeywords = ['yellow', 'spot', 'wilt', 'curl', 'mosaic', 'blight', 'rot',
      'lesion', 'stunt', 'dieback', 'hole', 'mildew', 'rust', 'streak', 'brown', 'black'];

    const matchedSymptomCount = symptomKeywords.filter(kw =>
      symptoms.toLowerCase().includes(kw),
    ).length;

    return {
      diseases: keywordResults.diseases,
      deficiencies: keywordResults.deficiencies,
      matchedSymptomCount,
      totalKeywordHits: keywordResults.diseases.length + keywordResults.deficiencies.length + keywordResults.crops.length,
    };
  }

  private async invokeAI(
    request: { symptoms: string; cropId?: string },
    crop?: { id?: string; name?: string; regions?: string[] },
    existingMessages?: ChatMessage[],
    knowledge?: KnowledgeSearchResult,
  ): Promise<DiagnosisResponse> {
    const messages = this.buildAIPrompt(request, crop, existingMessages, knowledge);
    const rawText = await infer(messages, { task: 'diagnosis', temperature: 0.3 });
    const parsed = parseDiagnosisResponse(rawText);

    if (!parsed.success) {
      throw parsed.error;
    }

    return mapToDiagnosisResponse(parsed.data);
  }

  private buildAIPrompt(
    request: { symptoms: string; cropId?: string },
    crop?: { id?: string; name?: string; regions?: string[] },
    existingMessages?: ChatMessage[],
    knowledge?: KnowledgeSearchResult,
  ): ChatMessage[] {
    const parts: string[] = [];

    if (crop?.name) {
      parts.push(`Crop: ${crop.name}`);
    }

    if (knowledge && knowledge.diseases.length > 0) {
      const diseaseContext = knowledge.diseases.slice(0, 3).map(d =>
        `- ${d.name}: ${d.description.split('.')[0]}.`,
      ).join('\n');
      parts.push(`Known conditions that may be relevant:\n${diseaseContext}`);
    }

    const extraContext = parts.length > 0 ? parts.join('\n\n') : undefined;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: request.symptoms,
      createdAt: new Date().toISOString(),
    };

    const history = existingMessages ?? [];
    const allMessages = [...history, newMessage];

    return buildSystemMessages('diagnosis', allMessages, extraContext);
  }

  private log(entry: ReasoningLogEntry): void {
    console.log('[ReasoningEngine]', JSON.stringify(entry));
  }
}

export const reasoningEngine = new ReasoningEngine();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm vitest run tests/unit/reasoning/
```

- [ ] **Step 5: Commit**

```bash
git add services/reasoning/ReasoningEngine.ts
git commit -m "feat: add ReasoningEngine with adaptive knowledge-AI pipeline"
```

---

### Task 5: Wire ReasoningEngine into DiagnosisService

**Files:**
- Modify: `services/diagnose.service.ts`
- Remove: `adapters/diagnosis-adapter.factory.ts` (no longer used)

**Reasoning:** `createDiagnosis` and `streamDiagnosis` currently call the adapter factory. They should call `reasoningEngine.answerDiagnosis()` instead. The adapter factory becomes dead code.

- [ ] **Step 1: Modify `createDiagnosis` to use ReasoningEngine**

In `services/diagnose.service.ts`:

Change:
```typescript
import { getDiagnosisAdapter, getStreamDiagnosisAdapter, getAdapterProviderName } from '@/adapters/diagnosis-adapter.factory';
// ...
const generateDiagnosis = await getDiagnosisAdapter();
const aiProvider = getAdapterProviderName();
const response = await generateDiagnosis(request, mappedCrop, existingMessages);
```

To:
```typescript
import { reasoningEngine } from '@/services/reasoning/ReasoningEngine';
// ...
const response = await reasoningEngine.answerDiagnosis({
  request,
  crop: mappedCrop,
  existingMessages,
});
```

Remove the `aiProvider` variable and its usage — the engine logs provider info internally.

Change:
```typescript
const diagnosisData: CreateDiagnosisData = {
  // ...
  aiProvider, // remove this line
};
```

- [ ] **Step 2: Modify `streamDiagnosis` to use ReasoningEngine**

Change the stream adapter call to use `reasoningEngine.answerDiagnosis()` — same pattern as non-streaming.

Since streaming currently buffers the full AI response, it can use the non-streaming `answerDiagnosis()` method for simplicity. The streaming chunks can be generated from the result.

- [ ] **Step 3: Remove `processFollowUp` usage of adapter factory**

The `processFollowUp` function calls `createDiagnosis`, which now uses ReasoningEngine. No change needed in `processFollowUp`.

- [ ] **Step 4: Remove unused adapter factory import and calls**

Remove from `services/diagnose.service.ts`:
- `getDiagnosisAdapter`, `getStreamDiagnosisAdapter`, `getAdapterProviderName` imports
- `aiProvider` variable and its usage in `CreateDiagnosisData`

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run
```

Fix any test failures.

- [ ] **Step 6: Commit**

```bash
git add services/diagnose.service.ts
git commit -m "refactor: wire ReasoningEngine into DiagnosisService, remove adapter factory calls"
```

---

### Task 6: Wire ReasoningEngine into ChatService

**Files:**
- Modify: `services/chat.service.ts`

**Reasoning:** `processChatMessage` currently calls `infer()` directly. It should call `reasoningEngine.answerGeneralQuestion()` instead, which handles the knowledge-first flow and AI fallback.

- [ ] **Step 1: Modify `processChatMessage`**

```typescript
import { reasoningEngine } from '@/services/reasoning/ReasoningEngine';

export async function processChatMessage(
  request: ChatRequest,
): Promise<ChatResponse> {
  return reasoningEngine.answerGeneralQuestion({
    messages: request.messages,
    cropContext: request.cropContext,
  });
}
```

- [ ] **Step 2: Remove unused imports**

Remove `infer` and `buildSystemMessages` imports from `services/chat.service.ts` if they're no longer used elsewhere.

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run
```

- [ ] **Step 4: Commit**

```bash
git add services/chat.service.ts
git commit -m "refactor: wire ReasoningEngine into ChatService"
```

---

### Task 7: Simplify controllers to remove AI routing

**Files:**
- Modify: `controllers/diagnose.controller.ts`
- Modify: `controllers/chat.controller.ts`

**Reasoning:** The controller should not contain AI routing logic. The `ANSWER_GENERAL_QA` branch currently calls `processChatMessage` directly — this is routing logic the ReasoningEngine should handle internally. And the diagnosis path already delegates to ReasoningEngine via `createDiagnosis`.

- [ ] **Step 1: Remove ANSWER_GENERAL_QA branch from non-streaming controller**

In `controllers/diagnose.controller.ts`, change:

```typescript
switch (decision.nextAction) {
  case 'ANSWER_GENERAL_QA': {
    const chatResponse = await processChatMessage({
      messages: [],
      cropContext: request.cropId
        ? { cropId: request.cropId, cropName: '' }
        : undefined,
    });
    return {
      conversationId: request.conversationId ?? '',
      status: 'ACTIVE',
      response: {
        status: 'follow_up',
        question: chatResponse.message.content,
      },
    };
  }
  case 'ANSWER_FOLLOWUP':
    return processFollowUp(request);
  default:
    return createDiagnosis(request);
}
```

To:

```typescript
switch (decision.nextAction) {
  case 'ANSWER_FOLLOWUP':
    return processFollowUp(request);
  default:
    return createDiagnosis(request);
}
```

The ThinkingEngine inside `createDiagnosis` will handle the knowledge-first/AI flow.

Also remove the `processChatMessage` import.

- [ ] **Step 2: Remove ANSWER_GENERAL_QA branch from streaming controller**

Same change in `handleStreamDiagnosis`.

- [ ] **Step 3: Simplify chat controller**

In `controllers/chat.controller.ts`, the controller is already minimal — just validate and delegate. Verify it only calls `processChatMessage` and doesn't contain any AI routing.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run
```

- [ ] **Step 5: Build**

```bash
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add controllers/diagnose.controller.ts controllers/chat.controller.ts
git commit -m "refactor: remove AI routing from controllers — ReasoningEngine handles all decisions"
```

---

### Task 8: Remove the adapter factory and env-var routing

**Files:**
- Remove: `adapters/diagnosis-adapter.factory.ts`

**Reasoning:** The adapter factory is the env-var-based routing that made AI mandatory. With ReasoningEngine, the factory is dead code. The `mock-ai` adapter can also be removed since ReasoningEngine uses knowledge as the primary source.

- [ ] **Step 1: Check for remaining references**

```bash
rg "diagnosis-adapter.factory" --type ts
rg "getDiagnosisAdapter|getStreamDiagnosisAdapter|getAdapterProviderName|resetAdapterCache" --type ts
rg "USE_MOCK_AI" --type ts
```

- [ ] **Step 2: Remove adapter factory and mock adapter files**

```bash
rm adapters/diagnosis-adapter.factory.ts adapters/mock-ai/diagnosis.adapter.ts
```

- [ ] **Step 3: Remove env var references**

Check if `USE_MOCK_AI` is referenced anywhere else:

```bash
rg "USE_MOCK_AI" .
```

If found in config or .env files, those are now harmless documentation — just remove from code references.

- [ ] **Step 4: Build**

```bash
pnpm build
```

- [ ] **Step 5: Run tests**

```bash
pnpm vitest run
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove adapter factory and env-var routing — ReasoningEngine replaces all"
```

---

### Task 9: End-to-end verification

**Files:**
- None (verification only)

- [ ] **Step 1: Start the app**

```bash
pnpm dev
```

- [ ] **Step 2: Test with AI available**

```bash
# Non-streaming diagnosis
curl -s -X POST http://localhost:3000/api/diagnose \
  -H 'Content-Type: application/json' \
  -d '{"symptoms":"my cassava has yellow mosaic leaves"}'
```

Verify: returns diagnosis or follow-up (should use knowledge for high-confidence).

- [ ] **Step 3: Test general chat**

```bash
curl -s -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"what is crop rotation"}]}'
```

Verify: works.

- [ ] **Step 4: Test streaming**

```bash
curl -s -N -X POST http://localhost:3000/api/diagnose/stream \
  -H 'Content-Type: application/json' \
  -d '{"symptoms":"my tomato has leaf spots"}'
```

Verify: works.

- [ ] **Step 5: Verify no env-var references**

```bash
rg "USE_MOCK_AI|USE_AI" --type ts || echo "No env-var routing found ✓"
```

- [ ] **Step 6: Commit (if any fixes needed)**

```bash
git commit -m "fix: final adjustments from E2E verification"
```
