# Intelligent Diagnosis Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the crop selector optional so users can describe symptoms naturally while the system intelligently infers the crop.

**Architecture:** A synchronous `CropInferenceService` searches the knowledge base's crop names/aliases in the symptoms text. When a match is found (score >= 2), the crop is auto-selected and a new `crop_detected` SSE event is emitted before the streaming diagnosis begins. When no match is found, the AI's existing `follow_up` mechanism asks the user to clarify which crop.

**Tech Stack:** TypeScript, Next.js, Offline Knowledge Engine, SSE streaming

---

### Task 1: Make `cropId` optional in types + add SSE event type

**Files:**
- Modify: `types/diagnosis.ts:82-93`
- Modify: `lib/api/diagnose.ts:1-23`

- [ ] **Step 1: Make cropId optional in DiagnosisRequest**

```typescript
// types/diagnosis.ts — change cropId from required to optional
export interface DiagnosisRequest {
  /** Symptoms described by the farmer */
  symptoms: string;
  /** The affected crop (optional — omit to let the system infer from symptoms) */
  cropId?: string;
  /** Resume an existing conversation (optional — creates new if omitted) */
  conversationId?: string;
  /** Optional image URLs for visual analysis */
  imageUrls?: string[];
  /** Additional context provided by the farmer */
  context?: Record<string, string>;
}
```

- [ ] **Step 2: Add StreamCropDetected event type to lib/api/diagnose.ts**

```typescript
// lib/api/diagnose.ts — add after StreamError interface

export interface StreamCropDetected {
  type: 'crop_detected';
  cropId: string;
  cropName: string;
  confidence: 'high' | 'medium' | 'low';
}

// Update StreamEvent union:
export type StreamEvent = StreamChunk | StreamResult | StreamError | StreamCropDetected;
```

- [ ] **Step 3: Commit**

```bash
git add types/diagnosis.ts lib/api/diagnose.ts
git commit -m "feat: make cropId optional, add crop_detected SSE event type"
```

---

### Task 2: Crop Inference Service

**Files:**
- Create: `services/crop-inference.service.ts`

- [ ] **Step 1: Create the crop inference service**

```typescript
/**
 * Crop Inference Service
 *
 * Synchronously infers the crop from symptom text by searching
 * the offline knowledge base's crop names and aliases. No AI
 * calls, no database queries.
 *
 * Scoring:
 *   3 — exact crop name found in symptom text
 *   2 — alias found in symptom text
 *   1 — partial/substring match
 *
 * Threshold: score >= 2 and unique top = auto-detect (high confidence)
 *            score >= 2 but tied = medium confidence
 *            score < 2 = not detected
 *
 * @module
 */

import type { KnowledgeCrop } from '@/types/knowledge';

export interface ScoredCandidate {
  crop: KnowledgeCrop;
  score: number;
}

export interface CropInferenceResult {
  /** Whether a crop was confidently detected */
  detected: boolean;
  /** The detected crop (undefined when not detected) */
  crop?: KnowledgeCrop;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Top candidates ranked by score */
  candidates: ScoredCandidate[];
}

/**
 * Infers the most likely crop from symptom text.
 *
 * @param symptoms - The user's symptom description.
 * @param crops    - All crops from the knowledge base.
 * @returns The inference result with detected crop and confidence.
 */
export function inferCropFromSymptoms(
  symptoms: string,
  crops: KnowledgeCrop[],
): CropInferenceResult {
  const lower = symptoms.toLowerCase().trim();
  if (!lower) {
    return { detected: false, confidence: 'low', candidates: [] };
  }

  const scored: ScoredCandidate[] = [];

  for (const crop of crops) {
    let score = 0;

    // 3 — exact crop name found in text
    if (lower.includes(crop.name.toLowerCase())) {
      score = 3;
    }

    // 2 — alias found in text (only if not already matched by name)
    if (score < 3 && crop.aliases.some((a) => lower.includes(a.toLowerCase()))) {
      score = 2;
    }

    // 1 — partial/substring match via first 4 chars of any alias
    if (score < 2) {
      const hasPartial = crop.aliases.some((a) => {
        const aliasLower = a.toLowerCase();
        const minLen = Math.min(4, aliasLower.length);
        return aliasLower.substring(0, minLen).length >= 4 &&
          lower.includes(aliasLower.substring(0, minLen));
      });
      if (hasPartial) {
        score = 1;
      }
    }

    if (score > 0) {
      scored.push({ crop, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 3);

  if (candidates.length === 0) {
    return { detected: false, confidence: 'low', candidates: [] };
  }

  const topScore = candidates[0].score;
  const isUniqueTop = candidates.length === 1 || candidates[0].score > candidates[1].score;

  if (topScore >= 2 && isUniqueTop) {
    return {
      detected: true,
      crop: candidates[0].crop,
      confidence: 'high',
      candidates,
    };
  }

  if (topScore >= 2) {
    return {
      detected: true,
      crop: candidates[0].crop,
      confidence: 'medium',
      candidates,
    };
  }

  return { detected: false, confidence: 'low', candidates };
}
```

- [ ] **Step 2: Commit**

```bash
git add services/crop-inference.service.ts
git commit -m "feat: add CropInferenceService for knowledge-engine-based crop detection"
```

---

### Task 3: Validation — Remove required cropId check

**Files:**
- Modify: `lib/validation/diagnose.ts:30-32`

- [ ] **Step 1: Remove the cropId-required validation**

Remove lines 30-32 (`if (!request.cropId || request.cropId.trim().length === 0)` block).

Replace the function so it only validates cropId when one is provided:

```typescript
/**
 * Validates a diagnosis request payload.
 *
 * @param data - The incoming request body
 * @returns The validated payload
 * @throws ValidationError if validation fails
 */
export function validateDiagnosisRequest(data: unknown): DiagnosisRequest {
  const request = data as DiagnosisRequest | null;

  if (!request) {
    throw new ValidationError('Request body is required');
  }

  if (!request.symptoms || request.symptoms.trim().length === 0) {
    throw new ValidationError('Symptoms description is required');
  }

  if (request.symptoms.trim().length > 2000) {
    throw new ValidationError('Symptoms description must not exceed 2000 characters');
  }

  // cropId is optional — only validate format if provided
  if (request.cropId && typeof request.cropId !== 'string') {
    throw new ValidationError('Crop ID must be a string');
  }

  // Validate image URLs if provided
  if (request.imageUrls) {
    if (!Array.isArray(request.imageUrls)) {
      throw new ValidationError('Image URLs must be an array');
    }
    for (const url of request.imageUrls) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        throw new ValidationError('Each image URL must be a valid HTTP URL');
      }
    }
  }

  return request;
}
```

Also update `validateCropExists` to accept an optional cropId:

```typescript
/**
 * Validates that the cropId corresponds to an existing crop (if provided).
 *
 * @param cropId - The crop identifier to verify (optional)
 * @throws ValidationError if cropId is provided but does not exist
 */
export async function validateCropExists(cropId?: string): Promise<void> {
  if (!cropId) return;

  const dbCrop = await cropRepository.findById(cropId);
  if (dbCrop) return;

  const kbCrop = knowledgeService.getCrop(cropId);
  if (kbCrop) return;

  throw new ValidationError(`Crop with ID "${cropId}" not found`);
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/validation/diagnose.ts
git commit -m "feat: make cropId optional in validation"
```

---

### Task 4: Knowledge Service — Add inferCrop method

**Files:**
- Modify: `services/knowledge.service.ts`

- [ ] **Step 1: Add inferCrop method to KnowledgeService**

Import the inference function:

```typescript
import { inferCropFromSymptoms } from './crop-inference.service';
import type { CropInferenceResult } from './crop-inference.service';
```

Add the method to the `KnowledgeService` class (before `buildContext`):

```typescript
/**
 * Infers the most likely crop from symptom text.
 *
 * @param symptoms - The user's symptom description.
 * @returns Inference result with detected crop and confidence.
 */
inferCrop(symptoms: string): CropInferenceResult {
  return inferCropFromSymptoms(symptoms, this.getAllCrops());
}
```

- [ ] **Step 2: Commit**

```bash
git add services/knowledge.service.ts
git commit -m "feat: add inferCrop method to KnowledgeService"
```

---

### Task 5: Controller — Run inference when cropId missing

**Files:**
- Modify: `controllers/diagnose.controller.ts`

- [ ] **Step 1: Update handleDiagnosisRequest and handleStreamDiagnosis**

```typescript
import type { DiagnosisRequest, ConversationDiagnosisResponse } from '@/types';
import { createDiagnosis, streamDiagnosis } from '@/services/diagnose.service';
import { validateDiagnosisRequest, validateCropExists } from '@/lib/validation';
import { knowledgeService } from '@/services/knowledge.service';

/**
 * Initiates or continues a crop disease diagnosis (non-streaming).
 */
export async function handleDiagnosisRequest(
  body: unknown,
): Promise<ConversationDiagnosisResponse> {
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  // Infer crop if not explicitly provided
  if (!request.cropId) {
    const inference = knowledgeService.inferCrop(request.symptoms);
    if (inference.detected && inference.crop) {
      request.cropId = inference.crop.id;
    }
  }

  if (request.cropId) {
    await validateCropExists(request.cropId);
  }

  return createDiagnosis(request);
}

/**
 * Initiates or continues a crop disease diagnosis with streaming.
 */
export async function handleStreamDiagnosis(
  body: unknown,
): Promise<ReadableStream<Uint8Array>> {
  const request: DiagnosisRequest = validateDiagnosisRequest(body);

  let detectedCropInfo: { cropId: string; cropName: string; confidence: string } | undefined;

  // Infer crop if not explicitly provided
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

  // If crop was auto-detected, prepend a crop_detected event to the stream
  if (detectedCropInfo) {
    return prependCropDetectedEvent(stream, detectedCropInfo);
  }

  return stream;
}

/**
 * Wraps a ReadableStream to emit a crop_detected SSE event before the first chunk.
 */
function prependCropDetectedEvent(
  original: ReadableStream<Uint8Array>,
  info: { cropId: string; cropName: string; confidence: string },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let headerSent = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const event = `data: ${JSON.stringify({ type: 'crop_detected', ...info })}\n\n`;
      controller.enqueue(encoder.encode(event));
      headerSent = true;

      const reader = original.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.close();
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add controllers/diagnose.controller.ts
git commit -m "feat: run crop inference in controller when cropId is missing"
```

---

### Task 6: Diagnosis Service — Handle undefined cropId

**Files:**
- Modify: `services/diagnose.service.ts`

- [ ] **Step 1: Handle undefined cropId in createDiagnosis and streamDiagnosis**

In both `createDiagnosis` and `streamDiagnosis`, the first line does `cropRepository.findById(request.cropId)`. When `cropId` is undefined, this will be `findById(undefined)`. Update to handle undefined gracefully.

Change the crop resolution pattern:

```typescript
// Replace: const crop = await cropRepository.findById(request.cropId);
// With:
const crop = request.cropId ? await cropRepository.findById(request.cropId) : null;
```

Update conversation creation to use `null` when no cropId:

```typescript
// In createDiagnosis and streamDiagnosis:
// Replace: cropId: request.cropId, cropName: crop?.name,
// With:
const created = await conversationRepository.createConversation({
  messages: [],
  cropId: request.cropId ?? null,
  cropName: crop?.name ?? null,
});
```

Update diagnosis data to use `'Unknown'` when crop is not available:

```typescript
// Already has: cropName: crop?.name ?? 'Unknown',
// Already has: cropId: request.cropId, — this can be undefined now
```

The string `'Unknown'` is already the fallback for cropName — no change needed there. The `cropId` field on `CreateDiagnosisData` is a string, so we need to handle undefined on the repository side. Let's just pass an empty string or null.

Actually, looking at the existing code:

```typescript
cropName: crop?.name ?? 'Unknown',
cropId: request.cropId,
```

The `cropId` in `CreateDiagnosisData` is typed as `string`. Since it's now optional, we should pass `request.cropId ?? ''`. But this is in the `diagnosis` branch (when a final diagnosis is reached), meaning the AI has already identified the crop, so `cropId` should be available. If it's not, let's use an empty string.

Actually, looking at the flow: if cropId is not provided but the AI infers it from the follow_up flow, by the time a diagnosis is reached, the user would have specified a crop in a follow-up turn. So cropId should always be available by the time of diagnosis. But to be safe:

In both streaming and non-streaming `diagnosis` blocks:

```typescript
cropId: request.cropId ?? '',
```

- [ ] **Step 2: Commit**

```bash
git add services/diagnose.service.ts
git commit -m "feat: handle undefined cropId in diagnosis service"
```

---

### Task 7: AI Adapter — Inject detected crop context

**Files:**
- Modify: `adapters/diagnosis/DiagnosisAIAdapter.ts`

- [ ] **Step 1: Add detected crop context to the prompt when crop was inferred**

In `buildRequestMessages`, the adapter already receives `crop?: Crop`. When crop is provided (either manually or auto-detected), it adds crop context. When crop is undefined, no crop info is added — the AI only receives symptom keyword matches.

Currently the code at lines 135-140:

```typescript
if (crop) {
  const regionStr = crop.regions?.length
    ? `, Region: ${crop.regions.join(', ')}`
    : '';
  parts.push(`Crop: ${crop.name}${regionStr}`);
}
```

This is already correct. When crop is undefined (no manual selection, no auto-detection), the AI gets no crop context and uses its `follow_up` mechanism naturally.

No changes needed to this file. Mark as complete.

- [ ] **Step 2: Commit (empty — no changes)**

---

### Task 8: useStreaming — Handle crop_detected event

**Files:**
- Modify: `hooks/useStreaming.ts`

- [ ] **Step 1: Add onCropDetected callback**

```typescript
// Update UseStreamingOptions interface
interface UseStreamingOptions {
  onChunk?: (text: string) => void;
  onResult?: (event: StreamEvent & { type: 'result' }) => void;
  onError?: (message: string) => void;
  onCropDetected?: (info: { cropId: string; cropName: string; confidence: string }) => void;
}
```

- [ ] **Step 2: Handle the crop_detected event in the start callback**

In the `for await` loop, add a case for `crop_detected`:

```typescript
for await (const event of streamDiagnosis(body, controller.signal)) {
  if (controller.signal.aborted) break;

  switch (event.type) {
    case 'crop_detected':
      options.onCropDetected?.({
        cropId: event.cropId,
        cropName: event.cropName,
        confidence: event.confidence,
      });
      break;
    case 'chunk':
      options.onChunk?.(event.text);
      break;
    case 'result':
      options.onResult?.(event);
      break;
    case 'error':
      setError(event.message);
      options.onError?.(event.message);
      break;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useStreaming.ts
git commit -m "feat: handle crop_detected SSE event in useStreaming"
```

---

### Task 9: useDiagnosisChat — Remove crop guard, add detectedCrop state

**Files:**
- Modify: `hooks/useDiagnosisChat.ts`

- [ ] **Step 1: Add detectedCrop state and update sendMessage**

```typescript
// In the hook body, add:
const [detectedCrop, setDetectedCrop] = useState<{
  cropId: string;
  cropName: string;
  confidence: string;
} | null>(null);
```

Update the `useStreaming` options to pass `onCropDetected`:

```typescript
const { isStreaming, start: startStream, cancel } = useStreaming({
  onChunk: handleChunk,
  onResult: handleResult,
  onError: handleError,
  onCropDetected: (info) => setDetectedCrop(info),
});
```

Update `sendMessage` to remove the crop guard and pass detected crop (if any) or undefined:

```typescript
const sendMessage = useCallback(
  async (symptoms: string) => {
    // Remove: if (!selectedCrop) return;

    const userMsg: ChatMessageDisplay = {
      id: generateId(),
      role: 'user',
      content: symptoms,
      createdAt: new Date().toISOString(),
    };

    const assistantMsg: ChatMessageDisplay = {
      id: generateId(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStatus('streaming');
    setError(null);

    try {
      await startStream({
        symptoms,
        cropId: selectedCrop?.id ?? detectedCrop?.cropId ?? undefined,
        conversationId: conversationId ?? undefined,
      });
    } catch {
      // Error is handled in useStreaming's onError
    }
  },
  [selectedCrop, detectedCrop, conversationId, startStream],
);
```

Update the `UseDiagnosisChatReturn` interface:

```typescript
interface UseDiagnosisChatReturn {
  messages: ChatMessageDisplay[];
  status: ChatStatus;
  error: string | null;
  selectedCrop: Crop | null;
  detectedCrop: { cropId: string; cropName: string; confidence: string } | null;
  conversationId: string | null;
  setCrop: (crop: Crop | null) => void;
  sendMessage: (symptoms: string) => Promise<void>;
  reset: () => void;
  cancelStream: () => void;
}
```

Update the return object to include `detectedCrop`:

```typescript
return {
  messages,
  status: isStreaming ? 'streaming' : status,
  error,
  selectedCrop,
  detectedCrop,
  conversationId,
  setCrop: setSelectedCrop,
  sendMessage,
  reset,
  cancelStream: cancel,
};
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useDiagnosisChat.ts
git commit -m "feat: add detectedCrop state, remove crop guard from sendMessage"
```

---

### Task 10: DetectedCropBadge component

**Files:**
- Create: `components/chat/DetectedCropBadge.tsx`

- [ ] **Step 1: Create the DetectedCropBadge component**

```tsx
'use client';

interface DetectedCropBadgeProps {
  cropName: string;
  confidence: string;
}

const confidenceColors: Record<string, string> = {
  high: 'bg-accent-subtle text-accent-text border-accent/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const confidenceLabels: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function DetectedCropBadge({ cropName, confidence }: DetectedCropBadgeProps) {
  const color = confidenceColors[confidence] || confidenceColors.high;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${color}`}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M12 2a4 4 0 0 0-4 4v4h-2a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4h-2V6a4 4 0 0 0-4-4z" />
      </svg>
      <span>
        Detected: <strong>{cropName}</strong>
      </span>
      <span className="opacity-60">·</span>
      <span className="opacity-80">{confidenceLabels[confidence] || confidence} confidence</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/DetectedCropBadge.tsx
git commit -m "feat: add DetectedCropBadge component"
```

---

### Task 11: CropSelector — Add "Optional" label + helper text

**Files:**
- Modify: `components/chat/CropSelector.tsx`

- [ ] **Step 1: Add "Optional" label and helper text**

Replace the default "Select crop" display with "Optional — Select Crop (recommended)":

```tsx
// Change the else branch of selected check (line 65)
<span>Optional — Select crop</span>

// Also add helper text below the dropdown when it's open.
// After line 100 (closing </div> of the dropdown), add:
{cropHelper && (
  <p className="text-xs text-text-muted mt-1.5 px-0.5">
    Selecting a crop may improve diagnosis accuracy
  </p>
)}
```

For the helper text, we need to track whether to show it. Add state:

```typescript
const [showHelper, setShowHelper] = useState(true);
```

And in the crop selection handler:

```typescript
onSelect(crop);
setOpen(false);
setShowHelper(false);
```

Show the helper text below the dropdown button when `showHelper && !selected`:

```tsx
// After the dropdown button (closing </button>) and before the dropdown menu:
<div className="flex flex-col">
  <button ... /> {/* existing button */}
  {showHelper && !selected && (
    <p className="text-xs text-text-muted mt-1 pl-0.5">
      Selecting a crop may improve diagnosis accuracy
    </p>
  )}
  {open && ( /* existing dropdown menu */ )}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/CropSelector.tsx
git commit -m "feat: add optional label and helper text to CropSelector"
```

---

### Task 12: ChatComposer — New placeholder, remove crop guard

**Files:**
- Modify: `components/chat/ChatComposer.tsx`

- [ ] **Step 1: Simplify placeholder and remove disabled dependency on crop**

No changes to `ChatComposer` itself — it already accepts `placeholder` as a prop and `disabled` doesn't depend on crop choice.

- [ ] **Step 2: Commit (empty — changes will be in ChatContainer)**

---

### Task 13: EmptyState — Update generic prompt text

**Files:**
- Modify: `components/chat/EmptyState.tsx`

- [ ] **Step 1: Remove crop-dependent prompt, use generic text**

```tsx
export function EmptyState({ hasCrop }: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-accent-subtle border border-accent/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-text">
            <path d="M12 2a4 4 0 0 0-4 4v4h-2a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4h-2V6a4 4 0 0 0-4-4z" />
            <path d="M12 14v4" />
            <path d="M10 16h4" />
          </svg>
        </div>

        <h2 className="text-lg font-medium text-text-primary mb-2">
          Describe your crop problem
        </h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Tell FarmPal what you're seeing — yellowing leaves, spots, stunted growth, or pests. 
          The system will identify the crop and diagnose the problem.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/EmptyState.tsx
git commit -m "feat: update EmptyState with generic prompt text"
```

---

### Task 14: ChatContainer — Integrate everything

**Files:**
- Modify: `components/chat/ChatContainer.tsx`

- [ ] **Step 1: Update ChatContainer with new flow**

```tsx
'use client';

import { useState } from 'react';
import type { Crop } from '@/types/crop';
import { useDiagnosisChat } from '@/hooks/useDiagnosisChat';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatComposer } from './ChatComposer';
import { ChatSidebar } from './ChatSidebar';
import { CropSelector } from './CropSelector';
import { DetectedCropBadge } from './DetectedCropBadge';

interface ChatContainerProps {
  conversationId?: string;
  crop?: Crop;
}

export function ChatContainer({ conversationId, crop }: ChatContainerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    messages,
    status,
    error,
    selectedCrop,
    detectedCrop,
    conversationId: activeConversationId,
    setCrop,
    sendMessage,
    reset,
  } = useDiagnosisChat({ conversationId: conversationId ?? null, crop });

  const isStreaming = status === 'streaming';
  // Remove: const isDisabled = isStreaming || !selectedCrop;
  const isDisabled = isStreaming;

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        activeConversationId={activeConversationId}
        onNewChat={reset}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Open sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1 flex items-center justify-between min-w-0">
            <CropSelector selected={selectedCrop} onSelect={setCrop} />
            {conversationId && (
              <button
                onClick={reset}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Chat header (desktop) */}
        <div className="hidden md:block">
          <div className="flex items-center justify-between px-4 sm:px-8 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <CropSelector selected={selectedCrop} onSelect={setCrop} />
            </div>
            {conversationId && (
              <button
                onClick={reset}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                New chat
              </button>
            )}
          </div>
        </div>

        {/* Detected crop badge */}
        {detectedCrop && !selectedCrop && (
          <div className="px-4 sm:px-8 pt-3 pb-1">
            <DetectedCropBadge
              cropName={detectedCrop.cropName}
              confidence={detectedCrop.confidence}
            />
          </div>
        )}

        <ChatHeader
          crop={selectedCrop}
          isStreaming={isStreaming}
          messageCount={messages.length}
        />

        <ChatMessages
          messages={messages}
          hasCrop={!!selectedCrop || !!detectedCrop}
        />

        {/* Error banner */}
        {error && (
          <div className="mx-4 sm:mx-8 mb-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        <ChatComposer
          onSend={sendMessage}
          disabled={isDisabled}
          loading={isStreaming}
          placeholder="Describe what you're seeing. Example: &quot;My maize leaves have yellow streaks and brown spots.&quot;"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/ChatContainer.tsx
git commit -m "feat: integrate optional crop flow, detected crop badge, updated placeholder"
```

---

### Task 15: Push and create PR

**Files:**
- N/A

- [ ] **Step 1: Push branch and create PR**

```bash
git push -u origin feat/intelligent-diagnosis-input
gh pr create \
  --base feat/offline-dataset-expansion \
  --head feat/intelligent-diagnosis-input \
  --title "Intelligent Diagnosis Input — Optional Crop, Auto-Detection" \
  --body "## Summary

Makes the crop selector optional. Users can describe symptoms naturally and the system infers the crop from the knowledge base's names/aliases. Adds a new \`crop_detected\` SSE event to communicate auto-detected crops to the UI.

## Changes

- **Types**: \`cropId\` optional in \`DiagnosisRequest\`, new \`StreamCropDetected\` SSE event
- **CropInferenceService** (\`services/crop-inference.service.ts\`): Synchronous keyword-based crop detection from knowledge base
- **Validation**: \`cropId\` no longer required; \`validateCropExists\` accepts optional id
- **Controller**: Runs inference when \`cropId\` is missing, emits \`crop_detected\` SSE event
- **Diagnosis Service**: Handles \`undefined\` cropId gracefully
- **Frontend**: New \`DetectedCropBadge\` component, updated \`ChatContainer\`, \`EmptyState\`, \`CropSelector\`, \`useStreaming\`, \`useDiagnosisChat\`
- **Composer**: Always enabled, placeholder updated

## Flow

\`\`\`
User types \"my cassava leaves are yellow\"
  → CropInferenceService matches \"cassava\" (exact name, score=3)
  → SSE: crop_detected { cassava, high }
  → Streaming diagnosis with cassava context

User types \"leaves are curling\"
  → CropInferenceService: no match
  → AI receives no crop context
  → AI returns follow_up: \"Which crop?\""
```
