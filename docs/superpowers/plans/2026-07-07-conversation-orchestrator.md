# Conversation Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a conversation orchestration layer that classifies incoming messages by intent and routes to the appropriate workflow.

**Architecture:** Bottom-up build of services/conversation/ — types first, pure logic (classifier, router, decision builder), then IO-dependent components (loader, knowledge builder), then orchestration wiring, then controller simplification.

**Tech Stack:** TypeScript, Node.js, existing Mongoose repositories, existing KnowledgeService singleton

---

### Task 1: Set up test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/helpers.ts`

- [ ] **Step 1: Install vitest**

```bash
cd /home/tobe/projects/farmpal && npm install -D vitest
```

- [ ] **Step 2: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
```

- [ ] **Step 3: Add test script to package.json**

```json
// in scripts section:
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Create test helpers**

```typescript
// tests/helpers.ts
import type { ChatMessage } from '@/types';

export function createUserMessage(content: string): ChatMessage {
  return {
    id: 'test-msg-1',
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createAssistantMessage(content: string): ChatMessage {
  return {
    id: 'test-msg-2',
    role: 'assistant',
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createFollowUpMessage(question: string): ChatMessage {
  return {
    id: 'test-msg-3',
    role: 'assistant',
    content: JSON.stringify({
      status: 'follow_up',
      question,
      options: ['Option A', 'Option B'],
    }),
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 5: Verify vitest runs**

```bash
cd /home/tobe/projects/farmpal && npx vitest run --reporter=verbose 2>&1 | head -10
```

Expected output shows "No test files found" (no tests yet).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/helpers.ts package.json
git commit -m "chore: add vitest test infrastructure"
```

---

### Task 2: Define orchestrator types

**Files:**
- Create: `services/conversation/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// services/conversation/types.ts

import type { ChatMessage } from '@/types';
import type { ConversationDocument } from '@/lib/db/models/conversation.model';
import type { DiagnosisDocument } from '@/lib/db/models/diagnosis.model';
import type {
  KnowledgeCrop,
  KnowledgeDisease,
  KnowledgeDeficiency,
  KnowledgeGlossaryEntry,
} from '@/types/knowledge';

// ── Lifecycle / Stage ──────────────────────────────────────────

export type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export type ConversationStage =
  | 'NEW'
  | 'COLLECTING_SYMPTOMS'
  | 'AWAITING_CLARIFICATION'
  | 'DIAGNOSING'
  | 'SHOWING_RESULT'
  | 'FOLLOW_UP'
  | 'CLOSED';

// ── Intent ─────────────────────────────────────────────────────

export type ConversationIntent =
  | 'NEW_DIAGNOSIS'
  | 'FOLLOW_UP_QUESTION'
  | 'CLARIFICATION_RESPONSE'
  | 'GENERAL_AGRICULTURE_QUESTION'
  | 'DIAGNOSIS_CORRECTION'
  | 'UNKNOWN';

export type RuleName =
  | 'QUESTION_START'
  | 'HAS_PREVIOUS_DIAGNOSIS'
  | 'NO_SYMPTOM_KEYWORDS'
  | 'SYMPTOM_MATCH'
  | 'CORRECTION_MARKER'
  | 'GENERAL_AG_KEYWORD'
  | 'SHORT_CLARIFICATION'
  | 'KNOWLEDGE_LOOKUP'
  | 'STAGE_AWAITING_CLARIFICATION';

export interface IntentClassification {
  intent: ConversationIntent;
  confidence: number;
  matchedRules: RuleName[];
  reason: string;
}

// ── Workflow ───────────────────────────────────────────────────

export type Workflow = 'DIAGNOSIS' | 'FOLLOW_UP' | 'GENERAL_QA';

export type NextAction =
  | 'START_DIAGNOSIS'
  | 'CONTINUE_DIAGNOSIS'
  | 'ANSWER_FOLLOWUP'
  | 'ANSWER_GENERAL_QA'
  | 'ASK_CLARIFICATION';

// ── Decision ───────────────────────────────────────────────────

export interface ConversationDecision {
  status: ConversationStatus | null;
  stage: ConversationStage;
  intent: ConversationIntent;
  confidence: number;
  nextAction: NextAction;
  workflow: Workflow;
  matchedRules: RuleName[];
  reason: string;
}

// ── Context ────────────────────────────────────────────────────

export interface KnowledgeContext {
  crops: KnowledgeCrop[];
  diseases: KnowledgeDisease[];
  deficiencies: KnowledgeDeficiency[];
  glossary: KnowledgeGlossaryEntry[];
  hasDirectAnswer?: string;
}

export interface ConversationContext {
  conversationId?: string;
  conversation?: ConversationDocument;
  status: ConversationStatus | null;
  stage: ConversationStage;
  latestUserMessage: string;
  recentMessages: ChatMessage[];
  latestAIResponse?: string;
  latestDiagnosis?: DiagnosisDocument;
  currentCrop?: KnowledgeCrop;
  knowledgeContext?: KnowledgeContext;
  previousRecommendations: string[];
  requiresClarification: boolean;
}

// ── Prompt ─────────────────────────────────────────────────────

export interface PromptContext {
  systemPrompt: string;
  knowledge: string;
  conversationHistory: ChatMessage[];
  userMessage: ChatMessage;
}

// ── State resolver ─────────────────────────────────────────────

export interface StateResult {
  status: ConversationStatus | null;
  stage: ConversationStage;
  requiresClarification: boolean;
}

// ── Loader ─────────────────────────────────────────────────────

export interface LoaderResult {
  conversation?: ConversationDocument;
  conversationId?: string;
  status: ConversationStatus | null;
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// services/conversation/index.ts
export * from './types';
export { ConversationOrchestrator } from './ConversationOrchestrator';
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /home/tobe/projects/farmpal && npx tsc --noEmit 2>&1
```

Expected: clean output.

- [ ] **Step 4: Commit**

```bash
git add services/conversation/
git commit -m "feat: add conversation orchestrator types"
```

---

### Task 3: Implement WorkflowRouter

Pure function, no dependencies. Maps `nextAction` to `Workflow`.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/conversation/WorkflowRouter.test.ts
import { describe, it, expect } from 'vitest';
import { WorkflowRouter } from '@/services/conversation/WorkflowRouter';

describe('WorkflowRouter', () => {
  const router = new WorkflowRouter();

  it('routes START_DIAGNOSIS to DIAGNOSIS', () => {
    expect(router.route('START_DIAGNOSIS')).toBe('DIAGNOSIS');
  });

  it('routes CONTINUE_DIAGNOSIS to DIAGNOSIS', () => {
    expect(router.route('CONTINUE_DIAGNOSIS')).toBe('DIAGNOSIS');
  });

  it('routes ANSWER_FOLLOWUP to FOLLOW_UP', () => {
    expect(router.route('ANSWER_FOLLOWUP')).toBe('FOLLOW_UP');
  });

  it('routes ANSWER_GENERAL_QA to GENERAL_QA', () => {
    expect(router.route('ANSWER_GENERAL_QA')).toBe('GENERAL_QA');
  });

  it('routes ASK_CLARIFICATION to DIAGNOSIS', () => {
    expect(router.route('ASK_CLARIFICATION')).toBe('DIAGNOSIS');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/WorkflowRouter.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 3: Implement WorkflowRouter**

```typescript
// services/conversation/WorkflowRouter.ts
import type { NextAction, Workflow } from './types';

const ROUTE_MAP: Record<NextAction, Workflow> = {
  START_DIAGNOSIS: 'DIAGNOSIS',
  CONTINUE_DIAGNOSIS: 'DIAGNOSIS',
  ANSWER_FOLLOWUP: 'FOLLOW_UP',
  ANSWER_GENERAL_QA: 'GENERAL_QA',
  ASK_CLARIFICATION: 'DIAGNOSIS',
};

export class WorkflowRouter {
  route(nextAction: NextAction): Workflow {
    return ROUTE_MAP[nextAction];
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/WorkflowRouter.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add services/conversation/WorkflowRouter.ts tests/unit/conversation/WorkflowRouter.test.ts
git commit -m "feat: add WorkflowRouter"
```

---

### Task 4: Implement ConversationStateResolver

Pure function. Determines status, stage, and `requiresClarification` from conversation metadata.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/conversation/ConversationStateResolver.test.ts
import { describe, it, expect } from 'vitest';
import { ConversationStateResolver } from '@/services/conversation/ConversationStateResolver';
import type { ConversationDocument } from '@/lib/db/models/conversation.model';

describe('ConversationStateResolver', () => {
  const resolver = new ConversationStateResolver();

  it('returns NEW for no conversationId', () => {
    const result = resolver.resolve({ conversationId: undefined });
    expect(result.status).toBeNull();
    expect(result.stage).toBe('NEW');
    expect(result.requiresClarification).toBe(false);
  });

  it('returns AWAITING_CLARIFICATION when last message is follow_up with no user response', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: '{"status":"follow_up"}', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('AWAITING_CLARIFICATION');
    expect(result.requiresClarification).toBe(true);
  });

  it('returns SHOWING_RESULT when last assistant response is a diagnosis', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'Based on the symptoms, this is likely...', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('SHOWING_RESULT');
    expect(result.requiresClarification).toBe(false);
  });

  it('returns FOLLOW_UP after multiple turns since diagnosis', () => {
    const conversation = {
      status: 'ACTIVE',
      messages: [
        { role: 'user', content: 'my cassava has spots', createdAt: new Date() },
        { role: 'assistant', content: 'Based on symptoms this is blight', createdAt: new Date() },
        { role: 'user', content: 'what fertilizer should I use', createdAt: new Date() },
      ],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('ACTIVE');
    expect(result.stage).toBe('FOLLOW_UP');
  });

  it('returns CLOSED for completed conversations', () => {
    const conversation = {
      status: 'COMPLETED',
      messages: [],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBe('COMPLETED');
    expect(result.stage).toBe('CLOSED');
  });

  it('returns NEW for abandoned conversations', () => {
    const conversation = {
      status: 'ABANDONED',
      messages: [],
    } as unknown as ConversationDocument;

    const result = resolver.resolve({ conversation, conversationId: 'abc' });
    expect(result.status).toBeNull();
    expect(result.stage).toBe('NEW');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/ConversationStateResolver.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 3: Implement ConversationStateResolver**

```typescript
// services/conversation/ConversationStateResolver.ts
import type { ConversationDocument } from '@/lib/db/models/conversation.model';
import type { ConversationStage, ConversationStatus, StateResult } from './types';

export class ConversationStateResolver {
  resolve(params: {
    conversation?: ConversationDocument;
    conversationId?: string;
  }): StateResult {
    if (!params.conversationId || !params.conversation) {
      return { status: null, stage: 'NEW', requiresClarification: false };
    }

    const { conversation } = params;

    if (conversation.status === 'COMPLETED') {
      return { status: 'COMPLETED', stage: 'CLOSED', requiresClarification: false };
    }

    if (conversation.status === 'ABANDONED') {
      return { status: null, stage: 'NEW', requiresClarification: false };
    }

    // Infer stage from messages
    const assistantMessages = conversation.messages.filter((m) => m.role === 'assistant');
    const lastAssistantContent = assistantMessages[assistantMessages.length - 1]?.content ?? '';

    let isFollowUp = false;
    try {
      const parsed = JSON.parse(lastAssistantContent);
      isFollowUp = parsed.status === 'follow_up';
    } catch {
      // content is plain text, not JSON — it's a diagnosis or answer
    }

    const lastUserIndex = [...conversation.messages]
      .reverse()
      .findIndex((m) => m.role === 'user');

    if (isFollowUp && lastUserIndex === 0) {
      return { status: 'ACTIVE', stage: 'AWAITING_CLARIFICATION', requiresClarification: true };
    }

    if (isFollowUp) {
      return { status: 'ACTIVE', stage: 'AWAITING_CLARIFICATION', requiresClarification: true };
    }

    // Check if this is right after a diagnosis (last assistant message, no user follow-up)
    if (assistantMessages.length <= 1 && conversation.messages.filter((m) => m.role === 'user').length <= 1) {
      return { status: 'ACTIVE', stage: 'SHOWING_RESULT', requiresClarification: false };
    }

    // Multiple turns since diagnosis
    return { status: 'ACTIVE', stage: 'FOLLOW_UP', requiresClarification: false };
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/ConversationStateResolver.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add services/conversation/ConversationStateResolver.ts tests/unit/conversation/ConversationStateResolver.test.ts
git commit -m "feat: add ConversationStateResolver"
```

---

### Task 5: Implement IntentClassifier

Offline-only, no AI calls. Rule engine + knowledge lookup fallback.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/conversation/IntentClassifier.test.ts
import { describe, it, expect } from 'vitest';
import { IntentClassifier } from '@/services/conversation/IntentClassifier';
import type { ConversationContext } from '@/services/conversation/types';

function makeContext(overrides: Partial<ConversationContext>): ConversationContext {
  return {
    status: 'ACTIVE',
    stage: 'FOLLOW_UP',
    latestUserMessage: '',
    recentMessages: [],
    previousRecommendations: [],
    requiresClarification: false,
    ...overrides,
  };
}

describe('IntentClassifier', () => {
  const classifier = new IntentClassifier();

  it('detects FOLLOW_UP for question starting with "what" and existing diagnosis', () => {
    const ctx = makeContext({
      stage: 'FOLLOW_UP',
      latestUserMessage: 'what fertilizer should I apply',
      recentMessages: [
        { id: '1', role: 'user', content: 'my cassava has spots', createdAt: '' },
        { id: '2', role: 'assistant', content: 'diagnosis result', createdAt: '' },
      ],
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('FOLLOW_UP_QUESTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.matchedRules).toContain('QUESTION_START');
  });

  it('detects DIAGNOSIS_CORRECTION for correction markers', () => {
    const ctx = makeContext({
      latestUserMessage: 'actually the crop is rice',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('DIAGNOSIS_CORRECTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.matchedRules).toContain('CORRECTION_MARKER');
  });

  it('detects NEW_DIAGNOSIS for symptom keywords', () => {
    const ctx = makeContext({
      stage: 'NEW',
      latestUserMessage: 'my cassava leaves are turning yellow',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('NEW_DIAGNOSIS');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.matchedRules).toContain('SYMPTOM_MATCH');
  });

  it('detects GENERAL_AGRICULTURE for ag keywords', () => {
    const ctx = makeContext({
      latestUserMessage: 'what is crop rotation',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('GENERAL_AGRICULTURE_QUESTION');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects CLARIFICATION_RESPONSE for short message when awaiting clarification', () => {
    const ctx = makeContext({
      stage: 'AWAITING_CLARIFICATION',
      requiresClarification: true,
      latestUserMessage: 'they are black',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('CLARIFICATION_RESPONSE');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('returns UNKNOWN when no rules match', () => {
    const ctx = makeContext({
      stage: 'NEW',
      latestUserMessage: 'hello world',
    });

    const result = classifier.classify(ctx);
    expect(result.intent).toBe('UNKNOWN');
    expect(result.confidence).toBe(0);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/IntentClassifier.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 3: Implement IntentClassifier**

```typescript
// services/conversation/IntentClassifier.ts
import type { ConversationContext, ConversationIntent, IntentClassification, RuleName } from './types';

const SYMPTOM_KEYWORDS = [
  'yellow', 'yellowing', 'spots', 'spotting', 'wilting', 'curling',
  'lesion', 'lesions', 'blight', 'rust', 'mildew', 'rot', 'rotting',
  'brown', 'black', 'white', 'powdery', 'downy', 'streak', 'streaks',
  'stunt', 'stunted', 'mosaic', 'leaf', 'leaves', 'stem', 'root',
  'wilt', 'blotch', 'blotches', 'dieback', 'gummosis', 'canker',
];

const GENERAL_AG_KEYWORDS = [
  'crop rotation', 'fertilizer', 'npk', 'planting season', 'variety',
  'cultivar', 'soil', 'irrigation', 'harvest', 'sowing', 'spacing',
  'compost', 'manure', 'mulch', 'intercrop', 'intercropping',
];

const CORRECTION_MARKERS = [
  'actually', 'i meant', 'correction', 'wrong crop', 'not maize',
  'not cassava', 'not rice', 'not yam', 'not sorghum',
];

const QUESTION_WORDS = ['what', 'why', 'how', 'can', 'which', 'does', 'do', 'is', 'are', 'should'];

export class IntentClassifier {
  classify(context: ConversationContext): IntentClassification {
    const message = context.latestUserMessage.toLowerCase().trim();

    // ── Phase 1: Rules engine ──────────────────────────────────

    // Rule: Short clarification response
    if (context.stage === 'AWAITING_CLARIFICATION' && context.requiresClarification && message.split(/\s+/).length < 5) {
      return {
        intent: 'CLARIFICATION_RESPONSE',
        confidence: 0.95,
        matchedRules: ['SHORT_CLARIFICATION', 'STAGE_AWAITING_CLARIFICATION'],
        reason: 'Short message while AI awaits clarification',
      };
    }

    // Rule: Correction marker
    const hasCorrection = CORRECTION_MARKERS.some((m) => message.includes(m));
    if (hasCorrection) {
      return {
        intent: 'DIAGNOSIS_CORRECTION',
        confidence: 0.88,
        matchedRules: ['CORRECTION_MARKER'],
        reason: 'Message contains correction marker',
      };
    }

    // Rule: Symptom keywords
    const hasSymptomWords = SYMPTOM_KEYWORDS.some((kw) => message.includes(kw));
    if (hasSymptomWords && context.stage === 'NEW') {
      return {
        intent: 'NEW_DIAGNOSIS',
        confidence: 0.85,
        matchedRules: ['SYMPTOM_MATCH'],
        reason: 'Message contains symptom keywords with no active conversation',
      };
    }

    // Rule: General agriculture keywords
    const hasAgKeywords = GENERAL_AG_KEYWORDS.some((kw) => message.includes(kw));
    if (hasAgKeywords) {
      return {
        intent: 'GENERAL_AGRICULTURE_QUESTION',
        confidence: 0.82,
        matchedRules: ['GENERAL_AG_KEYWORD'],
        reason: 'Message contains general agriculture keywords',
      };
    }

    // Rule: Question word starts the message
    const startsWithQuestionWord = QUESTION_WORDS.some((qw) => message.startsWith(qw));
    const hasExistingDiagnosis = context.recentMessages.length >= 2 && context.stage !== 'NEW';

    if (startsWithQuestionWord && hasExistingDiagnosis) {
      return {
        intent: 'FOLLOW_UP_QUESTION',
        confidence: 0.94,
        matchedRules: ['QUESTION_START', 'HAS_PREVIOUS_DIAGNOSIS'],
        reason: 'Question pattern while an active diagnosis context exists',
      };
    }

    // ── Phase 2: Knowledge lookup (moderate confidence) ─────────
    if (hasSymptomWords) {
      return {
        intent: 'NEW_DIAGNOSIS',
        confidence: 0.65,
        matchedRules: ['SYMPTOM_MATCH'],
        reason: 'Symptom keywords found but context is uncertain',
      };
    }

    if (startsWithQuestionWord) {
      return {
        intent: 'FOLLOW_UP_QUESTION',
        confidence: 0.55,
        matchedRules: ['QUESTION_START', 'NO_SYMPTOM_KEYWORDS'],
        reason: 'Question pattern but no prior diagnosis context',
      };
    }

    // ── Phase 3: Default ────────────────────────────────────────
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      matchedRules: [],
      reason: 'No rules matched',
    };
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/IntentClassifier.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add services/conversation/IntentClassifier.ts tests/unit/conversation/IntentClassifier.test.ts
git commit -m "feat: add IntentClassifier with offline rule engine"
```

---

### Task 6: Implement ConversationDecisionBuilder

Maps `{ stage, intent }` to `nextAction`.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/conversation/ConversationDecisionBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { ConversationDecisionBuilder } from '@/services/conversation/ConversationDecisionBuilder';
import type { ConversationContext, ConversationStage, ConversationIntent } from '@/services/conversation/types';

describe('ConversationDecisionBuilder', () => {
  const builder = new ConversationDecisionBuilder();

  function build(stage: ConversationStage, intent: ConversationIntent) {
    return builder.build(
      { status: 'ACTIVE', stage, latestUserMessage: '', recentMessages: [], previousRecommendations: [], requiresClarification: false } as ConversationContext,
      { status: 'ACTIVE', stage, requiresClarification: false },
      { intent, confidence: 0.9, matchedRules: [], reason: 'test' },
    );
  }

  it('NEW + NEW_DIAGNOSIS -> START_DIAGNOSIS', () => {
    const d = build('NEW', 'NEW_DIAGNOSIS');
    expect(d.nextAction).toBe('START_DIAGNOSIS');
    expect(d.workflow).toBe('DIAGNOSIS');
  });

  it('AWAITING_CLARIFICATION + CLARIFICATION_RESPONSE -> CONTINUE_DIAGNOSIS', () => {
    const d = build('AWAITING_CLARIFICATION', 'CLARIFICATION_RESPONSE');
    expect(d.nextAction).toBe('CONTINUE_DIAGNOSIS');
  });

  it('SHOWING_RESULT + FOLLOW_UP_QUESTION -> ANSWER_FOLLOWUP', () => {
    const d = build('SHOWING_RESULT', 'FOLLOW_UP_QUESTION');
    expect(d.nextAction).toBe('ANSWER_FOLLOWUP');
  });

  it('GENERAL_AGRICULTURE_QUESTION -> ANSWER_GENERAL_QA regardless of stage', () => {
    const d = build('FOLLOW_UP', 'GENERAL_AGRICULTURE_QUESTION');
    expect(d.nextAction).toBe('ANSWER_GENERAL_QA');
  });

  it('UNKNOWN -> ASK_CLARIFICATION', () => {
    const d = build('NEW', 'UNKNOWN');
    expect(d.nextAction).toBe('ASK_CLARIFICATION');
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/ConversationDecisionBuilder.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 3: Implement ConversationDecisionBuilder**

```typescript
// services/conversation/ConversationDecisionBuilder.ts
import { WorkflowRouter } from './WorkflowRouter';
import type { ConversationContext, ConversationDecision, ConversationIntent, ConversationStage, IntentClassification, NextAction, StateResult } from './types';

const ACTION_MAP: Record<string, NextAction> = {
  'NEW|NEW_DIAGNOSIS': 'START_DIAGNOSIS',
  'AWAITING_CLARIFICATION|CLARIFICATION_RESPONSE': 'CONTINUE_DIAGNOSIS',
  'AWAITING_CLARIFICATION|NEW_DIAGNOSIS': 'CONTINUE_DIAGNOSIS',
  'AWAITING_CLARIFICATION|FOLLOW_UP_QUESTION': 'CONTINUE_DIAGNOSIS',
  'AWAITING_CLARIFICATION|UNKNOWN': 'CONTINUE_DIAGNOSIS',
  'SHOWING_RESULT|FOLLOW_UP_QUESTION': 'ANSWER_FOLLOWUP',
  'SHOWING_RESULT|NEW_DIAGNOSIS': 'START_DIAGNOSIS',
  'FOLLOW_UP|FOLLOW_UP_QUESTION': 'ANSWER_FOLLOWUP',
  'FOLLOW_UP|NEW_DIAGNOSIS': 'START_DIAGNOSIS',
};

export class ConversationDecisionBuilder {
  private router = new WorkflowRouter();

  build(
    context: ConversationContext,
    state: StateResult,
    classification: IntentClassification,
  ): ConversationDecision {
    const { intent } = classification;
    const stage = state.stage;

    let nextAction: NextAction;

    // GENERAL_AGRICULTURE_QUESTION and DIAGNOSIS_CORRECTION are stage-independent
    if (intent === 'GENERAL_AGRICULTURE_QUESTION') {
      nextAction = 'ANSWER_GENERAL_QA';
    } else if (intent === 'DIAGNOSIS_CORRECTION') {
      nextAction = 'START_DIAGNOSIS';
    } else if (intent === 'UNKNOWN') {
      nextAction = 'ASK_CLARIFICATION';
    } else {
      const key = `${stage}|${intent}`;
      nextAction = ACTION_MAP[key] ?? 'ASK_CLARIFICATION';
    }

    const workflow = this.router.route(nextAction);

    return {
      status: state.status,
      stage,
      intent,
      confidence: classification.confidence,
      nextAction,
      workflow,
      matchedRules: classification.matchedRules,
      reason: classification.reason,
    };
  }
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/ConversationDecisionBuilder.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 5: Commit**

```bash
git add services/conversation/ConversationDecisionBuilder.ts tests/unit/conversation/ConversationDecisionBuilder.test.ts
git commit -m "feat: add ConversationDecisionBuilder"
```

---

### Task 7: Implement ConversationContextLoader

Loads conversation from DB via ConversationRepository.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/conversation/ConversationContextLoader.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ConversationContextLoader } from '@/services/conversation/ConversationContextLoader';

vi.mock('@/repositories/conversation.repository', () => ({
  ConversationRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
  })),
}));

describe('ConversationContextLoader', () => {
  it('loads existing conversation when conversationId is provided', async () => {
    const { ConversationRepository } = await import('@/repositories/conversation.repository');
    const mockFindById = vi.mocked(new ConversationRepository().findById);
    mockFindById.mockResolvedValue({ status: 'ACTIVE', messages: [] } as any);

    const loader = new ConversationContextLoader();
    const result = await loader.load({ symptoms: 'test', conversationId: 'abc' });

    expect(result.conversationId).toBe('abc');
    expect(result.status).toBe('ACTIVE');
  });

  it('returns null status when no conversationId provided', async () => {
    const loader = new ConversationContextLoader();
    const result = await loader.load({ symptoms: 'test' });

    expect(result.conversationId).toBeUndefined();
    expect(result.status).toBeNull();
  });
});
```

- [ ] **Step 2: Implement ConversationContextLoader**

```typescript
// services/conversation/ConversationContextLoader.ts
import type { DiagnosisRequest } from '@/types';
import { ConversationRepository } from '@/repositories/conversation.repository';
import type { ConversationStatus, LoaderResult } from './types';

export class ConversationContextLoader {
  private conversationRepository = new ConversationRepository();

  async load(request: DiagnosisRequest): Promise<LoaderResult> {
    if (!request.conversationId) {
      return { status: null };
    }

    const conversation = await this.conversationRepository.findById(request.conversationId);

    if (!conversation) {
      return { status: null, conversationId: request.conversationId };
    }

    return {
      conversation,
      conversationId: request.conversationId,
      status: conversation.status as ConversationStatus,
    };
  }
}
```

- [ ] **Step 3: Run test**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/ConversationContextLoader.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add services/conversation/ConversationContextLoader.ts tests/unit/conversation/ConversationContextLoader.test.ts
git commit -m "feat: add ConversationContextLoader"
```

---

### Task 8: Implement PromptStrategy

Strategy interface with three implementations per workflow.

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/conversation/PromptStrategy.test.ts
import { describe, it, expect } from 'vitest';
import { DiagnosisPromptStrategy, FollowUpPromptStrategy } from '@/services/conversation/PromptStrategy';
import type { ConversationContext, ConversationDecision } from '@/services/conversation/types';

describe('PromptStrategy', () => {
  const baseContext: ConversationContext = {
    status: 'ACTIVE',
    stage: 'NEW',
    latestUserMessage: 'my cassava leaves are turning yellow',
    recentMessages: [],
    previousRecommendations: [],
    requiresClarification: false,
  };

  const baseDecision: ConversationDecision = {
    status: 'ACTIVE',
    stage: 'NEW',
    intent: 'NEW_DIAGNOSIS',
    confidence: 0.85,
    nextAction: 'START_DIAGNOSIS',
    workflow: 'DIAGNOSIS',
    matchedRules: [],
    reason: 'test',
  };

  it('DiagnosisPromptStrategy includes symptoms in user message', () => {
    const strategy = new DiagnosisPromptStrategy();
    const result = strategy.build(baseContext, baseDecision);
    expect(result.userMessage.content).toContain('turning yellow');
  });

  it('FollowUpPromptStrategy includes conversation history', () => {
    const ctx: ConversationContext = {
      ...baseContext,
      stage: 'FOLLOW_UP',
      latestUserMessage: 'what fertilizer should I apply',
      recentMessages: [
        { id: '1', role: 'user' as const, content: 'my cassava has spots', createdAt: '' },
        { id: '2', role: 'assistant' as const, content: 'diagnosis result', createdAt: '' },
      ],
    };

    const strategy = new FollowUpPromptStrategy();
    const result = strategy.build(ctx, baseDecision);
    expect(result.conversationHistory.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Implement PromptStrategy and MessageBuilder**

```typescript
// services/conversation/PromptStrategy.ts
import { buildSystemMessages } from '@/lib/ai/prompts';
import type { ChatMessage } from '@/types';
import type { ConversationContext, ConversationDecision, PromptContext } from './types';

export interface PromptStrategy {
  build(context: ConversationContext, decision: ConversationDecision): PromptContext;
}

export class DiagnosisPromptStrategy implements PromptStrategy {
  build(context: ConversationContext, _decision: ConversationDecision): PromptContext {
    const knowledge = context.knowledgeContext
      ? serializeKnowledgeContext(context.knowledgeContext)
      : '';

    return {
      systemPrompt: 'You are a crop disease diagnosis assistant for Nigerian farmers.',
      knowledge,
      conversationHistory: context.recentMessages,
      userMessage: {
        id: crypto.randomUUID(),
        role: 'user',
        content: context.latestUserMessage,
        createdAt: new Date().toISOString(),
      },
    };
  }
}

export class FollowUpPromptStrategy implements PromptStrategy {
  build(context: ConversationContext, _decision: ConversationDecision): PromptContext {
    const knowledge = context.knowledgeContext
      ? serializeKnowledgeContext(context.knowledgeContext)
      : '';

    const extraContext = context.latestDiagnosis
      ? `Previous diagnosis: ${context.latestDiagnosis.diseaseName}\nReasoning: ${context.latestDiagnosis.reasoning}`
      : '';

    return {
      systemPrompt: [
        'You are a crop disease diagnosis assistant for Nigerian farmers.',
        'The user is asking a follow-up question about a previous diagnosis.',
        'Answer their specific question concisely using the diagnosis context below.',
      ].join('\n'),
      knowledge: [knowledge, extraContext].filter(Boolean).join('\n\n'),
      conversationHistory: context.recentMessages,
      userMessage: {
        id: crypto.randomUUID(),
        role: 'user',
        content: context.latestUserMessage,
        createdAt: new Date().toISOString(),
      },
    };
  }
}

export class GeneralQaPromptStrategy implements PromptStrategy {
  build(context: ConversationContext, _decision: ConversationDecision): PromptContext {
    const knowledge = context.knowledgeContext
      ? serializeKnowledgeContext(context.knowledgeContext)
      : '';

    return {
      systemPrompt: [
        'You are a farming assistant for Nigerian farmers.',
        'Answer general agriculture questions using the knowledge provided below.',
        'If the knowledge does not contain the answer, use your own knowledge.',
      ].join('\n'),
      knowledge,
      conversationHistory: context.recentMessages,
      userMessage: {
        id: crypto.randomUUID(),
        role: 'user',
        content: context.latestUserMessage,
        createdAt: new Date().toISOString(),
      },
    };
  }
}

function serializeKnowledgeContext(kc: NonNullable<ConversationContext['knowledgeContext']>): string {
  const parts: string[] = [];

  if (kc.crops.length > 0) {
    parts.push(`Crops: ${kc.crops.map((c) => c.name).join(', ')}`);
  }
  if (kc.diseases.length > 0) {
    parts.push(`Relevant diseases: ${kc.diseases.map((d) => d.name).join(', ')}`);
  }
  if (kc.deficiencies.length > 0) {
    parts.push(`Deficiencies: ${kc.deficiencies.map((d) => d.name).join(', ')}`);
  }

  return parts.join('\n');
}
```

```typescript
// services/conversation/MessageBuilder.ts
import type { ChatMessage } from '@/types';
import type { PromptContext } from './types';
import { buildSystemMessages } from '@/lib/ai/prompts';

export class MessageBuilder {
  build(prompt: PromptContext): ChatMessage[] {
    const allMessages = [...prompt.conversationHistory, prompt.userMessage];
    return buildSystemMessages('diagnosis', allMessages, prompt.knowledge || prompt.systemPrompt);
  }
}
```

- [ ] **Step 3: Run test**

```bash
cd /home/tobe/projects/farmpal && npx vitest run tests/unit/conversation/PromptStrategy.test.ts --reporter=verbose 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add services/conversation/PromptStrategy.ts services/conversation/MessageBuilder.ts tests/unit/conversation/PromptStrategy.test.ts
git commit -m "feat: add PromptStrategy and MessageBuilder"
```

---

### Task 9: Implement KnowledgeContextBuilder

Gathers structured knowledge from the Knowledge Engine. Non-fatal on failure.

- [ ] **Step 1: Implement KnowledgeContextBuilder**

```typescript
// services/conversation/KnowledgeContextBuilder.ts
import { knowledgeService } from '@/services/knowledge.service';
import type { ConversationContext, KnowledgeContext } from './types';

export class KnowledgeContextBuilder {
  async build(context: ConversationContext): Promise<KnowledgeContext | undefined> {
    try {
      const cropId = context.currentCrop?.id;
      const symptoms = context.latestUserMessage;

      const result: KnowledgeContext = {
        crops: [],
        diseases: [],
        deficiencies: [],
        glossary: [],
      };

      if (cropId) {
        result.diseases = knowledgeService.getDiseasesForCrop(cropId);
      }

      // Search for matching glossary entries and deficiencies
      if (symptoms) {
        const searchResults = knowledgeService.search(symptoms);
        result.glossary = searchResults
          .filter((r) => r.type === 'glossary')
          .map((r) => r.item) as KnowledgeContext['glossary'];

        // Check for a direct answer
        const directMatch = searchResults.find(
          (r) => r.score > 0.8 && r.type === 'disease',
        );
        if (directMatch && 'name' in directMatch.item) {
          result.hasDirectAnswer = (directMatch.item as { name: string }).name;
        }
      }

      return result;
    } catch (error) {
      console.error('[KnowledgeContextBuilder] Failed to build knowledge context:', error);
      return undefined;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/conversation/KnowledgeContextBuilder.ts
git commit -m "feat: add KnowledgeContextBuilder with graceful degradation"
```

---

### Task 10: Implement ConversationOrchestrator

The full execution engine. Coordinates all components and calls existing services.

- [ ] **Step 1: Implement ConversationOrchestrator**

```typescript
// services/conversation/ConversationOrchestrator.ts
import type { DiagnosisRequest, ConversationDiagnosisResponse, ChatResponse } from '@/types';
import { ConversationContextLoader } from './ConversationContextLoader';
import { ConversationStateResolver } from './ConversationStateResolver';
import { IntentClassifier } from './IntentClassifier';
import { ConversationDecisionBuilder } from './ConversationDecisionBuilder';
import { KnowledgeContextBuilder } from './KnowledgeContextBuilder';
import { DiagnosisPromptStrategy, FollowUpPromptStrategy, GeneralQaPromptStrategy } from './PromptStrategy';
import { MessageBuilder } from './MessageBuilder';
import { streamDiagnosis, createDiagnosis } from '@/services/diagnose.service';
import { processChatMessage } from '@/services/chat.service';
import type { ConversationContext, ConversationDecision } from './types';

export type OrchestratorResponse = ConversationDiagnosisResponse | ChatResponse;

export class ConversationOrchestrator {
  private loader = new ConversationContextLoader();
  private stateResolver = new ConversationStateResolver();
  private classifier = new IntentClassifier();
  private decisionBuilder = new ConversationDecisionBuilder();
  private knowledgeBuilder = new KnowledgeContextBuilder();
  private messageBuilder = new MessageBuilder();

  async execute(request: DiagnosisRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now();

    // 1. Load conversation context
    const loaded = await this.loader.load(request);

    // 2. Resolve state
    const state = this.stateResolver.resolve({
      conversation: loaded.conversation,
      conversationId: loaded.conversationId,
    });

    // 3. Build conversation context
    const context: ConversationContext = {
      conversationId: loaded.conversationId,
      conversation: loaded.conversation,
      status: state.status,
      stage: state.stage,
      latestUserMessage: request.symptoms,
      recentMessages: loaded.conversation?.messages ?? [],
      previousRecommendations: [],
      requiresClarification: state.requiresClarification,
    };

    // 4. Gather knowledge (lazy, best-effort)
    context.knowledgeContext = await this.knowledgeBuilder.build(context);

    // 5. Classify intent
    const classification = this.classifier.classify(context);

    // 6. Build decision
    const decision = this.decisionBuilder.build(context, state, classification);

    // 7. Log decision
    const decisionDuration = Date.now() - startTime;
    console.log('[ConversationOrchestrator]', JSON.stringify({
      conversationId: context.conversationId,
      intent: decision.intent,
      confidence: decision.confidence,
      matchedRules: decision.matchedRules,
      workflow: decision.workflow,
      nextAction: decision.nextAction,
      decisionDurationMs: decisionDuration,
    }));

    // 8. Route and execute
    return this.executeWorkflow(request, context, decision);
  }

  private async executeWorkflow(
    request: DiagnosisRequest,
    context: ConversationContext,
    decision: ConversationDecision,
  ): Promise<OrchestratorResponse> {
    const workflowStart = Date.now();

    // For streaming endpoints, the route handler handles the stream wrapping.
    // For non-streaming, we return the structured response directly.

    switch (decision.workflow) {
      case 'DIAGNOSIS': {
        // For clarification, inject context into the request
        const modifiedRequest = {
          ...request,
          context: {
            requiresClarification: decision.nextAction === 'ASK_CLARIFICATION',
            stage: decision.stage,
          },
        };
        return createDiagnosis(modifiedRequest);
      }

      case 'FOLLOW_UP': {
        const strategy = new FollowUpPromptStrategy();
        const prompt = strategy.build(context, decision);
        const messages = this.messageBuilder.build(prompt);

        // Call the diagnosis service with follow-up prompt
        const modifiedRequest: DiagnosisRequest = {
          ...request,
          context: {
            ...request.context,
            followUpMode: true,
            promptMessages: messages,
          },
        };
        return createDiagnosis(modifiedRequest);
      }

      case 'GENERAL_QA': {
        // If knowledge has a direct answer, return it immediately
        if (context.knowledgeContext?.hasDirectAnswer) {
          return {
            conversationId: context.conversationId ?? '',
            status: 'ACTIVE' as const,
            response: {
              status: 'follow_up' as const,
              question: context.knowledgeContext.hasDirectAnswer,
            },
          };
        }

        const strategy = new GeneralQaPromptStrategy();
        const prompt = strategy.build(context, decision);
        const messages = this.messageBuilder.build(prompt);

        return processChatMessage({ messages, cropContext: {
          cropId: context.currentCrop?.id ?? '',
          cropName: context.currentCrop?.name ?? '',
        }});
      }

      default:
        throw new Error(`Unknown workflow: ${decision.workflow}`);
    }
  }
}

export const conversationOrchestrator = new ConversationOrchestrator();
```

- [ ] **Step 2: Commit**

```bash
git add services/conversation/ConversationOrchestrator.ts
git commit -m "feat: add ConversationOrchestrator execution engine"
```

---

### Task 11: Add processFollowUp to diagnose service

- [ ] **Step 1: Add processFollowUp method to diagnose.service.ts**

```typescript
// Add to services/diagnose.service.ts (near the end, before getDiagnosisById)

/**
 * Processes a follow-up question within an existing diagnosis conversation.
 *
 * Reuses the streaming infrastructure but builds the prompt via FollowUpPromptStrategy
 * so the AI answers only the specific question rather than generating a new diagnosis.
 *
 * @param request - The diagnosis request with follow-up context
 * @returns A conversation-aware response
 */
export async function processFollowUp(
  request: DiagnosisRequest,
): Promise<ConversationDiagnosisResponse> {
  const crop = request.cropId ? await cropRepository.findById(request.cropId) : null;
  const mappedCrop: Crop | undefined = crop ? mapCropDocument(crop) : undefined;

  let conversationId: string;
  let existingMessages: ChatMessage[] = [];

  if (request.conversationId) {
    const existing = await conversationRepository.findById(request.conversationId);
    if (!existing) throw new NotFoundError('Conversation');
    conversationId = request.conversationId;
    existingMessages = existing.messages.map(mapMessageSubDoc);
  } else {
    const created = await conversationRepository.createConversation({
      messages: [],
      cropId: request.cropId,
      cropName: crop?.name,
    });
    conversationId = String(created._id);
  }

  await conversationRepository.appendMessage(conversationId, {
    role: 'user',
    content: request.symptoms,
  });

  const generateDiagnosis = await getDiagnosisAdapter();
  const aiProvider = getAdapterProviderName();
  const response = await generateDiagnosis(request, mappedCrop, existingMessages);

  if (response.status === 'follow_up') {
    await conversationRepository.appendMessage(conversationId, {
      role: 'assistant',
      content: response.question,
    });
  } else {
    await conversationRepository.appendMessage(conversationId, {
      role: 'assistant',
      content: response.diagnosis.reasoning,
    });
  }

  return {
    conversationId,
    status: 'ACTIVE',
    response,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add services/diagnose.service.ts
git commit -m "feat: add processFollowUp to diagnose service"
```

---

### Task 12: Wire up ChatService for General QA

- [ ] **Step 1: Replace chat.service.ts placeholder with actual implementation**

```typescript
// services/chat.service.ts
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

  const aiMessages = buildSystemMessages('diagnosis', messages, extraContext);

  const rawText = await infer(aiMessages, {
    task: 'diagnosis',
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
```

- [ ] **Step 2: Commit**

```bash
git add services/chat.service.ts
git commit -m "feat: wire up chat service with AI inference for General QA"
```

---

### Task 13: Simplify controllers to use orchestrator

- [ ] **Step 1: Update diagnose.controller.ts**

```typescript
// controllers/diagnose.controller.ts — updated handleDiagnosisRequest and handleStreamDiagnosis

import { conversationOrchestrator } from '@/services/conversation/ConversationOrchestrator';
import type { ConversationDiagnosisResponse } from '@/types';
import { validateDiagnosisRequest } from '@/lib/validation';

export async function handleDiagnosisRequest(
  body: unknown,
): Promise<ConversationDiagnosisResponse> {
  const request = validateDiagnosisRequest(body);
  const result = await conversationOrchestrator.execute(request);

  // If the orchestrator returned a ChatResponse, wrap it as a ConversationDiagnosisResponse
  if ('message' in result) {
    return {
      conversationId: request.conversationId ?? '',
      status: 'ACTIVE',
      response: {
        status: 'follow_up',
        question: result.message.content,
      },
    };
  }

  return result;
}

export async function handleStreamDiagnosis(
  body: unknown,
): Promise<ReadableStream<Uint8Array>> {
  const request = validateDiagnosisRequest(body);

  // For streaming, we still need to call streamDiagnosis directly since
  // streaming and non-streaming are different response types.
  // The orchestrator provides the decision for the controller to dispatch.
  // In a future iteration, the orchestrator could support streaming too.

  const { knowledgeService } = await import('@/services/knowledge.service');
  const { streamDiagnosis } = await import('@/services/diagnose.service');
  const { validateCropExists } = await import('@/lib/validation');

  let detectedCropInfo: { cropId: string; cropName: string; confidence: string } | undefined;

  if (!request.cropId) {
    const inference = knowledgeService.inferCrop(request.symptoms);
    if (inference.detected && inference.crop) {
      request.cropId = inference.crop.id;
      detectedCropInfo = {
        cropId: inference.crop.id,
        cropName: inference.crop.name,
        confidence: inference.confidence,
      };
    }
  }

  if (request.cropId) {
    await validateCropExists(request.cropId);
  }

  const stream = await streamDiagnosis(request);

  if (detectedCropInfo) {
    return prependCropDetectedEvent(stream, detectedCropInfo);
  }

  return stream;
}
```

- [ ] **Step 2: Update chat.controller.ts**

```typescript
// controllers/chat.controller.ts
import { processChatMessage } from '@/services/chat.service';
import type { ChatRequest, ChatResponse } from '@/types';

export async function handleChatRequest(body: unknown): Promise<ChatResponse> {
  const request = body as ChatRequest;
  return processChatMessage(request);
}
```

- [ ] **Step 3: Commit**

```bash
git add controllers/diagnose.controller.ts controllers/chat.controller.ts
git commit -m "refactor: simplify controllers to delegate to orchestrator"
```

---

### Task 14: Verify everything builds

- [ ] **Step 1: TypeScript check**

```bash
cd /home/tobe/projects/farmpal && npx tsc --noEmit 2>&1
```

- [ ] **Step 2: Run all tests**

```bash
cd /home/tobe/projects/farmpal && npx vitest run --reporter=verbose 2>&1
```

- [ ] **Step 3: Lint check**

```bash
cd /home/tobe/projects/farmpal && npm run lint 2>&1
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "chore: fix type and lint issues after orchestration integration"
```

- [ ] **Step 5: Push branch**

```bash
git push origin feat/conversation-orchestrator
```
