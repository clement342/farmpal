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
ConversationLoader         -- load conversation from DB, resolve crop
  |
  v
KnowledgeContextBuilder    -- gather relevant knowledge (lazy)
  |
  v
ConversationStateResolver  -- determine { status, stage }
  |
  v
IntentClassifier           -- rules -> knowledge (no AI fallback)
  |
  v
ConversationDecision {
  status, stage, intent,
  confidence, nextAction,
  matchedRules: RuleName[],
  reason
}
  |
  v
WorkflowRouter(nextAction) -- dumb dispatch
  |
  v
[ DIAGNOSIS | FOLLOW_UP | GENERAL_QA ]
  |         |               |
  v         v               v
PromptStrategy per workflow -- builds the right prompt
  |         |               |
  v         v               v
[ DiagnosisService | DiagnosisService.answerFollowUp | ChatService ]
  |
  v
Persist + Return
```

### Layers

```
Controller (thin: validate + call orchestrator)
  |
  v
services/conversation/   <-- NEW
  ConversationOrchestrator.ts
  ConversationLoader.ts
  KnowledgeContextBuilder.ts
  ConversationStateResolver.ts
  IntentClassifier.ts
  WorkflowRouter.ts
  PromptStrategy.ts
  types.ts
  |
  v
Existing services (diagnose.service, chat.service)
```

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
  fertilizers: KnowledgeFertilizer[];
  glossary: KnowledgeGlossaryEntry[];
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
  awaitingClarification: boolean;
}
```

### Components

#### 1. ConversationLoader

Loads conversation and crop from the database. Does NOT load diagnosis history
or knowledge unless requested by downstream.

```typescript
class ConversationLoader {
  async load(request: DiagnosisRequest): Promise<{
    conversation?: ConversationDocument;
    conversationId?: string;
    currentCrop?: Crop;
    status: ConversationStatus | null;
  }>;
}
```

#### 2. KnowledgeContextBuilder

Lazily gathers structured knowledge from the Knowledge Engine. Not a string —
preserves structured data for downstream prompt builders.

```typescript
class KnowledgeContextBuilder {
  async build(
    conversationId?: string,
    cropId?: string,
    symptoms?: string,
  ): Promise<KnowledgeContext | undefined>;
}
```

#### 3. ConversationStateResolver

Pure function (no DB calls). Takes conversation metadata and returns resolved
{ status, stage, awaitingClarification }.

```typescript
class ConversationStateResolver {
  resolve(params: {
    conversation?: ConversationDocument;
    conversationId?: string;
  }): {
    status: ConversationStatus | null;
    stage: ConversationStage;
    awaitingClarification: boolean;
  };
}
```

`awaitingClarification` is inferred at runtime — there is no DB field for it.
The resolver checks the last assistant message: if it ends with `?` and the
conversation is ACTIVE with no subsequent user message, the AI is awaiting
a response.

**Resolution rules:**
- No `conversationId` -> `{ status: null, stage: 'NEW', awaitingClarification: false }`
- Conversation `status: 'ACTIVE'`, last assistant message ends with `?` and no user response since -> `{ status: 'ACTIVE', stage: 'AWAITING_CLARIFICATION', awaitingClarification: true }`
- Conversation `status: 'ACTIVE'`, last response was a diagnosis -> `{ status: 'ACTIVE', stage: 'SHOWING_RESULT' }`
- Conversation `status: 'ACTIVE'`, multiple turns since last diagnosis -> `{ status: 'ACTIVE', stage: 'FOLLOW_UP' }`
- Conversation `status: 'COMPLETED'` -> `{ status: 'COMPLETED', stage: 'CLOSED' }`
- Conversation `status: 'ABANDONED'` -> `{ status: null, stage: 'NEW' }`

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
- The orchestrator maps this to `nextAction: 'ASK_CLARIFICATION'`

No AI classification call. The diagnosis prompt itself handles clarification when
the controller routes UNKNOWN to the DIAGNOSIS workflow with a clarification flag.

#### 5. WorkflowRouter

Pure mapping from `nextAction` to `workflow`. No stage/intent inspection.

```typescript
class WorkflowRouter {
  route(nextAction: NextAction): Workflow;
}
```

**Mapping:**
| nextAction | Workflow |
|---|---|
| `START_DIAGNOSIS` | DIAGNOSIS |
| `CONTINUE_DIAGNOSIS` | DIAGNOSIS |
| `ANSWER_FOLLOWUP` | FOLLOW_UP |
| `ANSWER_GENERAL_QA` | GENERAL_QA |
| `ASK_CLARIFICATION` | DIAGNOSIS |

The router is one line: `return MAP[nextAction]`.

#### 6. ConversationDecisionBuilder

Assembles the final `ConversationDecision` from context, state, classification,
and the routed workflow. This is where `nextAction` is determined.

```typescript
class ConversationDecisionBuilder {
  build(
    context: ConversationContext,
    state: StateResult,
    classification: IntentClassification,
  ): ConversationDecision;
}
```

**nextAction mapping logic:**
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

Each workflow builds its own prompt. Keeps prompt construction out of services.

```typescript
interface PromptStrategy {
  build(
    context: ConversationContext,
    decision: ConversationDecision,
  ): ChatMessage[];
}

class DiagnosisPromptStrategy implements PromptStrategy { ... }
class FollowUpPromptStrategy implements PromptStrategy { ... }
class GeneralQaPromptStrategy implements PromptStrategy { ... }
```

- `DiagnosisPromptStrategy` — existing diagnosis prompt (no change required)
- `FollowUpPromptStrategy` — injects existing diagnosis + recommendations + knowledge context; prompt asks AI to answer the specific question without re-diagnosing
- `GeneralQaPromptStrategy` — injects knowledge context only; prompt asks AI to answer from knowledge first, then its own capabilities

#### 8. ConversationOrchestrator

Coordinates the full pipeline. Entry point for controllers.

```typescript
class ConversationOrchestrator {
  async orchestrate(
    request: DiagnosisRequest,
  ): Promise<{
    decision: ConversationDecision;
    context: ConversationContext;
  }>;
}
```

Internal flow:
1. `ConversationLoader.load(request)` -> conversation, crop
2. `ConversationStateResolver.resolve(...)` -> status, stage, awaitingClarification
3. `KnowledgeContextBuilder.build(...)` -> structured knowledge (lazy, skipped if context isn't needed)
4. `IntentClassifier.classify(context)` -> intent classification
5. `ConversationDecisionBuilder.build(context, state, classification)` -> decision with nextAction
6. `WorkflowRouter.route(decision.nextAction)` -> workflow
7. Return `{ decision: { ...decision, workflow }, context }`

### Integration with Existing Flow

**Controller flow (updated):**
```
validate -> orchestrator.orchestrate(request) -> controller reads decision -> dispatch
```

| decision.workflow | decision.nextAction | Controller calls |
|---|---|---|
| DIAGNOSIS | START_DIAGNOSIS | `diagnose.service.streamDiagnosis()` |
| DIAGNOSIS | CONTINUE_DIAGNOSIS | `diagnose.service.streamDiagnosis()` |
| DIAGNOSIS | ASK_CLARIFICATION | `diagnose.service.streamDiagnosis()` (with clarification flag) |
| FOLLOW_UP | ANSWER_FOLLOWUP | `diagnose.service.answerFollowUp()` |
| GENERAL_QA | ANSWER_GENERAL_QA | `chat.service.processChatMessage()` |

The controller remains thin — validate, orchestrate, dispatch.

### Follow-Up Handling (`answerFollowUp`)

When `nextAction === 'ANSWER_FOLLOWUP'`:
- `DiagnosisService.answerFollowUp()` reuses the streaming infrastructure
- Uses `FollowUpPromptStrategy` to build the prompt
- AI answers only the specific question
- No new diagnosis record is created
- Conversation stays ACTIVE, message is appended

### Clarification Handling

When `nextAction === 'CONTINUE_DIAGNOSIS'`:
- Route to `DiagnosisService.streamDiagnosis()`
- `DiagnosisPromptStrategy` includes both original symptoms and the clarification
- Diagnosis is generated with enriched context

When `nextAction === 'ASK_CLARIFICATION'`:
- Route to `DiagnosisService.streamDiagnosis()` with a clarification flag
- The AI prompt asks "Can you clarify?" rather than generating a diagnosis
- Sets `conversation.awaitingClarification = true`

### General Agriculture Questions

When `nextAction === 'ANSWER_GENERAL_QA'`:
- `ChatService.processChatMessage()` uses `GeneralQaPromptStrategy`
- First consults `knowledgeService.search()` for direct answers
- Falls back to AI if knowledge engine has no match
- No diagnosis record created
- Conversation stays ACTIVE

### Runtime Cache (Optional, Not Source of Truth)

A lightweight in-memory cache keyed by `conversationId` may store:
- `lastWorkflow: Workflow`
- `lastIntent: ConversationIntent`

It is always rebuildable from persisted data. Never relied on for correctness.
Cleared on server restart. Not used in multi-instance deployments.

### Error Handling

| Scenario | Behavior |
|---|---|
| Empty message | Return ValidationError |
| Conversation not found | Return NotFoundError |
| UNKNOWN intent + low confidence | Route to DIAGNOSIS with ASK_CLARIFICATION |
| AI inference fails | Return AIServiceError |

### Logging

Structured logs at key pipeline stages:

```typescript
{
  conversationId: string,
  intent: ConversationIntent,
  confidence: number,
  matchedRules: RuleName[],
  workflow: Workflow,
  nextAction: NextAction,
  decisionDurationMs: number,
  workflowDurationMs: number,
  provider: string,
}
```

This enables queries like "average intent detection time" or "Gemma latency by workflow".

## Out of Scope

- Modifications to Gemma provider, streaming pipeline, knowledge engine, Mongo models,
  prompt templates (existing), frontend, or diagnosis algorithms
- The orchestrator only adds new code and makes minimal modifications to controllers

## New Files

```
services/conversation/
  ConversationOrchestrator.ts
  ConversationLoader.ts
  KnowledgeContextBuilder.ts
  ConversationStateResolver.ts
  IntentClassifier.ts
  ConversationDecisionBuilder.ts
  WorkflowRouter.ts
  PromptStrategy.ts
  types.ts
```

## Modified Files

- `controllers/diagnose.controller.ts` — call orchestrator instead of directly calling diagnose service
- `services/diagnose.service.ts` — add `answerFollowUp()` method
- `services/chat.service.ts` — wire up General QA workflow (currently a shell)
- `controllers/chat.controller.ts` — wire up to orchestrator for General QA routing
