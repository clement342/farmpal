# Knowledge Base

## Why Static JSON Instead of a Database

The knowledge base uses static JSON files bundled with the application rather than MongoDB for several reasons:

- **Offline-first**: Knowledge data must be available even when the user has no network connection. A database requires a running server and network access.
- **No latency**: Reading from an in-memory cache is instant. Every millisecond counts when the AI model is already waiting for its input.
- **Read-only data**: Agricultural knowledge (crop facts, disease symptoms, treatments) changes slowly — there is no need for CRUD operations or real-time updates.
- **No query complexity**: The data is small (< 1 MB), flat, and searched with simple keyword matching. A database would add infrastructure complexity for no benefit.
- **Portability**: The entire knowledge base is a directory of JSON files that can be version-controlled, reviewed in PRs, and deployed alongside the application code.

The only data stored in MongoDB is **user-specific** data: diagnosis conversations, user accounts, and crop configurations. The knowledge base is separate by design.

---

## How the Knowledge Loader Works

`lib/knowledge/knowledge-loader.ts` — `loadKnowledge()`

The loader reads every JSON file from the `knowledge/` directory at application startup:

```
knowledge/
  metadata.json         → version, lastUpdated, counts
  glossary.json         → array of glossary terms
  crops/*.json          → one file per crop (e.g. maize.json)
  diseases/<crop>/*.json → one file per disease, organized by crop subdirectory
  pests/*.json          → one file per pest
  deficiencies/*.json   → one file per deficiency
```

Key behaviour:

- **Diseases are organised in subdirectories** by crop (`diseases/maize/northern-leaf-blight.json`). The loader walks all subdirectories.
- **Fails fast**: If a JSON file is malformed, the application crashes at startup. Silent data corruption is worse than a failed deploy.
- **No network calls**: Everything is read synchronously with `fs.readFileSync`. This happens exactly once during the application lifecycle.
- **Silent fallback**: Missing directories return empty arrays (e.g. if `pests/` is absent, pests are empty). This keeps the app running during development when the knowledge base is incomplete.

---

## How the Knowledge Cache Works

`lib/knowledge/knowledge-cache.ts` — `getKnowledge()`

The cache is a **singleton** pattern:

```ts
let instance: KnowledgeBase | null = null;

export function getKnowledge(): KnowledgeBase {
  if (!instance) {
    instance = loadKnowledge();
  }
  return instance;
}
```

- **Loaded once**: The first call to `getKnowledge()` triggers `loadKnowledge()`. Every subsequent call returns the same in-memory object — zero filesystem I/O.
- **Never evicted**: The cache lives for the entire application lifecycle. Knowledge is static data, not a hot cache that needs TTL or invalidation.
- **`refreshKnowledge()`** forces a reload from disk. Used in development when JSON files change.
- **`resetKnowledgeCache()`** clears the singleton (used in tests to isolate test cases).
- **Thread-safe enough**: In Node.js single-threaded event loop, the singleton is safe. The first request to hit the server primes the cache; all subsequent requests reuse it.

---

## How Retrieval Is Performed

`lib/knowledge/knowledge-search.ts`

All search functions operate on the in-memory cache — no filesystem I/O at query time.

### Lookup functions

| Function | Purpose |
|----------|---------|
| `findCrop(id)` | Exact match by crop ID |
| `findCropByName(name)` | Case-insensitive match by name or alias |
| `findCropByApproximateName(name)` | Exact match first, then partial/substring match |
| `findDisease(id)` | Exact match by disease ID |
| `findDiseasesByCrop(cropId)` | All diseases where `cropId` matches |
| `findDiseaseByName(name)` | Case-insensitive match by name or alias |
| `findPest(id)` | Exact match by pest ID |
| `findPestsByCrop(cropId)` | All pests where `affectedCrops` includes the crop |
| `findDeficiency(id)` | Exact match by deficiency ID |

### Keyword search

`findByKeyword(keyword)` searches the **entire knowledge base** (crops, diseases, pests, deficiencies, glossary) and returns results grouped by category, scored by relevance:

| Score | Match type |
|-------|------------|
| 3 | Exact match |
| 2 | Starts with the keyword |
| 1 | Contains the keyword |

Results within each category are sorted by score descending. The context builder uses this to find additional diseases, pests, or deficiencies that match symptom descriptions beyond the crop-specific lookup.

---

## How to Add New Crops or Diseases

### Adding a crop

1. Create `knowledge/crops/<crop-id>.json` with the following fields:

   ```json
   {
     "id": "okra",
     "name": "Okra",
     "scientificName": "Abelmoschus esculentus",
     "aliases": ["Lady's Finger", "Kubewa (Hausa)", "Ila (Yoruba)"],
     "description": "...",
     "growingRegions": ["West Africa", "Nigeria"],
     "growthStages": ["Germination", "Seedling", "Flowering", "Maturity"],
     "commonDiseaseIds": ["okra-mosaic-virus"],
     "commonPestIds": ["whitefly", "aphids"],
     "commonDeficiencyIds": ["nitrogen-deficiency"]
   }
   ```

2. Create the disease subdirectory: `knowledge/diseases/<crop-id>/`
3. Create at least one disease JSON file inside it with a matching `cropId`.

### Adding a disease

1. Create `knowledge/diseases/<crop-id>/<disease-id>.json`:

   ```json
   {
     "id": "okra-mosaic-virus",
     "cropId": "okra",
     "name": "Okra Mosaic Virus",
     "scientificName": "Okra mosaic virus (OMV)",
     "aliases": ["OMV", "Okra Yellow Mosaic"],
     "description": "...",
     "symptoms": ["Yellow mosaic pattern on leaves", "Stunted growth"],
     "causes": ["Virus transmitted by aphids"],
     "severity": "high",
     "seasonality": ["Wet season"],
     "treatments": ["Remove infected plants"],
     "prevention": ["Use virus-free seeds"],
     "references": ["IITA Vegetable Disease Guide"]
   }
   ```

   Valid severity values: `low`, `moderate`, `high`, `critical`.

2. Add the disease ID to the crop's `commonDiseaseIds` array.

### Adding a pest

1. Create `knowledge/pests/<pest-id>.json`:

   ```json
   {
     "id": "whitefly",
     "name": "Whitefly",
     "scientificName": "Bemisia tabaci",
     "aliases": [],
     "description": "...",
     "affectedCrops": ["cassava", "okra", "tomato"],
     "symptoms": ["Yellowing leaves", "Sooty mold"],
     "lifecycle": ["Egg", "Nymph", "Adult"],
     "treatments": ["Neem oil spray"],
     "prevention": ["Reflective mulch"]
   }
   ```

2. Add the pest ID to each affected crop's `commonPestIds` array.

### Adding a deficiency

1. Create `knowledge/deficiencies/<deficiency-id>.json`:

   ```json
   {
     "id": "potassium-deficiency",
     "name": "Potassium Deficiency",
     "aliases": ["K deficiency", "Margin scorch"],
     "description": "...",
     "affectedCrops": ["maize", "tomato"],
     "symptoms": ["Leaf margin scorching"],
     "causes": ["Low soil potassium"],
     "treatments": ["Apply potassium fertilizer"],
     "prevention": ["Soil testing"]
   }
   ```

2. Add the deficiency ID to each affected crop's `commonDeficiencyIds` array.

### Validation

Run `npx tsc --noEmit` and `npm run lint` to verify the JSON doesn't break TypeScript types. The loader will throw at startup if any JSON is malformed or missing required fields.

**Always check cross-references**: Every `cropId`, `commonDiseaseIds`, `commonPestIds`, `commonDeficiencyIds`, and `affectedCrops` value must point to an existing entity. Broken references silently degrade search quality.

---

## How Knowledge Is Injected Into the AI Prompt

`lib/knowledge/knowledge-context.ts` → `buildKnowledgeContext()`

The injection pipeline:

```
User sends symptoms
        ↓
DiagnosisAIAdapter.buildRequestMessages()
        ↓
knowledgeService.buildContext(cropId, symptoms)
        ↓
buildKnowledgeContext(cropId, symptoms)
        ↓
[1] Crop info block (name, scientific name, aliases, regions)
[2] Disease info block (known diseases → symptoms, treatments, prevention)
[3] Keyword match block (symptom-matched diseases, pests, deficiencies)
        ↓
Returns formatted string or empty string
        ↓
Merged into system prompt via buildSystemMessages('diagnosis', messages, extraContext)
        ↓
System prompt sent to AI model
```

The context is appended to the system prompt with a blank line separator:

```
You are a crop disease diagnosis assistant...

Available Knowledge:

Crop: Maize (Zea mays)
Also known as: Corn, Agu (Igbo), Oka (Yoruba)
Growing regions: West Africa, Nigeria, Ghana, Kenya

Known diseases affecting this crop:

  Northern Leaf Blight (Exserohilum turcicum)
  Severity: high
  Common symptoms: Long elliptical gray-green lesions...
  Treatments: Apply fungicides containing azoxystrobin...
  Prevention: Plant resistant varieties...
```

The AI model sees this context as part of its system instructions, grounding its responses in the curated knowledge rather than relying solely on its training data. When the knowledge base has no data for a given crop, the context block is empty and the model falls back to its general agricultural knowledge.

---

## How the Application Behaves When the AI Model Is Unavailable

There are two independent fallback layers:

### 1. Adapter-level mock (development)

When `USE_MOCK_AI=true` in the environment, the adapter factory loads `adapters/mock-ai/diagnosis.adapter.ts` instead of the real `DiagnosisAIAdapter`. The mock adapter generates plausible-looking diagnosis responses from hardcoded logic without any network calls or GPU. It simulates an 800ms delay to mimic real inference.

### 2. Runtime provider fallback (production)

When `USE_MOCK_AI` is `false`, the inference router (`lib/ai/router/inference.router.ts`) tries providers in priority order:

1. **OllamaProvider** (priority 1, local): Probes `GET /api/tags`. If Ollama is running with the configured model, it is used. Availability is cached for 30 seconds.
2. **CloudProvider** (priority 2): Used if `GEMMA_CLOUD_ENDPOINT` and `GEMMA_CLOUD_API_KEY` are configured.

If a provider is unavailable or throws, the router falls through to the next. If all providers are exhausted, it throws `AIServiceError` (HTTP 503) with an actionable message listing the registered providers.

### Error handling by endpoint

- **Non-streaming** (`POST /api/diagnose`): Errors are caught in the route handler. `AppError` subclasses return their specific status code (`AIServiceError` → 503, `ValidationError` → 400). Unknown errors return 500.
- **Streaming** (`POST /api/diagnose/stream`): The streaming service wraps the adapter call in a try/catch and emits errors as SSE `error` events to the client. The stream is then closed. If the error occurs before the stream starts, the route handler returns an SSE error event with the appropriate HTTP status code.
