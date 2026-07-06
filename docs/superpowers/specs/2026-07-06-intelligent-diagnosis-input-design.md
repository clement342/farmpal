# Intelligent Natural-Language Diagnosis Input

**Date**: 2026-07-06
**Author**: Senior Full-Stack AI Engineer
**Status**: Approved — ready for implementation
**Branch**: `feat/intelligent-diagnosis-input`

---

## 1. Objective

Replace the mandatory crop dropdown on the diagnosis page with a flexible dual-workflow experience: users can either describe their problem freely (letting the system infer the crop) or manually select a crop as an optional accuracy aid.

---

## 2. Architecture Overview

```
User types symptoms (no crop selected)
  → Crop Inference Service (knowledge-engine-based)
    ├── High confidence → auto-detect crop → emit `crop_detected` SSE event → normal streaming diagnosis
    └── Low/No confidence → symptoms sent to AI without crop context → AI uses existing `follow_up` to ask for crop
```

No extra AI calls. No new round trips. The knowledge engine's alias/name matching handles auto-detection; the AI's built-in clarification loop handles uncertainty.

---

## 3. Frontend Changes

### 3.1 ChatContainer (`components/chat/ChatContainer.tsx`)

- CropSelector becomes optional (no longer blocks the chat input)
- The input (`ChatComposer`) is **always enabled** — no `!selectedCrop` guard
- Show a **"Detected Crop"** badge when the backend emits a `crop_detected` SSE event
- Empty state text updated: no longer says "Select a crop to start"

### 3.2 ChatComposer (`components/chat/ChatComposer.tsx`)

- Placeholder changed to multiline example: `"Describe what you're seeing. Example: \"My maize leaves have yellow streaks and brown spots.\""`
- No longer disabled when crop is unselected

### 3.3 CropSelector (`components/chat/CropSelector.tsx`)

- Visual label: **"Optional — Select Crop (recommended)"**
- Helper text below: *"Selecting a crop may improve diagnosis accuracy"*
- Dropdown remains functionally identical

### 3.4 DetectedCropBadge (new component: `components/chat/DetectedCropBadge.tsx`)

- Shows when a crop was auto-detected from symptoms
- Displays: `Detected: Cassava  •  High confidence`
- Green/accent badge, appears above messages, non-intrusive
- Disappears if user manually selects a different crop

### 3.5 SSE Protocol — New Event

```typescript
interface StreamCropDetected {
  type: 'crop_detected';
  cropId: string;
  cropName: string;
  confidence: 'high' | 'medium' | 'low';
}
```

Emitted **once** at the start of the stream when the knowledge engine auto-detects a crop. Frontend stores this in `useDiagnosisChat` state and passes it to `DetectedCropBadge`.

### 3.6 useStreaming (`hooks/useStreaming.ts`)

- Add `onCropDetected` callback to `UseStreamingOptions`
- Handle the `crop_detected` event type in the SSE parser

### 3.7 useDiagnosisChat (`hooks/useDiagnosisChat.ts`)

- New state: `detectedCrop: { cropId, cropName, confidence } | null`
- `sendMessage` no longer guards on `selectedCrop` — allows sending without manual crop selection
- Pass `cropId: detectedCrop?.cropId ?? undefined` in the API request body (crop may come from auto-detection)

### 3.8 EmptyState (`components/chat/EmptyState.tsx`)

- `hasCrop` check still works but defaults to a generic prompt:
  *"Describe what you're seeing — yellowing leaves, spots, stunted growth. FarmPal will identify the crop and diagnose the problem."*

---

## 4. Backend Changes

### 4.1 Crop Inference Service (NEW: `services/crop-inference.service.ts`)

```typescript
interface CropInferenceResult {
  detected: boolean;
  crop?: KnowledgeCrop;
  confidence: 'high' | 'medium' | 'low';
  candidates: Array<{ crop: KnowledgeCrop; score: number }>;
}

function inferCrop(symptoms: string): CropInferenceResult
```

**Scoring logic** (synchronous, no DB/AI calls):

| Match type | Score | Example |
|---|---|---|
| Exact name match in text | 3 | `"cassava"` in "my cassava leaves" |
| Alias match in text | 2 | `"yuca"` matches cassava |
| Partial / substring match | 1 | `"cass"` → cassava |
| Description keyword match | 0.5 | `"staple crop"` matches cassava, yam, cocoyam |

- **Threshold**: score >= 2 → auto-select (`confidence: 'high'`)
- Multiple crops with score >= 2 → `confidence: 'medium'`, return top 3 candidates
- All scores < 2 → `confidence: 'low'`, return top 3 candidates
- Zero matches → `detected: false`

### 4.2 DiagnosisRequest (`types/diagnosis.ts`)

```typescript
export interface DiagnosisRequest {
  symptoms: string;
  /** Optional — omit to let the system infer the crop */
  cropId?: string;
  conversationId?: string;
  imageUrls?: string[];
  context?: Record<string, string>;
}
```

### 4.3 Validation (`lib/validation/diagnose.ts`)

- Remove `!request.cropId` required check
- `validateCropExists()` only called when `cropId` is present
- If `cropId` is omitted and no crop was auto-detected, validation passes without error

### 4.4 Controller (`controllers/diagnose.controller.ts`)

```typescript
// New flow when body.cropId is missing:
if (!body.cropId) {
  const inference = inferCrop(body.symptoms);
  if (inference.confidence === 'high') {
    body.cropId = inference.crop!.id;
    // crop_detected SSE event emitted by the service
  }
  // If no high-confidence match, leave cropId undefined — AI handles it
}
```

### 4.5 Diagnosis Service (`services/diagnose.service.ts`)

- `createConversation` / `appendMessage` accept `cropId: undefined` (store as `null` in MongoDB)
- `buildKnowledgeContext(undefined, symptoms)` already works — returns symptom-matched results without crop-specific disease list
- When `crop_detected` event is needed, the stream adapter emits it before the first `chunk` event

### 4.6 Stream Route (`app/api/diagnose/stream/route.ts`)

- Returns `crop_detected` SSE event before `chunk` events when crop is auto-detected
- The stream wraps controller logic, so the crop inference runs in the controller before the stream starts

### 4.7 AI Adapter (`adapters/diagnosis/DiagnosisAIAdapter.ts`)

- When crop is undefined: knowledge context includes only symptom-matched results (no crop-filtered disease list), which is the current behavior
- Extend prompt context with detected crop info when available:
  ```
  The user mentioned symptoms consistent with {cropName} (confidence: {level}).
  ```
- No changes to the AI provider abstraction — only the extra context string changes

### 4.8 Prompt (`lib/ai/prompts.ts`)

- No system prompt changes needed for crop inference (the AI already asks clarifying questions via `follow_up`)
- When a crop was detected by the engine, add detected crop context to `extraContext`
- The AI uses this context naturally — it doesn't need explicit crop-inference instructions

---

## 5. Data Flow Diagrams

### Flow A: Crop auto-detected (Knowledge Engine match)

```
User: "My cassava leaves are turning yellow."

  → inferCrop("my cassava leaves are turning yellow")
    → "cassava" found (exact match, score=3)
    → confidence: 'high'

  → emit SSE: crop_detected { cropId: "cassava", cropName: "Cassava", confidence: "high" }

  → Conversation created with cropId: "cassava"
  → diagnose.service.streamDiagnosis({ symptoms, cropId: "cassava" })
    → knowledgeService.buildContext("cassava", symptoms)
    → AI streams diagnosis
    → DiagnosisSummary renders with "Cassava" in the header
```

### Flow B: No crop detected / low confidence

```
User: "The leaves are curling and turning brown"

  → inferCrop("the leaves are curling and turning brown")
    → No crop name/alias found
    → candidates: [maize: 0.5, tomato: 0.5, cassava: 0.5] (via description keywords)
    → detected: false

  → No crop_detected event
  → Conversation created with cropId: null
  → diagnose.service.streamDiagnosis({ symptoms, cropId: undefined })
    → knowledgeService.buildContext(undefined, symptoms) → symptom-matched results only
    → AI responds:
      {
        "status": "follow_up",
        "question": "Which crop are you seeing this on?",
        "options": ["Maize", "Tomato", "Cassava"]
      }
    → User selects "Tomato"
    → Next turn: cropId: "tomato", conversation continues with crop context
```

### Flow C: User manually selects crop

```
User selects "Maize" from dropdown → types "yellow streaks on leaves"

  → inferCrop skipped (cropId provided by user)
  → emit SSE: crop_detected { cropId: "maize", cropName: "Maize", confidence: "high" }
  → Normal streaming diagnosis with full maize knowledge context
```

---

## 6. Files Changed / Created

| File | Change |
|---|---|
| `types/diagnosis.ts` | `cropId` optional |
| `lib/validation/diagnose.ts` | Remove required cropId check |
| `services/crop-inference.service.ts` | **NEW** — crop inference logic |
| `services/knowledge.service.ts` | Add `inferCrop(symptoms)` method |
| `controllers/diagnose.controller.ts` | Run inference when cropId missing |
| `services/diagnose.service.ts` | Handle undefined cropId |
| `adapters/diagnosis/DiagnosisAIAdapter.ts` | Inject detected crop context |
| `lib/api/diagnose.ts` | Add `StreamCropDetected` type |
| `hooks/useStreaming.ts` | Handle `crop_detected` event |
| `hooks/useDiagnosisChat.ts` | No crop guard, detectedCrop state |
| `components/chat/ChatContainer.tsx` | Optional selector, detected badge |
| `components/chat/ChatComposer.tsx` | New placeholder, always enabled |
| `components/chat/CropSelector.tsx` | "Optional" label + helper text |
| `components/chat/DetectedCropBadge.tsx` | **NEW** — detected crop badge |
| `components/chat/EmptyState.tsx` | Generic prompt text |

---

## 7. Out of Scope

- Landing page changes
- Streaming architecture changes
- AI provider implementations
- Removing the crop dropdown
- Unrelated backend modules
- Chat service (remains placeholder)

---

## 8. Testing Strategy

- Unit test `CropInferenceService.inferCrop()` with each match type (exact, alias, partial, none, multiple)
- Unit test scoring thresholds and edge cases (single char input, misspellings)
- Integration test: POST `/api/diagnose/stream` without `cropId` → verify SSE stream starts with `crop_dedetected` for known crops
- Integration test: POST `/api/diagnose/stream` without `cropId` for ambiguous input → verify AI returns `follow_up`
- E2E test: full flow — user types "yellow cassava leaves" → crop detected → diagnosis received
- Regression test: existing flow with `cropId` still works identically
