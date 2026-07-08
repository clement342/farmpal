# Conversation Orchestrator Design

**Date:** 2026-07-07
**Status:** Approved
**Branch:** `feat/conversation-orchestrator`

## Problem

FarmPal currently assumes every incoming user message is a new diagnosis request.
Follow-up questions like "What fertilizer should I apply?" are incorrectly interpreted
as new symptoms, triggering redundant diagnosis flows.

## Solution

A structured orchestration layer that classifies incoming messages by intent before
routing to the appropriate workflow. This makes FarmPal offline-first, intent-aware,
and extensible beyond diagnosis.

## Architecture

```
Request
  |
  v
ConversationContextLoader    -- load conversation from DB
  |
  v
ConversationStateResolver    -- determine { status, stage }
  |
  v
KnowledgeContextBuilder      -- gather relevant knowledge (lazy, takes context)
  |
  v
IntentClassifier             -- rules -> knowledge (no AI fallback)
  |
  v
ConversationDecisionBuilder  -- stage + intent -> nextAction
  |
  v
WorkflowRouter(nextAction)   -- lightweight dispatch
  |
  v
[ PromptStrategy per workflow ]
  |         |               |
  v         v               v
[ DiagnosisService | processFollowUp | ChatService ]
  |
  v
Persist + Return
```

### Layers

```
Controller (thin: validate + call orchestrator.execute)
  |
  v
services/conversation/   <-- NEW
  ConversationOrchestrator.ts
  ConversationContextLoader.ts
  ConversationStateResolver.ts
  KnowledgeContextBuilder.ts
  IntentClassifier.ts
  ConversationDecisionBuilder.ts
  WorkflowRouter.ts
  PromptStrategy.ts
  MessageBuilder.ts
  types.ts
  |
  v
Existing services (diagnose.service, chat.service)
```

The orchestrator owns the full execution pipeline. The controller does:

```typescript
async function POST(request: NextRequest) {
  const body = await parseBody(request);
  validate(body);
  return orchestrator.execute(body);
}
```

No switch statements, no workflow awareness in the controller.

### Key Types

```typescript
// ── Lifecycle / Stage ──────────────────────────────────────────

type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

type ConversationStage =
  | 'NEW'
  | 'COLLECTING_SYMPTOMS'
  | 'AWAITING_CLARIFICATION'
  | 'DIAGNOSING'
  | 'SHOWING_RESULT'
  | 'FOLLOW_UP'
  | 'CLOSED';

// ── Intent ─────────────────────────────────────────────────────

type ConversationIntent =
  | 'NEW_DIAGNOSIS'
  | 'FOLLOW_UP_QUESTION'
  | 'CLARIFICATION_RESPONSE'
  | 'GENERAL_AGRICULTURE_QUESTION'
  | 'DIAGNOSIS_CORRECTION'
  | 'UNKNOWN';

type RuleName =
  | 'QUESTION_START'
  | 'HAS_PREVIOUS_DIAGNOSIS'
  | 'NO_SYMPTOM_KEYWORDS'
  | 'SYMPTOM_MATCH'
  | 'CORRECTION_MARKER'
  | 'GENERAL_AG_KEYWORD'
  | 'SHORT_CLARIFICATION'
  | 'KNOWLEDGE_LOOKUP'
  | 'STAGE_AWAITING_CLARIFICATION';

interface IntentClassification {
  intent: ConversationIntent;
  confidence: number;
  matchedRules: RuleName[];
  reason: string;
}

// ── Workflow ───────────────────────────────────────────────────

type Workflow = 'DIAGNOSIS' | 'FOLLOW_UP' | 'GENERAL_QA';

type NextAction =
  | 'START_DIAGNOSIS'
  | 'CONTINUE_DIAGNOSIS'
  | 'ANSWER_FOLLOWUP'
  | 'ANSWER_GENERAL_QA'
  | 'ASK_CLARIFICATION';

// ── Decision ───────────────────────────────────────────────────

interface ConversationDecision {
  status: ConversationStatus | null;
  stage: ConversationStage;
  intent: ConversationIntent;
  confidence: number;
  nextAction: NextAction;
  workflow: Workflow;
  matchedRules: RuleName[];
  reason: string;
}

// ── Context (lazy, structured) ─────────────────────────────────

interface KnowledgeContext {
  crops: KnowledgeCrop[];
  diseases: KnowledgeDisease[];
  deficiencies: KnowledgeDeficiency[];
  glossary: KnowledgeGlossaryEntry[];
  hasDirectAnswer?: string;  // set when knowledge engine can answer immediately
}

interface ConversationContext {
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
  requiresClarification: boolean;  // from structured response, not heuristic
}

// ── Prompt ─────────────────────────────────────────────────────

interface PromptContext {
  systemPrompt: string;
  knowledge: string;               // serialized from KnowledgeContext
  conversationHistory: ChatMessage[];
  userMessage: ChatMessage;
}
```

### Components

#### 1. ConversationContextLoader

Loads conversation metadata from the database. Does NOT load crop, diagnosis,
or knowledge — those are lazy-loaded by downstream components.

```typescript
class ConversationContextLoader {
  async load(request: DiagnosisRequest): Promise<{
    conversation?: ConversationDocument;
    conversationId?: string;
    status: ConversationStatus | null;
  }>;
}
```

Responsible for:
- Looking up an existing conversation by `request.conversationId`
- Returning the conversation document (or null if new)
- NOT loading crops, diagnoses, or knowledge

#### 2. ConversationStateResolver

Pure function (no DB calls). Determines the conversation stage and whether
the AI is awaiting clarification.

```typescript
class ConversationStateResolver {
  resolve(params: {
    conversation?: ConversationDocument;
    conversationId?: string;
  }): {
    status: ConversationStatus | null;
    stage: ConversationStage;
    requiresClarification: boolean;
  };
}
```

`requiresClarification` is determined from the structured response stored in
the conversation's last message metadata — NOT from punctuation heuristics.
When the AI returns a `follow_up` response type, the service stores it alongside
the message. The resolver checks this metadata.

**Resolution rules:**
- No `conversationId` -> `{ status: null, stage: 'NEW', requiresClarification: false }`
- Conversation `status: 'ACTIVE'`, last message type is `follow_up` -> `{ status: 'ACTIVE', stage: 'AWAITING_CLARIFICATION', requiresClarification: true }`
- Conversation `status: 'ACTIVE'`, last response was a diagnosis -> `{ status: 'ACTIVE', stage: 'SHOWING_RESULT' }`
- Conversation `status: 'ACTIVE'`, multiple turns since last diagnosis -> `{ status: 'ACTIVE', stage: 'FOLLOW_UP' }`
- Conversation `status: 'COMPLETED'` -> `{ status: 'COMPLETED', stage: 'CLOSED' }`
- Conversation `status: 'ABANDONED'` -> `{ status: null, stage: 'NEW' }`

#### 3. KnowledgeContextBuilder

Lazily gathers structured knowledge. Takes the assembled `ConversationContext`,
not individual params. If knowledge engine lookup fails, returns gracefully
without failing the request.

```typescript
class KnowledgeContextBuilder {
  async build(context: ConversationContext): Promise<KnowledgeContext | undefined>;
}
```

- Uses `context.currentCrop` and `context.latestUserMessage` for targeted lookups
- Calls `knowledgeService.search()`, `knowledgeService.getDiseasesForCrop()`, etc.
- If the search produces a direct answer (e.g., "NPK 15-15-15"), sets `hasDirectAnswer`
- Never throws on knowledge engine failure — logs and returns `undefined`

#### 4. IntentClassifier

Offline-only, no AI calls. Three-phase pipeline: rules -> knowledge -> default.

```typescript
class IntentClassifier {
  classify(context: ConversationContext): IntentClassification;
}
```

**Phase 1 — Rules engine (returns immediately when confidence >= 0.8):**

| Pattern | Intent | Confidence | Rules |
|---|---|---|---|
| Question start (`what`/`why`/`how`/`can`/`which`) + existing diagnosis | FOLLOW_UP | 0.94 | `QUESTION_START`, `HAS_PREVIOUS_DIAGNOSIS` |
| Contains correction marker (`actually`/`i meant`/`correction`/`wrong`) | DIAGNOSIS_CORRECTION | 0.88 | `CORRECTION_MARKER` |
| Symptom match via Knowledge Engine aliases | NEW_DIAGNOSIS | 0.85 | `SYMPTOM_MATCH` |
| Contains general ag keyword (`crop rotation`/`npk`/`fertilizer`/`planting season`) | GENERAL_AGRICULTURE | 0.82 | `GENERAL_AG_KEYWORD` |
| Short message (< 5 words) + AWAITING_CLARIFICATION stage | CLARIFICATION_RESPONSE | 0.95 | `SHORT_CLARIFICATION`, `STAGE_AWAITING_CLARIFICATION` |

**Phase 2 — Knowledge lookup (0.5 <= confidence < 0.8):**
- Run `knowledgeService.search()` against the user's message
- If results contain disease/crop matches, increase confidence toward NEW_DIAGNOSIS
- If results are ag-related but not symptom-like, increase toward GENERAL_AGRICULTURE
- Otherwise decrease confidence

**Phase 3 — Default (confidence < 0.5):**
- Return `{ intent: 'UNKNOWN', confidence: 0.0, matchedRules: [], reason: 'No rules matched and knowledge lookup was inconclusive' }`

No AI classification call. The diagnosis prompt itself handles clarification when
the orchestrator routes UNKNOWN to `ASK_CLARIFICATION`.

#### 5. WorkflowRouter

Pure mapping from `nextAction` to `workflow`. One line.

```typescript
class WorkflowRouter {
  route(nextAction: NextAction): Workflow;
}
```

| nextAction | Workflow |
|---|---|
| `START_DIAGNOSIS` | DIAGNOSIS |
| `CONTINUE_DIAGNOSIS` | DIAGNOSIS |
| `ANSWER_FOLLOWUP` | FOLLOW_UP |
| `ANSWER_GENERAL_QA` | GENERAL_QA |
| `ASK_CLARIFICATION` | DIAGNOSIS |

#### 6. ConversationDecisionBuilder

Assembles the final `ConversationDecision` from context, state, and classification.

```typescript
class ConversationDecisionBuilder {
  build(
    context: ConversationContext,
    state: StateResult,
    classification: IntentClassification,
  ): ConversationDecision;
}
```

**nextAction mapping:**
| Stage | Intent | nextAction |
|---|---|---|
| NEW | NEW_DIAGNOSIS | `START_DIAGNOSIS` |
| AWAITING_CLARIFICATION | CLARIFICATION_RESPONSE | `CONTINUE_DIAGNOSIS` |
| AWAITING_CLARIFICATION | any | `CONTINUE_DIAGNOSIS` |
| SHOWING_RESULT | FOLLOW_UP_QUESTION | `ANSWER_FOLLOWUP` |
| SHOWING_RESULT | NEW_DIAGNOSIS | `START_DIAGNOSIS` |
| FOLLOW_UP | FOLLOW_UP_QUESTION | `ANSWER_FOLLOWUP` |
| FOLLOW_UP | NEW_DIAGNOSIS | `START_DIAGNOSIS` |
| any | GENERAL_AGRICULTURE_QUESTION | `ANSWER_GENERAL_QA` |
| any | DIAGNOSIS_CORRECTION | `START_DIAGNOSIS` |
| any | UNKNOWN | `ASK_CLARIFICATION` |

#### 7. PromptStrategy

Each workflow builds a provider-agnostic `PromptContext`. Strategies do NOT
return `ChatMessage[]` — a separate `MessageBuilder` handles serialization.

```typescript
interface PromptStrategy {
  build(
    context: ConversationContext,
    decision: ConversationDecision,
  ): PromptContext;
}

class DiagnosisPromptStrategy implements PromptStrategy { ... }
class FollowUpPromptStrategy implements PromptStrategy { ... }
class GeneralQaPromptStrategy implements PromptStrategy { ... }
```

- `DiagnosisPromptStrategy` — existing diagnosis prompt structure
- `FollowUpPromptStrategy` — injects existing diagnosis + recommendations + knowledge; asks AI to answer the specific question without re-diagnosing
- `GeneralQaPromptStrategy` — injects knowledge context; prompts AI to answer from knowledge first, then its own capabilities

`MessageBuilder` converts `PromptContext` to `ChatMessage[]` for the AI provider:

```typescript
class MessageBuilder {
  build(prompt: PromptContext): ChatMessage[];
}
```

#### 8. ConversationOrchestrator

The true execution engine. Entry point for controllers. Owns the full pipeline —
from loading to response. Controllers know nothing about workflows.

```typescript
class ConversationOrchestrator {
  async execute(
    request: DiagnosisRequest,
  ): Promise<ConversationDiagnosisResponse | ChatResponse>;
}
```

Internal flow:
1. `ConversationContextLoader.load(request)` -> conversation, status
2. `ConversationStateResolver.resolve(...)` -> stage, requiresClarification
3. `KnowledgeContextBuilder.build(context)` -> structured knowledge (lazy, best-effort)
4. `IntentClassifier.classify(context)` -> intent classification
5. `ConversationDecisionBuilder.build(context, state, classification)` -> decision with nextAction + workflow
6. **Route internally based on workflow:**
   - `DIAGNOSIS` -> select `DiagnosisPromptStrategy`, call `DiagnosisService.streamDiagnosis()`
   - `FOLLOW_UP` -> select `FollowUpPromptStrategy`, call `DiagnosisService.processFollowUp()`
   - `GENERAL_QA` -> select `GeneralQaPromptStrategy`, call `ChatService.processChatMessage()`
7. Return response

### Clarification Detection

`requiresClarification` is always determined from the structured response metadata,
never from text heuristics. When the AI returns a `follow_up` response, the service
persists the type alongside the message content. The resolver reads this metadata.

If the conversation model lacks a dedicated field, the response type is stored as
a lightweight annotation on the last assistant message (e.g., as part of a metadata
map or inferred from the response structure at persistence time).

### General QA Flow

When `workflow === 'GENERAL_QA'`:

1. `KnowledgeContextBuilder.build(context)` runs a knowledge search
2. If `knowledgeContext.hasDirectAnswer` is set, return it immediately — no AI call
3. Otherwise, build prompt via `GeneralQaPromptStrategy` and call AI
4. No diagnosis record created; conversation stays ACTIVE

### Error Handling

| Scenario | Behavior |
|---|---|
| Empty message | ValidationError |
| Conversation not found | NotFoundError |
| Knowledge engine failure | Log and continue without knowledge context (non-fatal) |
| AI inference fails | AIServiceError |
| UNKNOWN intent + low confidence | Route to ASK_CLARIFICATION |

### Logging

```typescript
{
  conversationId: string,
  intent: ConversationIntent,
  confidence: number,
  matchedRules: RuleName[],
  workflow: Workflow,
  nextAction: NextAction,
  decisionDurationMs: number,
  knowledgeLatencyMs: number,
  workflowDurationMs: number,
  provider: string,
}
```

## Out of Scope

- Modifications to Gemma provider, streaming pipeline, knowledge engine, Mongo models,
  prompt templates (existing), frontend, or diagnosis algorithms
- The orchestrator only adds new code and makes minimal modifications to controllers
  to redirect calls to `orchestrator.execute()`

## New Files

```
services/conversation/
  ConversationOrchestrator.ts
  ConversationContextLoader.ts
  ConversationStateResolver.ts
  KnowledgeContextBuilder.ts
  IntentClassifier.ts
  ConversationDecisionBuilder.ts
  WorkflowRouter.ts
  PromptStrategy.ts
  MessageBuilder.ts
  types.ts
```

## Modified Files

- `controllers/diagnose.controller.ts` — call `orchestrator.execute()` instead of directly calling diagnose service
- `services/diagnose.service.ts` — add `processFollowUp()` method
- `services/chat.service.ts` — wire up General QA workflow (currently a shell)
